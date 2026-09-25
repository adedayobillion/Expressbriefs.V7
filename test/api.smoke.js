// End-to-end smoke test for the developer API and its separate API plans.
//   npm run test:api
// Boots the real server on a spare port with a throwaway database and mocked
// Groq + Bachs backends (test/mock-external.js), then drives it over HTTP.
// No API keys, no network, and your real data/ folder is never touched.
const { spawn }  = require('child_process')
const assert     = require('assert')
const crypto     = require('crypto')
const path       = require('path')
const os         = require('os')
const fs         = require('fs')
const Database   = require('better-sqlite3')

const PORT    = 4200 + Math.floor(Math.random() * 500)
const BASE    = 'http://localhost:' + PORT
const DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'eb-test-')), 'test.db')
const ADMIN   = { email: 'admin@test.co', password: 'Sup3rSecret!' }
const WEBHOOK_SECRET = 'whsec_test'

const REAL_ESTATE = {
  industry: 'real-estate',
  fields: { propType: 'Duplex', listingType: 'For Sale', location: 'Lekki Phase 1, Lagos', price: '₦85,000,000' },
  platforms: ['Instagram', 'WhatsApp'],
  tone: 'Luxury'
}

let passed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name) }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); process.exitCode = 1 }
}

async function http(method, url, { body, headers } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let json; try { json = JSON.parse(text) } catch (e) { json = null }
  return { status: res.status, json, text }
}
const bearer = (t) => ({ Authorization: 'Bearer ' + t })

// Deliver a Bachs webhook the way Bachs would: HMAC-SHA256 over "<ts>.<raw body>"
function webhook(event, opts) {
  opts = opts || {}
  const ts   = opts.ts || Math.floor(Date.now() / 1000)
  const body = JSON.stringify(event)
  const sig  = opts.sig || crypto.createHmac('sha256', WEBHOOK_SECRET).update(ts + '.' + body).digest('hex')
  return fetch(BASE + '/api/webhooks/bachs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bachs-signature': sig, 'x-bachs-timestamp': String(ts) },
    body
  })
}
const redirectOf = async (url) => {
  const r = await fetch(BASE + url, { redirect: 'manual' })
  return { status: r.status, location: r.headers.get('location') }
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(BASE + '/api/plans'); if (r.ok) return } catch (e) {}
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error('server did not start')
}

