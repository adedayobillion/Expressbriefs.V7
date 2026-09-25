const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

// DB_PATH lets you point the database at a persistent volume in production
// (e.g. DB_PATH=/data/expressbriefs.db on Railway) or a temp file in tests.
const dbPath  = process.env.DB_PATH || path.join(__dirname, 'data', 'expressbriefs.db')
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(dbPath)

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')

// ── Create Tables ──────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT    UNIQUE NOT NULL,
    password       TEXT    NOT NULL,
    name           TEXT    NOT NULL DEFAULT '',
    plan           TEXT    NOT NULL DEFAULT 'free',
    api_plan       TEXT    NOT NULL DEFAULT 'developer',
    is_admin       INTEGER NOT NULL DEFAULT 0,
    email_verified INTEGER NOT NULL DEFAULT 0,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until   TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login     TEXT
  );

  CREATE TABLE IF NOT EXISTS generations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    industry     TEXT DEFAULT 'real-estate',
    property     TEXT,
    location     TEXT,
    platforms    TEXT,
    tokens_used  INTEGER DEFAULT 0,
    api_key_id   INTEGER,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plans (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT UNIQUE NOT NULL,
    monthly_limit INTEGER NOT NULL,
    price_usd     INTEGER NOT NULL,
    description   TEXT
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    token      TEXT    UNIQUE NOT NULL,
    expires_at TEXT    NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_verify_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    token      TEXT    UNIQUE NOT NULL,
    expires_at TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    reference  TEXT    UNIQUE NOT NULL,
    plan       TEXT    NOT NULL,
    amount     INTEGER NOT NULL,
    industry   TEXT    DEFAULT 'real-estate',
    kind       TEXT    NOT NULL DEFAULT 'website',
    status     TEXT    NOT NULL DEFAULT 'pending',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Developer API plans. Separate from the website plans above: API calls are
  -- metered and billed on their own, so a user can be on (say) the free website
  -- plan and a paid API plan at the same time.
  CREATE TABLE IF NOT EXISTS api_plans (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT UNIQUE NOT NULL,
    monthly_limit      INTEGER NOT NULL,
    price_usd          INTEGER NOT NULL,
    rate_limit_per_min INTEGER NOT NULL,
    description        TEXT
  );

  -- Developer API keys. Only the SHA-256 hash of a key is stored; the raw key
  -- is shown to the user exactly once, at creation. key_prefix is a short,
  -- non-secret fragment kept so people can tell their keys apart in the UI.
  CREATE TABLE IF NOT EXISTS api_keys (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    name         TEXT    NOT NULL,
    key_hash     TEXT    UNIQUE NOT NULL,
    key_prefix   TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    revoked_at   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
`)

// ── Migration: add industry column if this DB predates it ─────────────────────
try {
  const paymentCols = db.prepare("PRAGMA table_info(payments)").all().map(c => c.name)
  if (!paymentCols.includes('industry')) db.exec("ALTER TABLE payments ADD COLUMN industry TEXT DEFAULT 'real-estate'")
} catch (e) { console.error('[MIGRATION] payments.industry column:', e.message) }

// ── Migration: add industry column if this DB predates it ─────────────────────
try {
  const cols = db.prepare("PRAGMA table_info(generations)").all().map(c => c.name)
  if (!cols.includes('industry')) db.exec("ALTER TABLE generations ADD COLUMN industry TEXT DEFAULT 'real-estate'")
} catch (e) { console.error('[MIGRATION] industry column:', e.message) }

// ── Migration: add api_key_id column if this DB predates the developer API ────
try {
  const cols = db.prepare("PRAGMA table_info(generations)").all().map(c => c.name)
  if (!cols.includes('api_key_id')) db.exec("ALTER TABLE generations ADD COLUMN api_key_id INTEGER")
  db.exec("CREATE INDEX IF NOT EXISTS idx_generations_key ON generations(api_key_id)")
} catch (e) { console.error('[MIGRATION] api_key_id column:', e.message) }

// ── Migration: separate API plans (users.api_plan, payments.kind) ─────────────
try {
  const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name)
  if (!userCols.includes('api_plan')) db.exec("ALTER TABLE users ADD COLUMN api_plan TEXT NOT NULL DEFAULT 'developer'")
  const payCols = db.prepare("PRAGMA table_info(payments)").all().map(c => c.name)
  if (!payCols.includes('kind')) db.exec("ALTER TABLE payments ADD COLUMN kind TEXT NOT NULL DEFAULT 'website'")
} catch (e) { console.error('[MIGRATION] api_plan/kind columns:', e.message) }

// ── Seed API Plans (USD) ───────────────────────────────────────────────────────
// EDIT THESE to set your API tiers. Unlike the website plans below, this is an
// upsert, so changing a number here and restarting updates the live database.
//   [name, monthly generations, price in USD, requests/minute per key, description]
// price_usd is what the developers page DISPLAYS. What customers are actually
// charged is the price on the matching product in your Bachs dashboard, so keep
// the two in sync. 'developer' is the free tier every account starts on.
const API_PLANS = [
  ['developer', 10,   0,   10,  'Free. Build and test your integration.'],
  ['builder',   300,  10,  30,  'For a live site or app with steady traffic.'],
  ['growth',    1500, 39,  60,  'For products serving many customers.'],
  ['scale',     6000, 129, 120, 'High volume, with the most headroom.']
]
const upsertApiPlan = db.prepare(`
  INSERT INTO api_plans (name, monthly_limit, price_usd, rate_limit_per_min, description)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET
    monthly_limit = excluded.monthly_limit, price_usd = excluded.price_usd,
    rate_limit_per_min = excluded.rate_limit_per_min, description = excluded.description
`)
for (const p of API_PLANS) upsertApiPlan.run(...p)

// ── Seed Plans (USD) ───────────────────────────────────────────────────────────
const insertPlan = db.prepare(`
  INSERT OR IGNORE INTO plans (name, monthly_limit, price_usd, description)
  VALUES (?, ?, ?, ?)
`)
insertPlan.run('free',    5,    0,   '5 listings/month — try before you buy')
insertPlan.run('starter', 50,  5,   '50 listings/month — perfect for independent agents')
insertPlan.run('pro',     200, 12,  '200 listings/month — serious agents and brokers')
insertPlan.run('agency',  999, 25,  '999 listings/month — teams and large brokerages')

// ── User Helpers ───────────────────────────────────────────────────────────────
const getUser         = db.prepare('SELECT * FROM users WHERE email = ?')
const getUserById     = db.prepare('SELECT * FROM users WHERE id = ?')
const createUser      = db.prepare('INSERT INTO users (email, password, name, plan, is_admin) VALUES (?, ?, ?, ?, ?)')
const updateLastLogin = db.prepare("UPDATE users SET last_login = datetime('now'), failed_attempts = 0, locked_until = NULL WHERE id = ?")
const updatePlan      = db.prepare('UPDATE users SET plan = ? WHERE id = ?')
const setEmailVerified= db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?')
const updatePassword  = db.prepare('UPDATE users SET password = ? WHERE id = ?')
const incrementFailedAttempts = db.prepare(`
  UPDATE users SET
    failed_attempts = failed_attempts + 1,
    locked_until = CASE WHEN failed_attempts + 1 >= 5
      THEN datetime('now', '+15 minutes') ELSE locked_until END
  WHERE id = ?
`)
const resetFailedAttempts = db.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?")

// ── Password Reset ─────────────────────────────────────────────────────────────
const createResetToken    = db.prepare(`INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))`)
const getResetToken       = db.prepare(`SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')`)
const markResetTokenUsed  = db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?')
const deleteOldResetTokens= db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?')

