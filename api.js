// ────────────────────────────────────────────────────────────────────────
// DEVELOPER API
//
// Lets other people integrate Express Briefs into their own sites and apps.
//
//   Dashboard (logged-in user, JWT — same auth as the website):
//     GET    /api/keys         list your API keys
//     POST   /api/keys         create a key  { name }   (raw key returned ONCE)
//     DELETE /api/keys/:id     revoke a key
//
//   Public API (API key — "Authorization: Bearer eb_live_..." or X-API-Key):
//     POST   /api/v1/generate  generate captions, returns structured JSON
//     GET    /api/v1/usage     API plan + monthly usage for the key's account
//     GET    /api/v1/plans     available API plans and prices (no key needed)
//     GET    /api/v1/industries, /api/v1/industries/:slug   (no key needed)
//
// API calls are metered against the key owner's separate API PLAN (developer /
// builder / growth / scale — see database.js), not their website plan, so the
// two are bought and used independently. The plan sets both the monthly quota
// and the per-key requests/minute. Everything else (prompting, Groq call,
// logging) is shared with the website via generateForUser() in server.js.
// ────────────────────────────────────────────────────────────────────────
const express   = require('express')
const crypto    = require('crypto')
const rateLimit = require('express-rate-limit')
const {
  getUserById, countMonthlyApiGenerations, listApiPlans, apiPlanFor,
  createApiKey, getApiKeyById, getApiKeyByHash, countActiveApiKeys,
  touchApiKey, revokeApiKey, listApiKeys
} = require('./database')

const KEY_PREFIX        = 'eb_live_'
const MAX_KEYS_PER_USER = 5

// Keys are 256 bits of randomness, so a fast hash (SHA-256) is appropriate —
// unlike passwords, they can't be brute-forced or dictionary-attacked.
const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex')

function generateKey() {
  const key = KEY_PREFIX + crypto.randomBytes(32).toString('base64url')
  return { key, hash: hashKey(key), prefix: key.slice(0, KEY_PREFIX.length + 6) }
}

// Public API errors are always { error: { code, message } } so client code can
// branch on a stable `code` instead of parsing human-readable text.
function apiError(res, status, code, message, extra) {
  return res.status(status).json({ error: Object.assign({ code, message }, extra || {}) })
}

function nextMonthStartISO() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}

