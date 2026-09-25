require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const bcrypt     = require('bcryptjs')
const jwt        = require('jsonwebtoken')
// Node 22 has built-in fetch — no node-fetch needed
const rateLimit  = require('express-rate-limit')
const path       = require('path')
const crypto     = require('crypto')

// No nodemailer — Railway blocks all SMTP outbound
// Using SendByte HTTP API instead (works on Railway)
async function sendMail(to, subject, html) {
  const sendbyteKey = process.env.SENDBYTE_API_KEY
  if (!sendbyteKey) {
    console.log('[MAIL SKIPPED — no SENDBYTE_API_KEY set]', subject, '->', to)
    return
  }
  try {
    const fromAddr = process.env.SENDBYTE_FROM || 'Express Briefs <onboarding@sendbyte.africa>'
    const res = await fetch('https://api.sendbyte.africa/v1/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sendbyteKey },
      body: JSON.stringify({ from: fromAddr, to, subject, html })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || JSON.stringify(data))
    console.log('[MAIL SENT]', subject, '->', to)
  } catch (e) {
    console.error('[MAIL ERROR]', e.message)
  }
}

const {
  getUser, getUserById, createUser, updateLastLogin, updatePlan,
  setEmailVerified, updatePassword,
  incrementFailedAttempts, resetFailedAttempts,
  createResetToken, getResetToken, markResetTokenUsed, deleteOldResetTokens,
  createVerifyToken, getVerifyToken, deleteVerifyToken,
  createPayment, getPayment, updatePaymentStatus,
  countMonthlyGenerations, countMonthlyApiGenerations, logGeneration, getPlan,
  getApiPlan, setApiPlan, apiPlanFor,
  getAllUsers, getStats
} = require('./database')

const { industries, PLATFORMS, TONES } = require('./industries')

// A same-origin relative path to send someone back to after an email/auth
// action (verify email, log in). Mirrors the client-side check in app.js.
// Rejects protocol-relative ("//host") and anything with a scheme, so this
// can never be turned into an open redirect.
function safeNextPath(value) {
  if (typeof value !== 'string') return null
  if (value.charAt(1) === '/') return null
  return /^\/[a-zA-Z0-9\/_-]*\/?$/.test(value) ? value : null
}
const { createApiRouter } = require('./api')

const app = express()
const PORT = process.env.PORT || 8000
app.set('trust proxy', 1)

// Hard fail if critical env vars are missing
if (!process.env.GROQ_API_KEY)   { console.error('GROQ_API_KEY missing in .env'); process.exit(1) }
if (!process.env.JWT_SECRET)     { console.error('JWT_SECRET missing in .env'); process.exit(1) }
if (process.env.JWT_SECRET === 'change-this-to-a-long-random-string-nobody-can-guess') {
  console.error('You must change JWT_SECRET to a real random string in .env'); process.exit(1)
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long'); process.exit(1)
}

const JWT_SECRET  = process.env.JWT_SECRET
const APP_URL     = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
const BACHS_SK             = process.env.BACHS_API_KEY || ''
const BACHS_BASE_URL       = BACHS_SK.startsWith('sk_live_') ? 'https://api.bachs.io' : 'https://sandbox-api.bachs.io'
const BACHS_WEBHOOK_SECRET = process.env.BACHS_WEBHOOK_SECRET || ''
const BACHS_PRODUCTS = {
  starter: process.env.BACHS_PRODUCT_STARTER || '',
  pro:     process.env.BACHS_PRODUCT_PRO || '',
  agency:  process.env.BACHS_PRODUCT_AGENCY || ''
}

// Bachs products for the paid API plans (the free 'developer' tier needs none)
const BACHS_API_PRODUCTS = {
  builder: process.env.BACHS_PRODUCT_API_BUILDER || '',
  growth:  process.env.BACHS_PRODUCT_API_GROWTH  || '',
  scale:   process.env.BACHS_PRODUCT_API_SCALE   || ''
}

// Security Headers
app.use((req, res, next) => {
  // Content Security Policy — prevents XSS script injection
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; '))
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains') // HTTPS only
  res.removeHeader('X-Powered-By')
  next()
})

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:8000', 'http://127.0.0.1:8000']

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}))