// ── Email Verification ─────────────────────────────────────────────────────────
const createVerifyToken = db.prepare(`INSERT OR REPLACE INTO email_verify_tokens (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+24 hours'))`)
const getVerifyToken    = db.prepare(`SELECT * FROM email_verify_tokens WHERE token = ? AND expires_at > datetime('now')`)
const deleteVerifyToken = db.prepare('DELETE FROM email_verify_tokens WHERE user_id = ?')

// ── Payments ───────────────────────────────────────────────────────────────────
const createPayment      = db.prepare('INSERT INTO payments (user_id, reference, plan, amount, industry, kind) VALUES (?, ?, ?, ?, ?, ?)')
const getPayment         = db.prepare('SELECT * FROM payments WHERE reference = ?')
const updatePaymentStatus= db.prepare('UPDATE payments SET status = ? WHERE reference = ?')

// ── Usage / Generations ────────────────────────────────────────────────────────
// Website and API usage are metered separately, each against its own plan.
// Rows with api_key_id NULL are website generations (including all history
// from before the API existed).
const countMonthlyGenerations = db.prepare(`
  SELECT COUNT(*) as count FROM generations
  WHERE user_id = ? AND api_key_id IS NULL AND created_at >= date('now', 'start of month')
`)
const countMonthlyApiGenerations = db.prepare(`
  SELECT COUNT(*) as count FROM generations
  WHERE user_id = ? AND api_key_id IS NOT NULL AND created_at >= date('now', 'start of month')
`)
const logGeneration = db.prepare(`
  INSERT INTO generations (user_id, industry, property, location, platforms, tokens_used, api_key_id) VALUES (?, ?, ?, ?, ?, ?, ?)
`)
const getPlan = db.prepare('SELECT * FROM plans WHERE name = ?')