function createApiRouter(deps) {
  const { requireAuth, sanitize, generateForUser, parseSections, GenError, industries, PLATFORMS, TONES, APP_URL } = deps
  const router = express.Router()
  const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k)

  // ── API-key authentication ────────────────────────────────────────────
  function requireApiKey(req, res, next) {
    let key = req.headers['x-api-key']
    if (!key) {
      const auth = req.headers.authorization
      if (auth && auth.startsWith('Bearer ')) key = auth.slice(7)
    }
    if (typeof key !== 'string' || !key.trim()) {
      return apiError(res, 401, 'missing_api_key',
        'No API key provided. Send it as "Authorization: Bearer eb_live_..." or in the X-API-Key header.')
    }
    key = key.trim()
    const row = key.startsWith(KEY_PREFIX) ? getApiKeyByHash.get(hashKey(key)) : null
    if (!row) return apiError(res, 401, 'invalid_api_key', 'API key is invalid or has been revoked.')

    const user = getUserById.get(row.user_id)
    if (!user) return apiError(res, 401, 'invalid_api_key', 'API key is invalid or has been revoked.')

    touchApiKey.run(row.id)
    req.apiKey  = row
    req.apiUser = user
    req.apiPlan = apiPlanFor(user)
    next()
  }

  // Per-key throttle (on top of the site-wide per-IP limiter) so one
  // integration can't hog the AI backend. The allowance comes from the key
  // owner's API plan, evaluated on every request, so an upgrade applies
  // immediately. Runs after requireApiKey.
  const keyLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: (req) => req.apiPlan.rate_limit_per_min,
    keyGenerator: (req) => 'key:' + req.apiKey.id,
    standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => apiError(res, 429, 'rate_limited',
      'Too many requests. Your ' + req.apiPlan.name + ' plan allows ' + req.apiPlan.rate_limit_per_min + ' per minute per API key.',
      { upgrade_url: APP_URL + '/developers/#plans' })
  })

  // Shared shape for "how much API quota does this user have" (dashboard + /v1/usage)
  function apiUsageFor(user) {
    const plan = apiPlanFor(user)
    return {
      plan: plan.name,
      used: countMonthlyApiGenerations.get(user.id).count,
      limit: plan.monthly_limit,
      rate_limit_per_min: plan.rate_limit_per_min,
      resets_at: nextMonthStartISO()
    }
  }

  // ── Key management (used by the /developers dashboard) ────────────────
  const keyMgmtLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 30,
    message: { error: 'Too many key operations. Try again later.' },
    standardHeaders: true, legacyHeaders: false
  })

  router.get('/keys', requireAuth, (req, res) => {
    const user = getUserById.get(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found.' })
    res.json({
      keys: listApiKeys.all(user.id),
      max_keys: MAX_KEYS_PER_USER,
      account: { email: user.email, name: user.name },
      api: apiUsageFor(user)
    })
  })

  router.post('/keys', requireAuth, keyMgmtLimiter, (req, res) => {
    const user = getUserById.get(req.user.id)
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (!user.email_verified && !user.is_admin) {
      return res.status(403).json({ error: 'Please verify your email address before creating an API key.' })
    }
    const name = sanitize(req.body.name, 60)
    if (!name) return res.status(400).json({ error: 'Give your key a name (e.g. "My website").' })
    if (countActiveApiKeys.get(user.id).count >= MAX_KEYS_PER_USER) {
      return res.status(400).json({ error: 'You can have up to ' + MAX_KEYS_PER_USER + ' active API keys. Revoke one first.' })
    }

    const { key, hash, prefix } = generateKey()
    const result = createApiKey.run(user.id, name, hash, prefix)
    const row = getApiKeyById.get(result.lastInsertRowid)
    // `key` is the only time the raw secret is ever exposed.
    res.status(201).json({ key, id: row.id, name: row.name, key_prefix: row.key_prefix, created_at: row.created_at })
  })

  router.delete('/keys/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (!id) return res.status(400).json({ error: 'Invalid key ID.' })
    const result = revokeApiKey.run(id, req.user.id)
    if (!result.changes) return res.status(404).json({ error: 'Key not found.' })
    res.json({ success: true })
  })

  // ── Public API v1 ─────────────────────────────────────────────────────
  router.post('/v1/generate', requireApiKey, keyLimiter, async (req, res) => {
    const b = req.body || {}
    const bad = (msg) => apiError(res, 400, 'invalid_request', msg)

    if (typeof b.industry !== 'string' || !has(industries, b.industry)) {
      return bad('"industry" is required and must be one of: ' + Object.keys(industries).join(', ') + '.')
    }
    if (!b.fields || typeof b.fields !== 'object' || Array.isArray(b.fields)) {
      return bad('"fields" must be an object. See GET /api/v1/industries/' + b.industry + ' for the fields this industry expects.')
    }

    // platforms: required, matched case-insensitively against the known list
    if (!Array.isArray(b.platforms) || b.platforms.length === 0) {
      return bad('"platforms" must be a non-empty array. Valid values: ' + PLATFORMS.join(', ') + '.')
    }
    const platforms = []
    for (const p of b.platforms) {
      const match = PLATFORMS.find(x => x.toLowerCase() === String(p).trim().toLowerCase())
      if (!match) return bad('Unknown platform "' + sanitize(String(p), 30) + '". Valid values: ' + PLATFORMS.join(', ') + '.')
      if (!platforms.includes(match)) platforms.push(match)
    }

    // tone: optional, defaults to Professional
    let tone = 'Professional'
    if (b.tone !== undefined) {
      const match = TONES.find(t => t.key.toLowerCase() === String(b.tone).trim().toLowerCase())
      if (!match) return bad('Unknown tone. Valid values: ' + TONES.map(t => t.key).join(', ') + '.')
      tone = match.key
    }

    if (b.features !== undefined && (!Array.isArray(b.features) || b.features.some(f => typeof f !== 'string'))) {
      return bad('"features" must be an array of strings.')
    }
    if (b.extra !== undefined && typeof b.extra !== 'string') return bad('"extra" must be a string.')

    try {
      const result = await generateForUser(req.apiUser, {
        industry: b.industry, fields: b.fields, platforms, tone,
        features: b.features || [], extra: b.extra || ''
      }, { apiKeyId: req.apiKey.id })

      res.json({
        industry: result.industry,
        platforms,
        tone,
        captions: parseSections(result.content),   // { full_listing, instagram, ..., headlines: [] }
        raw: result.content,                        // unparsed model output, as a fallback
        truncated: result.truncated,                // true if output hit the length cap — request fewer platforms
        usage: {
          used: result.usage.used,
          limit: result.usage.limit,
          plan: req.apiPlan.name,
          resets_at: nextMonthStartISO()
        }
      })
    } catch (err) {
      if (err instanceof GenError) {
        // Never leak internal configuration details to third parties.
        if (err.code === 'server_misconfigured') {
          return apiError(res, 503, 'service_unavailable', 'The service is temporarily unavailable. Please try again later.')
        }
        if (err.code === 'unknown_industry' || err.code === 'missing_fields') return bad(err.message)
        return apiError(res, err.status, err.code, err.message, err.extra)
      }
      console.error('[API v1 GENERATE ERROR]', err.message)
      return apiError(res, 500, 'internal_error', 'Something went wrong. Please try again.')
    }
  })

  router.get('/v1/usage', requireApiKey, keyLimiter, (req, res) => {
    res.json(apiUsageFor(req.apiUser))
  })

  // Public price list, so the docs page (and integrators) never drift from the DB.
  router.get('/v1/plans', (req, res) => res.json({ plans: listApiPlans.all() }))

  // Discovery endpoints — public, so integrators can build forms from them.
  router.get('/v1/industries', (req, res) => {
    const list = Object.values(industries).map(({ slug, name, tagline, entityLabel, audience }) =>
      ({ slug, name, tagline, entityLabel, audience }))
    res.json({ industries: list, platforms: PLATFORMS, tones: TONES.map(t => t.key) })
  })

  router.get('/v1/industries/:slug', (req, res) => {
    if (!has(industries, req.params.slug)) return apiError(res, 404, 'not_found', 'Unknown industry.')
    const { slug, name, entityLabel, fields, features } = industries[req.params.slug]
    res.json({ slug, name, entityLabel, fields, features, platforms: PLATFORMS, tones: TONES.map(t => t.key) })
  })

  // Anything else under /v1 is a JSON 404 in the public API's error format.
  router.use('/v1', (req, res) => apiError(res, 404, 'not_found', 'Unknown API endpoint.'))

  return router
}

module.exports = { createApiRouter }