// Body size limit
// ── BACHS WEBHOOK ────────────────────────────────────────────────────────────
// Registered BEFORE express.json() so we get the raw body — signature
// verification requires the exact bytes Bachs signed, not a re-serialized copy.
app.post('/api/webhooks/bachs', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-bachs-signature']
  const timestamp  = req.headers['x-bachs-timestamp']
  if (!BACHS_WEBHOOK_SECRET) return res.status(500).send('Webhook not configured.')
  if (!signature || !timestamp) return res.status(400).send('Missing signature headers.')

  // Reject stale deliveries (replay protection)
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {
    return res.status(400).send('Stale timestamp.')
  }

  const rawBody = req.body // Buffer, thanks to express.raw() above
  const message  = `${timestamp}.${rawBody.toString('utf8')}`
  const expected = crypto.createHmac('sha256', BACHS_WEBHOOK_SECRET).update(message, 'utf8').digest('hex')

  let validSig = false
  try {
    validSig = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)))
  } catch (e) { validSig = false } // length mismatch etc — treat as invalid, not a crash
  if (!validSig) return res.status(400).send('Invalid signature.')

  let event
  try { event = JSON.parse(rawBody.toString('utf8')) } catch (e) { return res.status(400).send('Bad JSON.') }

  // This is the ONLY place a plan upgrade is actually granted — never on the
  // redirect. Redirects can be closed, retried, or spoofed; this can't.
  if (event.type === 'collection.succeeded') {
    const reference = event.data && event.data.reference
    if (reference) {
      const payment = getPayment.get(reference)
      if (payment && payment.status !== 'success') {
        updatePaymentStatus.run('success', reference)
        const user = getUserById.get(payment.user_id)
        if (payment.kind === 'api') {
          // API plan purchase: upgrades API metering only, never the website plan.
          setApiPlan.run(payment.plan, payment.user_id)
          if (user) sendMail(user.email, 'Your Express Briefs API plan has been upgraded!', `
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2 style="color:#2E7A52">API plan upgraded!</h2>
              <p>Hi ${user.name}, your API plan is now <strong>${payment.plan}</strong>. Your new monthly limit is active immediately, and your existing API keys keep working.</p>
              <a href="${APP_URL}/developers/" style="display:inline-block;background:#2E7A52;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open the developer dashboard</a>
            </div>
          `)
        } else {
          updatePlan.run(payment.plan, payment.user_id)
          if (user) sendMail(user.email, 'Your Express Briefs plan has been upgraded!', `
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2 style="color:#2E7A52">Plan upgraded!</h2>
              <p>Hi ${user.name}, your account has been upgraded to the <strong>${payment.plan}</strong> plan.</p>
              <p>You can now generate more listings every month. Enjoy!</p>
              <a href="${APP_URL}/real-estate/" style="display:inline-block;background:#2E7A52;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Go to Express Briefs</a>
            </div>
          `)
        }
      }
    }
  } else if (event.type === 'collection.failed') {
    const reference = event.data && event.data.reference
    if (reference) updatePaymentStatus.run('failed', reference)
  }

  // Acknowledge receipt regardless of whether we acted — Bachs retries on
  // non-2xx, and we've already handled duplicates via the status check above.
  res.status(200).json({ received: true })
})

app.use(express.json({ limit: '50kb' }))
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }))

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true, legacyHeaders: false
})

const genLimiter = rateLimit({
  windowMs: 60 * 1000, max: 5,
  message: { error: 'Too many generation requests. Slow down.' },
  standardHeaders: true, legacyHeaders: false
})

const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { error: 'Too many requests.' } })
app.use(globalLimiter)

// Input Sanitizer
function sanitize(str, maxLen) {
  maxLen = maxLen || 500
  if (typeof str !== 'string') return ''
  return str.slice(0, maxLen).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim()
}

// Auth Middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET, { algorithms: ['HS256'], issuer: 'expressbriefs' })
    next()
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.'
    res.status(401).json({ error: msg })
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access only.' })
    next()
  })
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d', algorithm: 'HS256', issuer: 'expressbriefs' })
}

// Seed Admin
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const existing = getUser.get(process.env.ADMIN_EMAIL.toLowerCase())
  if (!existing) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12)
    createUser.run(process.env.ADMIN_EMAIL.toLowerCase(), hash, 'Admin', 'agency', 1)
    console.log('Admin account created:', process.env.ADMIN_EMAIL)
  }
}