// ── API plans ──────────────────────────────────────────────────────────────────
const getApiPlan   = db.prepare('SELECT * FROM api_plans WHERE name = ?')
const listApiPlans = db.prepare('SELECT name, monthly_limit, price_usd, rate_limit_per_min, description FROM api_plans ORDER BY monthly_limit')
const setApiPlan   = db.prepare('UPDATE users SET api_plan = ? WHERE id = ?')
// The plan that governs a user's API calls. Admins always get the top tier;
// an unknown/removed plan name falls back to the free tier rather than erroring.
function apiPlanFor(user) {
  if (user.is_admin) return listApiPlans.all().slice(-1)[0]
  return getApiPlan.get(user.api_plan) || getApiPlan.get('developer')
}

// ── Developer API keys ─────────────────────────────────────────────────────────
const createApiKey     = db.prepare('INSERT INTO api_keys (user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?)')
const getApiKeyById    = db.prepare('SELECT id, name, key_prefix, created_at, last_used_at FROM api_keys WHERE id = ?')
const getApiKeyByHash  = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL')
const countActiveApiKeys = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND revoked_at IS NULL')
const touchApiKey      = db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?")
const revokeApiKey     = db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND user_id = ? AND revoked_at IS NULL")
const listApiKeys      = db.prepare(`
  SELECT k.id, k.name, k.key_prefix, k.created_at, k.last_used_at,
    (SELECT COUNT(*) FROM generations g
       WHERE g.api_key_id = k.id AND g.created_at >= date('now', 'start of month')) as used_this_month
  FROM api_keys k WHERE k.user_id = ? AND k.revoked_at IS NULL ORDER BY k.created_at DESC
`)

// ── Admin ──────────────────────────────────────────────────────────────────────
const getAllUsers = db.prepare(`
  SELECT u.id, u.email, u.name, u.plan, u.api_plan, u.is_admin, u.email_verified, u.created_at, u.last_login,
    (SELECT COUNT(*) FROM generations g WHERE g.user_id = u.id) as total_gens
  FROM users u ORDER BY u.created_at DESC
`)
const getStats = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM users WHERE plan != 'free') as paid_users,
    (SELECT COUNT(*) FROM generations) as total_generations,
    (SELECT COUNT(*) FROM generations WHERE created_at >= date('now', '-7 days')) as weekly_generations
`)

module.exports = {
  db,
  getUser, getUserById, createUser, updateLastLogin, updatePlan,
  setEmailVerified, updatePassword,
  incrementFailedAttempts, resetFailedAttempts,
  createResetToken, getResetToken, markResetTokenUsed, deleteOldResetTokens,
  createVerifyToken, getVerifyToken, deleteVerifyToken,
  createPayment, getPayment, updatePaymentStatus,
  countMonthlyGenerations, countMonthlyApiGenerations, logGeneration, getPlan,
  getApiPlan, listApiPlans, setApiPlan, apiPlanFor,
  createApiKey, getApiKeyById, getApiKeyByHash, countActiveApiKeys, touchApiKey, revokeApiKey, listApiKeys,
  getAllUsers, getStats
}
