# Express Briefs — AI Property Listing Generator

AI-powered listing generator for Nigerian real estate agents. Built with Node.js, Express, SQLite, and Groq AI (Llama 3.3).

---

## Setup (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Create your .env file
```bash
cp .env.example .env
```

Edit `.env` and fill in:
```
GROQ_API_KEY=gsk_your-key-here
JWT_SECRET=any-long-random-string-here
PORT=3000
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=your-admin-password
ALLOWED_ORIGINS=http://localhost:3000
```

Get your Groq API key at: https://console.groq.com/keys

`JWT_SECRET` must be at least 32 characters long. You can generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run
```bash
npm start
```

Open http://localhost:3000

---

## How it works

- Users sign up → get free plan (5 generations/month)
- They use Express Briefs → generates listing copy for all platforms
- When they hit limit → upgrade prompt shown
- You manually upgrade their plan via Admin panel
- They pay you via bank transfer / whatever works

---

## Plans & Pricing

| Plan     | Generations/month | Price      |
|----------|-------------------|------------|
| Free     | 5                 | ₦0         |
| Starter  | 50                | ₦/mo  |
| Pro      | 200               | ₦/mo |
| Agency   | 999               | ₦/mo |

---

## Admin Panel

Log in with your ADMIN_EMAIL/ADMIN_PASSWORD.
You'll be redirected to the admin dashboard automatically.

From there you can:
- See all users and their usage
- Change any user's plan (when they pay)
- Track total generations this week

---

## Developer API

Other people can generate captions from their own websites and apps through a
public, API-key-authenticated endpoint. Docs and key management live at
**`/developers`** on your site.

```bash
curl https://yourdomain.com/api/v1/generate \
  -H "Authorization: Bearer eb_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "industry": "real-estate",
    "fields": { "propType": "Duplex", "listingType": "For Sale",
                "location": "Lekki Phase 1, Lagos", "price": "₦85,000,000" },
    "platforms": ["Instagram", "WhatsApp"],
    "tone": "Luxury"
  }'
```

Returns structured JSON (`captions.instagram`, `captions.whatsapp`,
`captions.full_listing`, `captions.headlines[]`, plus `usage`).

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/v1/generate` | API key | Generate captions |
| `GET /api/v1/usage` | API key | API plan, used, limit, rate limit, reset date |
| `GET /api/v1/plans` | none | Public API plan list and prices |
| `GET /api/v1/industries[/:slug]` | none | Discover industries and their `fields` |
| `GET/POST/DELETE /api/keys` | logged-in user (JWT) | Manage keys (used by `/developers`) |

### API plans

API usage is metered and billed **separately from the website plans**: a user
can be on the free website plan and a paid API plan at the same time, and each
has its own monthly quota.

| API plan | Generations/month | Requests/min per key | Price |
|---|---|---|---|
| developer (free, default) | 10 | 10 | $0 |
| builder | 300 | 30 | $10 |
| growth | 1,500 | 60 | $39 |
| scale | 6,000 | 120 | $129 |

**These numbers are placeholders — edit `API_PLANS` at the top of
`database.js`** (it is an upsert, so changes apply on restart). The price shown
on the developers page comes from there, but what customers are actually
charged is the price on the matching **Bachs product**, so keep the two in sync.

To sell the paid tiers, create a Bachs product per tier and set
`BACHS_PRODUCT_API_BUILDER`, `BACHS_PRODUCT_API_GROWTH` and
`BACHS_PRODUCT_API_SCALE` (see `env.example`). Customers upgrade from the
`/developers` page; the upgrade is granted by the same signed Bachs webhook as
website plans, and applies immediately to all of their existing keys.
Admins can also set a plan by hand: `POST /api/admin/set-api-plan`
with `{ "userId": 1, "plan": "growth" }` (admin login required).

### How keys and limits work

- Users create keys on `/developers` (max 5 active each). Only a SHA-256 hash
  is stored; the raw key is shown once. Email must be verified first
  (admins are exempt, and run on the top API plan).
- Only successful generations count against quota. Failed and invalid requests
  are free.
- Errors are `{ "error": { "code": "...", "message": "..." } }`; a
  `limit_reached` error includes an `upgrade_url`.
- Usage per key is recorded in `generations.api_key_id`.

Run the API test suite (no Groq/Bachs keys or network needed — it uses mocks):

```bash
npm run test:api
```

---

## Deploy to Production

### Cheapest option: Railway.app
1. Push code to GitHub
2. Connect repo on railway.app
3. Add environment variables (GROQ_API_KEY, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ALLOWED_ORIGINS — set this to your live URL, e.g. `https://yourapp.up.railway.app`)
4. Deploy — Railway gives you a free URL

Note: the SQLite database file lives on the local filesystem. On Railway's free tier this isn't guaranteed to persist across redeploys — fine for a demo/class project, but if you need data to survive restarts, add a persistent volume or migrate to a hosted database later.

### Or: Render.com, Fly.io, DigitalOcean App Platform
All work the same way.

### Domain
Buy a .com.ng domain on Qservers.net (~₦3,000/year)
Point it to your Railway/Render URL.

---

## Cost to run

- Hosting: ~$0–5/month (Railway free tier works fine to start)
- Claude API: ~$0.01–0.03 per generation
- 100 users on Pro plan = ~₦1.2M revenue, ~₦15,000 in API costs