// REGISTER
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const name     = sanitize(req.body.name, 100)
  const email    = sanitize(req.body.email, 200).toLowerCase()
  const password = typeof req.body.password === 'string' ? req.body.password : ''

  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' })
  if (name.length < 2)              return res.status(400).json({ error: 'Name must be at least 2 characters.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address.' })
  if (password.length < 8)         return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  if (password.length > 128)       return res.status(400).json({ error: 'Password too long.' })

  // Block the 50 most common passwords
  const WEAK = ['password','password1','password123','123456789','12345678','qwerty123','iloveyou','admin123','letmein','welcome','monkey123','dragon','master','sunshine','princess','football','shadow','superman','michael','jessica']
  if (WEAK.includes(password.toLowerCase())) return res.status(400).json({ error: 'That password is too common. Please choose a stronger one.' })

  const existing = getUser.get(email)
  if (existing) return res.status(400).json({ error: 'Email already registered.' })

  const hash   = await bcrypt.hash(password, 12)
  const result = createUser.run(email, hash, name, 'free', 0)
  const userId = result.lastInsertRowid
  const token  = signToken({ id: userId, email, is_admin: 0 })

  // Send verification email
  const verifyToken = crypto.randomBytes(32).toString('hex')
  createVerifyToken.run(userId, verifyToken)
  const nextPath = safeNextPath(req.body.next)
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${verifyToken}` + (nextPath ? `&next=${encodeURIComponent(nextPath)}` : '')
  sendMail(email, 'Verify your Express Briefs email', `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#2E7A52">Welcome to Express Briefs, ${name}!</h2>
      <p>Click the button below to verify your email address.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#2E7A52;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Verify Email</a>
      <p style="color:#999;font-size:12px;margin-top:16px">Link expires in 24 hours. If you didn't sign up, ignore this email.</p>
    </div>
  `)

  res.status(201).json({ token, user: { id: userId, email, name, plan: 'free', email_verified: 0 } })
})

// LOGIN
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const email    = sanitize(req.body.email, 200).toLowerCase()
  const password = typeof req.body.password === 'string' ? req.body.password : ''

  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' })

  const user = getUser.get(email)

  // Check lockout before running bcrypt (saves CPU on attack)
  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000)
    console.log('[LOCKOUT BLOCKED]', email, req.ip)
    return res.status(429).json({ error: `Account locked due to too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.` })
  }

  const dummyHash = '$2a$12$dummyhashtopreventtimingattacksxxxxxxxxxxxxxxxxxxxxxxxxx'
  const valid = user
    ? await bcrypt.compare(password, user.password)
    : await bcrypt.compare(password, dummyHash).then(() => false)

  if (!user || !valid) {
    if (user) {
      incrementFailedAttempts.run(user.id)
      const fresh = getUserById.get(user.id)
      const left = Math.max(0, 5 - (fresh.failed_attempts || 0))
      console.log('[FAILED LOGIN]', email, req.ip, 'attempts:', fresh.failed_attempts)
      if (left === 0) return res.status(401).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' })
      return res.status(401).json({ error: `Invalid email or password. ${left} attempt${left !== 1 ? 's' : ''} remaining before lockout.` })
    }
    console.log('[FAILED LOGIN - no user]', email, req.ip)
    return res.status(401).json({ error: 'Invalid email or password.' })
  }

  // Success — reset lockout counters
  resetFailedAttempts.run(user.id)
  updateLastLogin.run(user.id)
  console.log('[LOGIN OK]', email, req.ip)
  const token = signToken({ id: user.id, email: user.email, is_admin: user.is_admin })
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan, is_admin: user.is_admin, email_verified: user.email_verified } })
})

// GET CURRENT USER
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = getUserById.get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  const plan  = getPlan.get(user.plan)
  const usage = countMonthlyGenerations.get(user.id)

  res.json({
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan, is_admin: user.is_admin },
    usage: { used: usage.count, limit: plan ? plan.monthly_limit : 5, plan }
  })
})

// ── GENERATION CORE ─────────────────────────────────────────────────────────
// Shared by the website (POST /api/generate, JWT auth) and the public developer
// API (POST /api/v1/generate, API-key auth) so quota checks, prompting and
// usage logging behave identically for both.
class GenError extends Error {
  constructor(status, code, message, extra) {
    super(message)
    this.status = status
    this.code   = code
    this.extra  = extra || {}
  }
}

async function generateForUser(user, body, opts) {
  const apiKeyId = (opts && opts.apiKeyId) || null

  // Website and API calls are metered separately, each against its own plan.
  const isApi = apiKeyId !== null
  let limit, usage
  if (isApi) {
    limit = apiPlanFor(user).monthly_limit
    usage = countMonthlyApiGenerations.get(user.id)
    if (usage.count >= limit) {
      throw new GenError(429, 'limit_reached',
        'Monthly API limit reached (' + limit + ' generations). Upgrade your API plan to continue.',
        { upgrade: true, upgrade_url: APP_URL + '/developers/#plans' })
    }
  } else {
    const plan = getPlan.get(user.plan)
    limit = plan ? plan.monthly_limit : 5
    usage = countMonthlyGenerations.get(user.id)
    if (usage.count >= limit) {
      throw new GenError(429, 'limit_reached', 'Monthly limit reached (' + limit + ' generations). Please upgrade.', { upgrade: true })
    }
  }

  // Industry defaults to real-estate for backwards compatibility with the
  // original single-industry frontend/clients. hasOwnProperty matters: a plain
  // lookup would treat inherited names like "constructor" as valid industries.
  const industrySlug = sanitize(body.industry, 50) || 'real-estate'
  if (!Object.prototype.hasOwnProperty.call(industries, industrySlug)) {
    throw new GenError(400, 'unknown_industry', 'Unknown industry.')
  }
  const industryCfg = industries[industrySlug]

  // Generic field bag — keys are whatever industryCfg.fields defines
  // (propType/listingType for real estate, vehicleType/makeModel for
  // automotive, roleTitle/company for recruitment, etc). We still sanitize
  // every value and validate required-ness against the config, so this
  // stays just as safe as the old hardcoded version.
  const rawFields = (body.fields && typeof body.fields === 'object') ? body.fields : body
  const fields = {}
  for (const f of industryCfg.fields) {
    fields[f.key] = sanitize(rawFields[f.key], f.key === 'extra' ? 1000 : 200)
  }
  const extra     = sanitize(body.extra, 1000)
  const tone      = sanitize(body.tone, 50)
  const features  = Array.isArray(body.features) ? body.features.map(f => sanitize(f, 100)).slice(0, 20) : []
  const platforms = Array.isArray(body.platforms) ? body.platforms.map(p => sanitize(p, 50)).slice(0, 10) : []

  const missing = industryCfg.fields.filter(f => f.required && !fields[f.key])
  if (missing.length) {
    throw new GenError(400, 'missing_fields', 'Missing required field(s): ' + missing.map(f => f.label).join(', '))
  }

  // `location` and `price` are used for logging/display across every
  // industry even though the field key set differs per vertical.
  const locationVal = fields.location || ''
  const subjectLabel = (fields[industryCfg.fields[0].key] || industryCfg.entityLabel) + ' — ' + industryCfg.name

  const prompt = buildPrompt({ industryCfg, fields, features, extra, tone, platforms })

  // Groq fetch with 60s timeout and 1 retry
  async function callGroq() {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY },
        body: JSON.stringify({ model: 'openai/gpt-oss-20b', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
        signal: controller.signal
      })
      clearTimeout(timeout)
      return response
    } catch(e) {
      clearTimeout(timeout)
      throw e
    }
  }

  let text, tokensUsed, truncated
  try {
    let response
    try {
      response = await callGroq()
    } catch(e) {
      // Retry once on timeout/network error
      console.log('[GENERATE] First attempt failed, retrying...', e.message)
      response = await callGroq()
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error?.message || 'Groq API error ' + response.status)
    }

    const data = await response.json()
    const choice = data.choices && data.choices[0]
    text       = choice && choice.message && choice.message.content
    tokensUsed = data.usage?.total_tokens || 0
    truncated  = !!(choice && choice.finish_reason === 'length')
    if (!text || !text.trim()) throw new Error('Empty completion')
  } catch (err) {
    console.error('[GENERATE ERROR]', err.message, err.code || '', err.type || '')
    const isKeyError = err.message && (err.message.includes('401') || err.message.includes('invalid_api_key'))
    if (isKeyError) throw new GenError(500, 'server_misconfigured', 'Invalid API key. Check your GROQ_API_KEY in Railway variables.')
    throw new GenError(500, 'generation_failed', 'Generation failed. Please try again.')
  }

  // Only successful generations are logged, so failures never eat a user's quota.
  logGeneration.run(user.id, industrySlug, subjectLabel, locationVal, platforms.join(','), tokensUsed, apiKeyId)

  const newUsage = (isApi ? countMonthlyApiGenerations : countMonthlyGenerations).get(user.id)
  return { content: text, usage: { used: newUsage.count, limit }, industry: industrySlug, platforms, truncated }
}

// Split the model's "[SECTION]\ntext" output into { section_name: text }.
// HEADLINES becomes an array of strings. If the model ignored the format,
// this returns {} and callers fall back to the raw text.
function parseSections(text) {
  const buckets = {}
  let current = null
  for (const line of String(text).split('\n')) {
    const m = line.match(/^[\s*#_`>-]*\[([A-Z][A-Z &]*)\][\s*:_`]*$/)
    if (m) {
      current = m[1].trim().toLowerCase().replace(/[^a-z]+/g, '_')
      buckets[current] = []
    } else if (current) {
      buckets[current].push(line)
    }
  }
  const out = {}
  for (const key of Object.keys(buckets)) {
    const body = buckets[key].join('\n').trim()
    if (!body) continue
    out[key] = key === 'headlines'
      ? body.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1').trim()).filter(Boolean)
      : body
  }
  return out
}

// GENERATE (website)
app.post('/api/generate', requireAuth, genLimiter, async (req, res) => {
  const user = getUserById.get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  try {
    const result = await generateForUser(user, req.body)
    res.json({ content: result.content, usage: result.usage })
  } catch (err) {
    if (err instanceof GenError) return res.status(err.status).json(Object.assign({ error: err.message }, err.extra))
    console.error('[GENERATE ERROR]', err.message)
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
})

// DEVELOPER API — API keys (dashboard) + /api/v1/* (public, API-key auth). See api.js
app.use('/api', createApiRouter({ requireAuth, sanitize, generateForUser, parseSections, GenError, industries, PLATFORMS, TONES, APP_URL }))

// INDUSTRIES — drives the dynamic compose form on the frontend
app.get('/api/industries', (req, res) => {
  const list = Object.values(industries).map(({ slug, name, tagline, entityLabel, heroVerb, audience, icon, ctaAction }) =>
    ({ slug, name, tagline, entityLabel, heroVerb, audience, icon, ctaAction }))
  res.json({ industries: list, platforms: PLATFORMS, tones: TONES })
})

app.get('/api/industries/:slug', (req, res) => {
  const cfg = industries[req.params.slug]
  if (!cfg) return res.status(404).json({ error: 'Unknown industry.' })
  res.json({ industry: cfg, platforms: PLATFORMS, tones: TONES })
})

// PLANS
app.get('/api/plans', (req, res) => {
  const { db } = require('./database')
  const plans = db.prepare('SELECT name, monthly_limit, price_usd, description FROM plans ORDER BY monthly_limit').all()
  res.json(plans)
})

// ADMIN
app.get('/api/admin/stats', requireAdmin, (req, res) => res.json(getStats.get()))

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = getAllUsers.all().map(({ password, ...safe }) => safe)
  res.json(users)
})

app.post('/api/admin/set-plan', requireAdmin, (req, res) => {
  const userId = parseInt(req.body.userId, 10)
  const plan   = sanitize(req.body.plan, 20)
  if (!userId || isNaN(userId))           return res.status(400).json({ error: 'Invalid user ID.' })
  if (!['free','starter','pro','agency'].includes(plan)) return res.status(400).json({ error: 'Invalid plan.' })
  const user = getUserById.get(userId)
  if (!user) return res.status(404).json({ error: 'User not found.' })
  updatePlan.run(plan, userId)
  if (user.plan !== plan) {
    sendMail(user.email, 'Your Express Briefs plan has been upgraded!', `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#2E7A52">Plan upgraded!</h2>
        <p>Hi ${user.name}, your account has been upgraded to the <strong>${plan}</strong> plan.</p>
        <p>You can now generate more listings every month. Enjoy!</p>
        <a href="${APP_URL}/real-estate/" style="display:inline-block;background:#2E7A52;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Go to Express Briefs</a>
      </div>
    `)
  }
  res.json({ success: true })
})

// Set a user's developer API plan (the website plan is set via /api/admin/set-plan)
app.post('/api/admin/set-api-plan', requireAdmin, (req, res) => {
  const userId = parseInt(req.body.userId, 10)
  const plan   = sanitize(req.body.plan, 20)
  if (!userId || isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID.' })
  if (!getApiPlan.get(plan))    return res.status(400).json({ error: 'Invalid API plan.' })
  if (!getUserById.get(userId)) return res.status(404).json({ error: 'User not found.' })
  setApiPlan.run(plan, userId)
  res.json({ success: true })
})

// VERIFY EMAIL
app.get('/api/auth/verify-email', (req, res) => {
  const { token } = req.query
  const dest = safeNextPath(req.query.next) || '/real-estate/'
  if (!token) return res.redirect(dest + '?verified=fail')
  const row = getVerifyToken.get(token)
  if (!row) return res.redirect(dest + '?verified=fail')
  setEmailVerified.run(row.user_id)
  deleteVerifyToken.run(row.user_id)
  res.redirect(dest + '?verified=1')
})

// RESEND VERIFICATION EMAIL
app.post('/api/auth/resend-verification', authLimiter, requireAuth, async (req, res) => {
  const user = getUserById.get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found.' })
  if (user.email_verified) return res.json({ message: 'Already verified.' })
  const verifyToken = crypto.randomBytes(32).toString('hex')
  createVerifyToken.run(user.id, verifyToken)
  const nextPath = safeNextPath(req.body.next)
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${verifyToken}` + (nextPath ? `&next=${encodeURIComponent(nextPath)}` : '')
  sendMail(user.email, 'Verify your Express Briefs email', `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#2E7A52">Verify your email</h2>
      <p>Click below to verify your Express Briefs account.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#2E7A52;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Verify Email</a>
      <p style="color:#999;font-size:12px;margin-top:16px">Link expires in 24 hours.</p>
    </div>
  `)
  res.json({ message: 'Verification email sent.' })
})