async function main() {
  const server = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, {
      PORT, DB_PATH, GROQ_API_KEY: 'test', JWT_SECRET: 'x'.repeat(40),
      ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password,
      BACHS_API_KEY: 'sk_sandbox_test', BACHS_WEBHOOK_SECRET: WEBHOOK_SECRET,
      BACHS_PRODUCT_STARTER: 'prod_web_starter', BACHS_PRODUCT_API_BUILDER: 'prod_api_builder',
      APP_URL: BASE,
      NODE_OPTIONS: '--require ' + path.join(__dirname, 'mock-external.js')
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let serverLog = ''
  server.stdout.on('data', d => serverLog += d)
  server.stderr.on('data', d => serverLog += d)

  try {
    await waitForServer()
    const db = new Database(DB_PATH)
    const userRow = (id) => db.prepare('SELECT plan, api_plan FROM users WHERE id = ?').get(id)

    // ── Accounts ──────────────────────────────────────────────────────
    const admin = (await http('POST', '/api/auth/login', { body: ADMIN })).json
    const regA = (await http('POST', '/api/auth/register', { body: { name: 'Ada Dev', email: 'ada@test.co', password: 'a-good-password-1' } })).json
    const regB = (await http('POST', '/api/auth/register', { body: { name: 'Bayo Dev', email: 'bayo@test.co', password: 'a-good-password-2' } })).json
    const A = { token: regA.token, id: regA.user.id }
    const B = { token: regB.token, id: regB.user.id }

    // Admin key (scale plan: generous rate limit) is used for validation tests
    const adminKey = (await http('POST', '/api/keys', { headers: bearer(admin.token), body: { name: 'admin key' } })).json.key

    console.log('\nKey management')
    await test('unverified (non-admin) user cannot create a key', async () => {
      const r = await http('POST', '/api/keys', { headers: bearer(A.token), body: { name: 'x' } })
      assert.strictEqual(r.status, 403)
    })
    db.prepare('UPDATE users SET email_verified = 1 WHERE id IN (?, ?)').run(A.id, B.id)

    await test('key creation requires a name', async () => {
      assert.strictEqual((await http('POST', '/api/keys', { headers: bearer(A.token), body: {} })).status, 400)
    })
    let keyA, keyAId
    await test('verified user can create a key; raw key returned once', async () => {
      const r = await http('POST', '/api/keys', { headers: bearer(A.token), body: { name: 'My website' } })
      assert.strictEqual(r.status, 201)
      assert.ok(r.json.key.startsWith('eb_live_') && r.json.key.length > 40)
      keyA = r.json.key; keyAId = r.json.id
    })
    await test('raw key is NOT stored in the database (hash only)', async () => {
      const rows = db.prepare('SELECT * FROM api_keys').all()
      assert.ok(!JSON.stringify(rows).includes(keyA))
      assert.ok(rows.every(r => r.key_hash.length === 64))
    })
    await test('listing keys shows prefix but never the secret', async () => {
      const r = await http('GET', '/api/keys', { headers: bearer(A.token) })
      assert.strictEqual(r.json.keys.length, 1)
      assert.ok(!r.text.includes(keyA))
      assert.ok(keyA.startsWith(r.json.keys[0].key_prefix))
    })
    await test('/api/keys requires login', async () => {
      assert.strictEqual((await http('GET', '/api/keys')).status, 401)
    })
    await test('max 5 active keys per user', async () => {
      for (let i = 0; i < 4; i++) await http('POST', '/api/keys', { headers: bearer(A.token), body: { name: 'k' + i } })
      assert.strictEqual((await http('POST', '/api/keys', { headers: bearer(A.token), body: { name: 'one too many' } })).status, 400)
      const keys = (await http('GET', '/api/keys', { headers: bearer(A.token) })).json.keys
      for (const k of keys) if (k.id !== keyAId) await http('DELETE', '/api/keys/' + k.id, { headers: bearer(A.token) })
    })
    await test("a user cannot revoke someone else's key", async () => {
      assert.strictEqual((await http('DELETE', '/api/keys/' + keyAId, { headers: bearer(admin.token) })).status, 404)
    })

    console.log('\nAuthentication')
    await test('no key → 401 missing_api_key', async () => {
      const r = await http('POST', '/api/v1/generate', { body: REAL_ESTATE })
      assert.strictEqual(r.status, 401); assert.strictEqual(r.json.error.code, 'missing_api_key')
    })
    await test('garbage key → 401 invalid_api_key', async () => {
      const r = await http('POST', '/api/v1/generate', { headers: bearer('eb_live_nope'), body: REAL_ESTATE })
      assert.strictEqual(r.status, 401); assert.strictEqual(r.json.error.code, 'invalid_api_key')
    })
    await test('a website JWT is not accepted as an API key', async () => {
      assert.strictEqual((await http('POST', '/api/v1/generate', { headers: bearer(A.token), body: REAL_ESTATE })).status, 401)
    })

    console.log('\nAPI plans')
    await test('GET /v1/plans is public and lists the tiers', async () => {
      const r = await http('GET', '/api/v1/plans')
      assert.strictEqual(r.status, 200)
      assert.deepStrictEqual(r.json.plans.map(p => p.name), ['developer', 'builder', 'growth', 'scale'])
      assert.strictEqual(r.json.plans[0].price_usd, 0)
      assert.ok(r.json.plans.every(p => p.monthly_limit > 0 && p.rate_limit_per_min > 0))
    })
    await test('new accounts start on the free developer API plan', async () => {
      const r = await http('GET', '/api/keys', { headers: bearer(A.token) })
      assert.strictEqual(r.json.api.plan, 'developer'); assert.strictEqual(r.json.api.limit, 10)
      assert.strictEqual(r.json.api.used, 0); assert.strictEqual(r.json.account.email, 'ada@test.co')
      assert.strictEqual(userRow(A.id).plan, 'free')   // website plan is independent
    })

    console.log('\nGeneration')
    await test('Bearer auth generates structured captions', async () => {
      const r = await http('POST', '/api/v1/generate', { headers: bearer(keyA), body: REAL_ESTATE })
      assert.strictEqual(r.status, 200, r.text)
      assert.deepStrictEqual(r.json.platforms, ['Instagram', 'WhatsApp'])
      assert.ok(r.json.captions.instagram && r.json.captions.whatsapp && r.json.captions.full_listing)
      assert.strictEqual(r.json.captions.headlines.length, 3)
      assert.ok(!('facebook' in r.json.captions))
      assert.deepStrictEqual([r.json.usage.plan, r.json.usage.used, r.json.usage.limit], ['developer', 1, 10])
    })
    await test('X-API-Key header works too; platform names are case-insensitive', async () => {
      const r = await http('POST', '/api/v1/generate', { headers: { 'X-API-Key': keyA }, body: Object.assign({}, REAL_ESTATE, { platforms: ['tiktok', 'TIKTOK'] }) })
      assert.strictEqual(r.status, 200, r.text)
      assert.deepStrictEqual(r.json.platforms, ['TikTok'])
      assert.strictEqual(r.json.usage.used, 2)
    })
    await test('usage is attributed to the key', async () => {
      const k = (await http('GET', '/api/keys', { headers: bearer(A.token) })).json.keys[0]
      assert.strictEqual(k.used_this_month, 2); assert.ok(k.last_used_at)
    })
    await test('GET /v1/usage reports the API plan', async () => {
      const r = await http('GET', '/api/v1/usage', { headers: bearer(keyA) })
      assert.deepStrictEqual([r.json.plan, r.json.used, r.json.limit, r.json.rate_limit_per_min], ['developer', 2, 10, 10])
    })

    console.log('\nValidation (admin key)')
    const v = async (patch, needle) => {
      const r = await http('POST', '/api/v1/generate', { headers: bearer(adminKey), body: Object.assign({}, REAL_ESTATE, patch) })
      assert.strictEqual(r.status, 400, r.text); assert.strictEqual(r.json.error.code, 'invalid_request')
      if (needle) assert.ok(r.json.error.message.includes(needle), r.json.error.message)
    }
    await test('missing industry', () => v({ industry: undefined }, 'industry'))
    await test('unknown industry', () => v({ industry: 'nope' }, 'industry'))
    await test('inherited-property industry ("constructor") is rejected, not a crash', () => v({ industry: 'constructor' }, 'industry'))
    await test('__proto__ industry is rejected', () => v({ industry: '__proto__' }, 'industry'))
    await test('fields must be an object', () => v({ fields: 'hello' }, 'fields'))
    await test('platforms required', () => v({ platforms: [] }, 'platforms'))
    await test('unknown platform', () => v({ platforms: ['MySpace'] }, 'MySpace'))
    await test('unknown tone', () => v({ tone: 'Grumpy' }, 'tone'))
    await test('missing required industry field → 400 (not 500)', () => v({ fields: { propType: 'Duplex' } }, 'Missing required'))
    await test('validation failures do not consume quota', async () => {
      assert.strictEqual((await http('GET', '/api/v1/usage', { headers: bearer(adminKey) })).json.used, 0)
    })

    console.log('\nWebsite and API are metered separately')
    await test('API usage does not eat the website quota', async () => {
      const me = (await http('GET', '/api/auth/me', { headers: bearer(A.token) })).json
      assert.strictEqual(me.usage.used, 0)      // 2 API generations, 0 website generations
      assert.strictEqual(me.usage.limit, 5)
    })
    await test('a website generation does not eat the API quota', async () => {
      const r = await http('POST', '/api/generate', { headers: bearer(A.token), body: REAL_ESTATE })
      assert.strictEqual(r.status, 200, r.text); assert.strictEqual(r.json.usage.used, 1)
      assert.strictEqual((await http('GET', '/api/v1/usage', { headers: bearer(keyA) })).json.used, 2)
    })

    console.log('\nQuota and upgrading (developer → builder)')
    await test('API quota is enforced (developer = 10) with limit_reached + upgrade_url', async () => {
      const ins = db.prepare("INSERT INTO generations (user_id, industry, api_key_id) VALUES (?, 'real-estate', ?)")
      for (let i = 0; i < 8; i++) ins.run(A.id, keyAId)          // 2 real + 8 = 10 used
      const r = await http('POST', '/api/v1/generate', { headers: bearer(keyA), body: REAL_ESTATE })
      assert.strictEqual(r.status, 429); assert.strictEqual(r.json.error.code, 'limit_reached')
      assert.strictEqual(r.json.error.upgrade, true)
      assert.strictEqual(r.json.error.upgrade_url, BASE + '/developers/#plans')
    })
    await test('...while the website still works for the same user', async () => {
      assert.strictEqual((await http('POST', '/api/generate', { headers: bearer(A.token), body: REAL_ESTATE })).status, 200)
    })
    await test('checkout rejects the free tier, unknown plans and prototype names', async () => {
      for (const plan of ['developer', 'nope', 'constructor', '__proto__']) {
        const r = await http('POST', '/api/payment/initialize', { headers: bearer(A.token), body: { kind: 'api', plan } })
        assert.strictEqual(r.status, 400, plan + ': ' + r.text)
      }
    })
    await test('paid plan without a configured Bachs product → clear 500, no payment row', async () => {
      const r = await http('POST', '/api/payment/initialize', { headers: bearer(A.token), body: { kind: 'api', plan: 'growth' } })
      assert.strictEqual(r.status, 500); assert.ok(r.json.error.includes('BACHS_PRODUCT_API_GROWTH'))
    })
    let ref
    await test('checkout for an API plan returns a Bachs URL and records an api payment', async () => {
      const r = await http('POST', '/api/payment/initialize', { headers: bearer(A.token), body: { kind: 'api', plan: 'builder' } })
      assert.strictEqual(r.status, 200, r.text)
      assert.ok(r.json.authorization_url.startsWith('https://checkout.bachs.test/pay/'))
      ref = r.json.reference
      const p = db.prepare('SELECT * FROM payments WHERE reference = ?').get(ref)
      assert.deepStrictEqual([p.kind, p.plan, p.industry, p.amount, p.status], ['api', 'builder', 'developers', 1000, 'pending'])
    })
    await test('returning before the webhook lands shows "processing" on /developers', async () => {
      const r = await redirectOf('/api/payment/verify?ref=' + ref)
      assert.strictEqual(r.location, '/developers/?payment=processing&ref=' + ref)
    })
    await test('plan is NOT granted by the redirect or the status poll alone', async () => {
      assert.strictEqual(userRow(A.id).api_plan, 'developer')
      assert.strictEqual((await http('GET', '/api/payment/status?ref=' + ref)).json.status, 'pending')
    })
    await test('forged webhook signature is rejected', async () => {
      const r = await webhook({ type: 'collection.succeeded', data: { reference: ref } }, { sig: 'f'.repeat(64) })
      assert.strictEqual(r.status, 400); assert.strictEqual(userRow(A.id).api_plan, 'developer')
    })
    await test('stale webhook timestamp is rejected (replay protection)', async () => {
      const r = await webhook({ type: 'collection.succeeded', data: { reference: ref } }, { ts: Math.floor(Date.now() / 1000) - 3600 })
      assert.strictEqual(r.status, 400); assert.strictEqual(userRow(A.id).api_plan, 'developer')
    })
    await test('signed webhook upgrades the API plan only, not the website plan', async () => {
      const r = await webhook({ type: 'collection.succeeded', data: { reference: ref } })
      assert.strictEqual(r.status, 200)
      assert.deepStrictEqual(userRow(A.id), { plan: 'free', api_plan: 'builder' })
    })
    await test('replayed webhook is harmless', async () => {
      assert.strictEqual((await webhook({ type: 'collection.succeeded', data: { reference: ref } })).status, 200)
      assert.strictEqual(userRow(A.id).api_plan, 'builder')
    })
    await test('after payment, /developers shows success and status is success', async () => {
      assert.strictEqual((await redirectOf('/api/payment/verify?ref=' + ref)).location, '/developers/?payment=success')
      assert.strictEqual((await http('GET', '/api/payment/status?ref=' + ref)).json.status, 'success')
    })
    await test('the new limit and rate limit apply immediately, on the same key', async () => {
      const r = await http('POST', '/api/v1/generate', { headers: bearer(keyA), body: REAL_ESTATE })
      assert.strictEqual(r.status, 200, r.text)
      assert.deepStrictEqual([r.json.usage.plan, r.json.usage.limit], ['builder', 300])
      assert.strictEqual((await http('GET', '/api/v1/usage', { headers: bearer(keyA) })).json.rate_limit_per_min, 30)
    })
    await test('cannot "buy" the plan you are on (or a lower one)', async () => {
      const r = await http('POST', '/api/payment/initialize', { headers: bearer(A.token), body: { kind: 'api', plan: 'builder' } })
      assert.strictEqual(r.status, 400)
    })
    await test('failed payment leaves the plan untouched', async () => {
      const r = await http('POST', '/api/payment/initialize', { headers: bearer(B.token), body: { kind: 'api', plan: 'builder' } })
      await webhook({ type: 'collection.failed', data: { reference: r.json.reference } })
      assert.strictEqual(userRow(B.id).api_plan, 'developer')
      assert.strictEqual((await redirectOf('/api/payment/verify?ref=' + r.json.reference)).location, '/developers/?payment=failed')
    })

    console.log('\nWebsite billing regression')
    await test('a website plan purchase still upgrades the website plan only', async () => {
      const r = await http('POST', '/api/payment/initialize', { headers: bearer(B.token), body: { plan: 'starter', industry: 'real-estate' } })
      assert.strictEqual(r.status, 200, r.text)
      const p = db.prepare('SELECT kind, industry FROM payments WHERE reference = ?').get(r.json.reference)
      assert.deepStrictEqual(p, { kind: 'website', industry: 'real-estate' })
      await webhook({ type: 'collection.succeeded', data: { reference: r.json.reference } })
      assert.deepStrictEqual(userRow(B.id), { plan: 'starter', api_plan: 'developer' })
      assert.strictEqual((await redirectOf('/api/payment/verify?ref=' + r.json.reference)).location, '/real-estate/?payment=success')
    })

    console.log('\nPer-plan rate limits')
    let keyB
    await test('developer tier allows 10 requests/minute, then rate_limited', async () => {
      keyB = (await http('POST', '/api/keys', { headers: bearer(B.token), body: { name: 'B key' } })).json.key
      for (let i = 0; i < 10; i++) assert.strictEqual((await http('GET', '/api/v1/usage', { headers: bearer(keyB) })).status, 200, 'request ' + (i + 1))
      const r = await http('GET', '/api/v1/usage', { headers: bearer(keyB) })
      assert.strictEqual(r.status, 429); assert.strictEqual(r.json.error.code, 'rate_limited')
      assert.ok(r.json.error.message.includes('developer') && r.json.error.message.includes('10'))
    })
    await test('upgrading the plan lifts the rate limit immediately', async () => {
      db.prepare("UPDATE users SET api_plan = 'growth' WHERE id = ?").run(B.id)
      const r = await http('GET', '/api/v1/usage', { headers: bearer(keyB) })
      assert.strictEqual(r.status, 200); assert.strictEqual(r.json.rate_limit_per_min, 60)
    })

    console.log('\nAdmin')
    await test('admin key runs on the top plan', async () => {
      const r = await http('GET', '/api/v1/usage', { headers: bearer(adminKey) })
      assert.deepStrictEqual([r.json.plan, r.json.limit], ['scale', 6000])
    })
    await test('admin can set a user\'s API plan; invalid plan / non-admin are refused', async () => {
      assert.strictEqual((await http('POST', '/api/admin/set-api-plan', { headers: bearer(admin.token), body: { userId: A.id, plan: 'growth' } })).status, 200)
      assert.strictEqual(userRow(A.id).api_plan, 'growth')
      assert.strictEqual((await http('POST', '/api/admin/set-api-plan', { headers: bearer(admin.token), body: { userId: A.id, plan: 'bogus' } })).status, 400)
      assert.strictEqual((await http('POST', '/api/admin/set-api-plan', { headers: bearer(A.token), body: { userId: A.id, plan: 'scale' } })).status, 403)
    })
    await test('admin user list includes each user\'s api_plan', async () => {
      const users = (await http('GET', '/api/admin/users', { headers: bearer(admin.token) })).json
      assert.strictEqual(users.find(u => u.email === 'ada@test.co').api_plan, 'growth')
    })

    console.log('\nLifecycle, discovery & website regression')
    await test('revoked key stops working immediately', async () => {
      assert.strictEqual((await http('DELETE', '/api/keys/' + keyAId, { headers: bearer(A.token) })).status, 200)
      const r = await http('POST', '/api/v1/generate', { headers: bearer(keyA), body: REAL_ESTATE })
      assert.strictEqual(r.status, 401); assert.strictEqual(r.json.error.code, 'invalid_api_key')
    })
    await test('GET /v1/industries is public and lists all 11 industries', async () => {
      const r = await http('GET', '/api/v1/industries')
      assert.strictEqual(r.json.industries.length, 11); assert.ok(r.json.platforms.includes('Instagram'))
    })
    await test('GET /v1/industries/:slug returns the field schema', async () => {
      assert.ok((await http('GET', '/api/v1/industries/automotive')).json.fields.length > 0)
    })
    await test('unknown /v1 route → JSON 404 in API error format', async () => {
      const r = await http('GET', '/api/v1/nope')
      assert.strictEqual(r.status, 404); assert.strictEqual(r.json.error.code, 'not_found')
    })
    await test('website /api/generate keeps its response shape', async () => {
      const r = await http('POST', '/api/generate', { headers: bearer(admin.token), body: REAL_ESTATE })
      assert.strictEqual(r.status, 200, r.text)
      assert.ok(typeof r.json.content === 'string' && 'used' in r.json.usage)
    })
    await test('website limit message is unchanged for website users', async () => {
      db.prepare("INSERT INTO generations (user_id, industry) VALUES (?, 'real-estate')").run(A.id)
      db.prepare("INSERT INTO generations (user_id, industry) VALUES (?, 'real-estate')").run(A.id)
      db.prepare("INSERT INTO generations (user_id, industry) VALUES (?, 'real-estate')").run(A.id)
      db.prepare("INSERT INTO generations (user_id, industry) VALUES (?, 'real-estate')").run(A.id)
      const r = await http('POST', '/api/generate', { headers: bearer(A.token), body: REAL_ESTATE })
      assert.strictEqual(r.status, 429); assert.strictEqual(r.json.error, 'Monthly limit reached (5 generations). Please upgrade.')
      assert.strictEqual(r.json.upgrade, true)
    })
    await test('website /api/generate no longer crashes the server on industry="constructor"', async () => {
      assert.strictEqual((await http('POST', '/api/generate', { headers: bearer(admin.token), body: { industry: 'constructor' } })).status, 400)
      assert.strictEqual((await http('GET', '/api/plans')).status, 200)
    })
    await test('CORS preflight allows the X-API-Key header', async () => {
      const res = await fetch(BASE + '/api/v1/generate', { method: 'OPTIONS', headers: {
        Origin: 'https://customer-site.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-api-key,content-type' } })
      assert.ok((res.headers.get('access-control-allow-headers') || '').toLowerCase().includes('x-api-key'))
    })

    console.log('\nMigration')
    await test('a database from before the API is upgraded in place; existing users get the free API plan', async () => {
      const old = path.join(path.dirname(DB_PATH), 'old.db')
      const o = new Database(old)
      o.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL DEFAULT 'free', is_admin INTEGER NOT NULL DEFAULT 0, email_verified INTEGER NOT NULL DEFAULT 0, failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_login TEXT);
        CREATE TABLE generations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, industry TEXT DEFAULT 'real-estate', property TEXT, location TEXT, platforms TEXT, tokens_used INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
        CREATE TABLE payments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, reference TEXT UNIQUE NOT NULL, plan TEXT NOT NULL, amount INTEGER NOT NULL, industry TEXT DEFAULT 'real-estate', status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now')));
        INSERT INTO users (email, password, name, plan) VALUES ('legacy@test.co', 'x', 'Legacy', 'pro');
        INSERT INTO payments (user_id, reference, plan, amount) VALUES (1, 'BCH_OLD', 'pro', 1200);`)
      o.close()
      const out = require('child_process').spawnSync('node', ['-e', `
        const d = require('./database');
        const u = d.db.prepare("SELECT plan, api_plan FROM users").get();
        const p = d.db.prepare("SELECT kind FROM payments").get();
        const g = d.db.prepare("PRAGMA table_info(generations)").all().map(c => c.name).includes('api_key_id');
        console.log(JSON.stringify([u, p, g, d.listApiPlans.all().length]))`],
        { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { DB_PATH: old }), encoding: 'utf8' })
      assert.deepStrictEqual(JSON.parse(out.stdout.trim()), [{ plan: 'pro', api_plan: 'developer' }, { kind: 'website' }, true, 4], out.stderr)
    })

    console.log('\n' + passed + ' checks passed' + (process.exitCode ? ' — WITH FAILURES' : ''))
  } catch (e) {
    console.error('\nFATAL:', e.stack || e.message); console.error('--- server log ---\n' + serverLog)
    process.exitCode = 1
  } finally {
    server.kill()
  }
}
main()