// FORGOT PASSWORD
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const email = sanitize(req.body.email, 200).toLowerCase()
  if (!email) return res.status(400).json({ error: 'Email required.' })
  // Always return success to prevent email enumeration
  const user = getUser.get(email)
  if (user) {
    deleteOldResetTokens.run(user.id)
    const resetToken = crypto.randomBytes(32).toString('hex')
    createResetToken.run(user.id, resetToken)
    const resetUrl = `${APP_URL}/real-estate/?reset_token=${resetToken}`
    sendMail(email, 'Reset your Express Briefs password', `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#2E7A52">Reset your password</h2>
        <p>You requested a password reset. Click the button below — this link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#2E7A52;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
        <p style="color:#999;font-size:12px;margin-top:16px">If you didn't request this, ignore this email. Your password won't change.</p>
      </div>
    `)
  }
  res.json({ message: 'If that email exists, a reset link has been sent.' })
})

// RESET PASSWORD
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body
  if (!token || typeof password !== 'string') return res.status(400).json({ error: 'Token and password required.' })
  if (password.length < 8)  return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  if (password.length > 128) return res.status(400).json({ error: 'Password too long.' })
  const row = getResetToken.get(token)
  if (!row) return res.status(400).json({ error: 'Reset link is invalid or has expired.' })
  const hash = await bcrypt.hash(password, 12)
  updatePassword.run(hash, row.user_id)
  markResetTokenUsed.run(token)
  res.json({ message: 'Password updated successfully.' })
})

// ── BACHS PAYMENT ───────────────────────────────────────────────────────────
app.post('/api/payment/initialize', requireAuth, async (req, res) => {
  if (!BACHS_SK) return res.status(500).json({ error: 'Payment not configured.' })
  const user = getUserById.get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  // kind 'api' = a developer API plan (metered separately from the website plan)
  const kind = req.body.kind === 'api' ? 'api' : 'website'
  const plan = sanitize(req.body.plan, 20)
  let industry, productId, amount

  if (kind === 'api') {
    const target = getApiPlan.get(plan)
    if (!target || target.price_usd <= 0) return res.status(400).json({ error: 'Invalid plan.' })
    if (target.monthly_limit <= apiPlanFor(user).monthly_limit) {
      return res.status(400).json({ error: 'You are already on this API plan or a higher one.' })
    }
    productId = BACHS_API_PRODUCTS[target.name]
    if (!productId) return res.status(500).json({ error: `Plan not configured. Set BACHS_PRODUCT_API_${plan.toUpperCase()} in your environment.` })
    industry = 'developers'                 // return_url lands back on /developers/
    amount   = target.price_usd * 100       // USD cents, for our own records only
  } else {
    if (!['starter','pro','agency'].includes(plan)) return res.status(400).json({ error: 'Invalid plan.' })
    industry = industries[sanitize(req.body.industry, 50)] ? sanitize(req.body.industry, 50) : 'real-estate'
    productId = BACHS_PRODUCTS[plan]
    if (!productId) return res.status(500).json({ error: `Plan not configured. Set BACHS_PRODUCT_${plan.toUpperCase()} in your environment.` })
    const planPricesMinor = { starter: 500, pro: 1200, agency: 2500 } // USD cents, for our own records only
    amount = planPricesMinor[plan]
  }
  const reference = 'BCH_' + crypto.randomBytes(8).toString('hex').toUpperCase()

  try {
    const response = await fetch(`${BACHS_BASE_URL}/v1/checkout-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + BACHS_SK },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: user.email, name: user.name },
        reference,
        return_url: `${APP_URL}/api/payment/verify?ref=${reference}`,
        metadata: { user_id: String(user.id), plan, user_name: user.name, industry, kind }
      })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Bachs error')
    createPayment.run(user.id, reference, plan, amount, industry, kind)
    res.json({ authorization_url: data.checkout_url, reference })
  } catch (e) {
    console.error('[PAYMENT INIT ERROR]', e.message)
    res.status(500).json({ error: 'Could not initialize payment. Try again.' })
  }
})

// Redirect target after checkout. This is UX only — it reflects whatever the
// webhook has already recorded in our DB. It never grants the plan itself,
// since a redirect can be closed early, retried, or forged by the client.
app.get('/api/payment/verify', async (req, res) => {
  const reference = req.query.ref
  if (!reference) return res.redirect('/real-estate/?payment=error')
  const payment = getPayment.get(reference)
  if (!payment) return res.redirect('/real-estate/?payment=error')
  const base = `/${payment.industry || 'real-estate'}/`
  if (payment.status === 'success') return res.redirect(`${base}?payment=success`)
  if (payment.status === 'failed') return res.redirect(`${base}?payment=failed`)
  // Webhook may just not have arrived yet — this is normal, not an error.
  // Frontend polls /api/payment/status with this reference to catch the
  // real outcome once the webhook lands, instead of guessing here.
  return res.redirect(`${base}?payment=processing&ref=${reference}`)
})

// Lightweight polling endpoint for the processing state above. Returns only
// the status — no PII — since the reference itself is an unguessable token.
app.get('/api/payment/status', async (req, res) => {
  const reference = req.query.ref
  if (!reference) return res.status(400).json({ error: 'Missing reference.' })
  const payment = getPayment.get(reference)
  if (!payment) return res.status(404).json({ error: 'Not found.' })
  res.json({ status: payment.status })
})

// 404 for unknown API routes
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Route not found.' }))

// Serve frontend
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))

// Global error handler — never leak stack traces to client
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.message)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

app.listen(PORT, () => {
  console.log('\nExpress Briefs running at http://localhost:' + PORT)
  console.log('Log in with your admin email to access the dashboard\n')
})

// PROMPT BUILDER — generic across all 11 industries. Field values, entity
// label, and CTA language all come from industryCfg (industries.js); only
// the location-based market-context detection stays hardcoded since it's
// genuinely universal (every vertical benefits from geo-aware copy).
function buildPrompt({ industryCfg, fields, features, extra, tone, platforms }) {
  const platformList = platforms || []
  const location = fields.location || ''
  const price    = fields.price || ''
  const loc = location.toLowerCase()

  const isUK = /london|manchester|birmingham|leeds|edinburgh|glasgow|bristol|england|scotland|wales|uk/.test(loc)
  const isUS = /new york|los angeles|chicago|miami|houston|dallas|atlanta|boston|usa|united states/.test(loc)
  const isNigeria = /lagos|abuja|port harcourt|ibadan|kano|nigeria|lekki|vi|ikoyi|ajah|chevron/.test(loc)
  const isGhana = /accra|kumasi|ghana|east legon|cantonments/.test(loc)
  const isUAE = /dubai|abu dhabi|sharjah|uae|emirates/.test(loc)
  const isSA = /johannesburg|cape town|durban|south africa|sandton/.test(loc)

  let marketContext = location ? ('the local market in ' + location) : ('the ' + industryCfg.name.toLowerCase() + ' market')
  let currencyHint = ''
  let callToAction = 'Contact us to ' + industryCfg.ctaAction

  if (isUK) { marketContext = 'the UK ' + industryCfg.name.toLowerCase() + ' market'; currencyHint = 'GBP (£)'; }
  else if (isUS) { marketContext = 'the US ' + industryCfg.name.toLowerCase() + ' market'; currencyHint = 'USD ($)'; }
  else if (isNigeria) { marketContext = 'the Nigerian ' + industryCfg.name.toLowerCase() + ' market'; currencyHint = 'NGN (₦)'; }
  else if (isGhana) { marketContext = 'the Ghanaian ' + industryCfg.name.toLowerCase() + ' market'; currencyHint = 'GHS (₵)'; }
  else if (isUAE) { marketContext = 'the UAE/Dubai ' + industryCfg.name.toLowerCase() + ' market'; currencyHint = 'AED'; }
  else if (isSA) { marketContext = 'the South African ' + industryCfg.name.toLowerCase() + ' market'; currencyHint = 'ZAR (R)'; }

  // Extract city/area name for hashtags
  const locationParts = location.split(',').map(s => s.trim())
  const city = locationParts[0] || location || industryCfg.name
  const country = locationParts[locationParts.length - 1] || location || ''
  const cityTag = city.replace(/\s+/g, '')
  const countryTag = country.replace(/\s+/g, '')

  // Render every configured field as "Label: value" for the AI, in the
  // order defined by industries.js — this is what makes the prompt
  // industry-agnostic instead of hardcoded to propType/listingType.
  const fieldLines = industryCfg.fields
    .map(f => '- ' + f.label + ': ' + (fields[f.key] || 'Not specified'))
    .join('\n')

  const featList = (features && features.length) ? features.join(', ') : 'Standard features'

  let prompt = 'You are ExpressBriefsAI, an expert copywriter for the ' + industryCfg.name + ' industry, writing for ' + industryCfg.audience + '. Write compelling, authentic marketing content that converts.\n\n'
  prompt += industryCfg.entityLabel.toUpperCase() + ' DETAILS:\n'
  prompt += fieldLines + '\n'
  prompt += '- Features: ' + featList + '\n'
  prompt += '- Extra Info: ' + (extra || 'None') + '\n'
  prompt += '- Tone: ' + (tone || 'Professional') + '\n'
  prompt += '- Market: ' + marketContext + (currencyHint ? ' (' + currencyHint + ')' : '') + '\n\n'
  prompt += 'Write the following sections. Use EXACTLY these section headers on their own line:\n\n'

  prompt += '[FULL LISTING]\nWrite a professional full ' + industryCfg.entityLabel.toLowerCase() + ' description (250-350 words). Use a ' + (tone || 'Professional') + ' tone. Include all key details, paint a picture of the value on offer, and end with a clear call to action ("' + callToAction + '"). Write naturally for ' + marketContext + ' — use terminology and style that resonates with ' + industryCfg.audience + '.\n\n'

  if (platformList.includes('WhatsApp'))
    prompt += '[WHATSAPP]\nWhatsApp broadcast message (150-200 words). Start with an attention-grabbing emoji. Short punchy paragraphs. Include price and top 3 details. End with "' + callToAction + '". Use natural emojis throughout.\n\n'

  const hashtagRules =
    'Base every hashtag strictly on the real location "' + location + '" (city: ' + city + ', country: ' + country + ') where one is given. ' +
    'Use the local spelling, slang and market language that actually fits that location. ' +
    '🚫 CRITICAL: Do NOT default to Nigerian hashtags (e.g. #LagosRealEstate, #NaijaHomes, #9jaRealEstate) unless the location given is actually Nigerian — check the location string before writing a single hashtag.'

  if (platformList.includes('Instagram'))
    prompt += '[INSTAGRAM]\nInstagram caption (100-150 words). Strong hook as the very first line. Include location (if given), key details, price. Use line breaks for readability. Then write 25-30 highly relevant hashtags: 6-8 location hashtags built from the real city/country, hashtags relevant to ' + industryCfg.name + ', and general/viral hashtags for the niche. ' + hashtagRules + '\n\n'

  if (platformList.includes('Facebook'))
    prompt += '[FACEBOOK]\nFacebook post (120-180 words). Conversational and engaging tone. Include all key details. End with an engaging question and clear call to action. No hashtags.\n\n'

  if (platformList.includes('Twitter'))
    prompt += '[TWITTER]\nTwitter/X post. Maximum 270 characters. Lead with the most impressive detail. End with 2-3 relevant hashtags. ' + hashtagRules + '\n\n'

  if (platformList.includes('LinkedIn'))
    prompt += '[LINKEDIN]\nLinkedIn post (150-200 words). Professional angle — value, ROI, or opportunity, whichever fits ' + industryCfg.name + '. No emojis. Strong CTA. End with 3-5 professional hashtags. ' + hashtagRules + '\n\n'

  if (platformList.includes('TikTok'))
    prompt += '[TIKTOK]\nTikTok video caption/script (80-120 words) to accompany a short video. Open with a scroll-stopping hook (a bold claim or question) in the first line. Punchy, casual, fast-paced tone native to TikTok culture — short sentences, no corporate language. Include price and top 2-3 details. End with a strong CTA ("' + callToAction + '"). Then add 15-20 hashtags: mix a few broad discovery tags (#fyp #foryou) with niche and location-based ones. ' + hashtagRules + '\n\n'

  if (platformList.includes('Snapchat'))
    prompt += '[SNAPCHAT]\nSnapchat caption (40-70 words) to go with a Snap/Story. Ultra-casual, fun, FOMO-driven tone with natural emoji use. Include price and 1-2 standout details. End with a quick, punchy CTA ("' + callToAction + '"). Add 3-5 hashtags only if natural for Snapchat. ' + hashtagRules + '\n\n'

  if (platformList.includes('Reddit'))
    prompt += '[REDDIT]\nReddit post. First line is "TITLE: " followed by a genuine, non-clickbait title suited to a relevant subreddit. Leave a blank line, then the body (150-200 words). Tone must be authentic, informative and conversational — Reddit users actively downvote obvious ads. Lead with real, useful information before mentioning this is your offer. Avoid marketing buzzwords, hype, excessive emojis and ALL CAPS. End by inviting genuine questions rather than a hard sell. No hashtags.\n\n'

  if (platformList.includes('Quora'))
    prompt += '[QUORA]\nWrite this as a helpful Quora answer (150-200 words) to a realistic question a prospective customer in ' + industryCfg.name + ' would ask. Open with genuine, useful context about ' + marketContext + ', then naturally introduce this specific offer as a real example, including price and key details. Tone: knowledgeable first-person expert, not an advertisement. End with a soft, low-pressure closing. No hashtags.\n\n'

  prompt += '[HEADLINES]\n3 punchy, attention-grabbing headline options (one per line, no numbering, no bullet points). Make each headline specific to the details given.\n\n'
  prompt += 'Write ONLY the sections above. No extra commentary or text outside the sections.'
  return prompt
}
