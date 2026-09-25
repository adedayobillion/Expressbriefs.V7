// Generates the root /public/index.html hub page — a conversion-focused
// industry selector that showcases the product promise and routes visitors
// into the right landing page.
const fs = require('fs')
const path = require('path')
const { industries } = require('../industries')

const ROOT = path.join(__dirname, '..')

const iconSvg = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  car: '<path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M3 17V11l2-5h10l4 5v6"/>',
  shop: '<path d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 9h18l-1 11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L3 9Z"/><path d="M8 12v3M16 12v3"/>',
  food: '<path d="M6 3v7a3 3 0 0 0 3 3v8M9 3v10M12 3v10M18 3c-2 2-2 5 0 7v10"/>',
  dumbbell: '<path d="M4 8v8M20 8v8M2 10v4M22 10v4M7 8v8M17 8v8"/>',
  briefcase: '<path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  ticket: '<path d="M3 9a2 2 0 0 0 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3Z"/><path d="M9 4v16" stroke-dasharray="3 3"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 1 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8Z"/>',
  suitcase: '<path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="M8 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M3 13h18"/>',
  shirt: '<path d="M8 3 4 7l3 3 1-1v10h8V9l1 1 3-3-4-4-2 2h-4l-2-2Z"/>',
  heart: '<path d="M12 21s-7.5-5-10-9.3C.4 8.3 2 4 6 4c2.2 0 3.8 1.3 6 4 2.2-2.7 3.8-4 6-4 4 0 5.6 4.3 4 7.7C19.5 16 12 21 12 21Z"/>'
}

function svgIcon(key) {
  const p = iconSvg[key] || iconSvg.shop
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`
}

const list = Object.values(industries)
const cards = list.map(cfg => `
      <a class="card-link" href="/${cfg.slug}/">
        <div class="card-icon">${svgIcon(cfg.icon)}</div>
        <div class="card-body">
          <h3>${cfg.name}</h3>
          <p>${cfg.tagline} — built for ${cfg.audience}.</p>
        </div>
        <div class="card-arrow">→</div>
      </a>`).join('\n')

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Express Briefs — Create your listing once. Market it everywhere.</title>
<meta name="description" content="Express Briefs turns one listing into platform-ready marketing copy for real estate, automotive, e-commerce, restaurants, fitness, recruitment, events, local services, hospitality, fashion resale and wedding vendors.">
<meta name="keywords" content="listing copy generator, multi-platform marketing copy, caption generator, social media copywriter, industry-specific marketing tool">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://expressbriefs.com/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="author" content="Express Briefs">
<meta property="og:type" content="website">
<meta property="og:title" content="Express Briefs — Create your listing once. Market it everywhere.">
<meta property="og:description" content="Turn one listing into ready-to-post copy for every platform and every industry.">
<meta property="og:site_name" content="Express Briefs">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Express Briefs — Create your listing once. Market it everywhere.">
<meta name="twitter:description" content="Turn one listing into ready-to-post copy for every platform and every industry.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<script>
  window.GTM_ID = 'GTM-5G3NRJWM';
  window.dataLayer = window.dataLayer || [];
</script>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/app.css">
<style>
  body { background: var(--paper); min-height: 100vh; }
  .hub-wrap { max-width: 1160px; margin: 0 auto; padding: 28px 20px 96px; }
  .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding: 10px 0 28px; }
  .brand { display:flex; align-items:center; gap:12px; text-decoration:none; color: var(--ink); }
  .brand-mark { width:46px; height:46px; background: var(--leaf); border-radius:14px; display:flex; align-items:center; justify-content:center; box-shadow: 0 8px 24px rgba(78,140,104,0.24); flex: 0 0 auto; }
  .brand-name { font-family: var(--serif); font-size: 20px; font-weight: 800; letter-spacing:-0.02em; line-height:1.1; }
  .brand-sub { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
  .topbar-badge { display:inline-flex; align-items:center; gap:8px; padding: 8px 12px; border-radius: 999px; background: rgba(78,140,104,0.08); border: 1px solid rgba(78,140,104,0.18); color: var(--sage); font-size: 12px; font-weight: 700; white-space: nowrap; }
  .hero { display:grid; grid-template-columns: 1.12fr .88fr; gap: 26px; align-items: start; padding-top: 18px; }
  .eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color: var(--sage); background: rgba(78,140,104,0.09); border:1px solid rgba(78,140,104,0.18); border-radius:100px; padding:8px 14px; margin-bottom:18px; }
  .hero h1 { font-family: var(--serif); font-size: clamp(40px, 6vw, 72px); font-weight: 800; line-height: 1.02; letter-spacing:-0.04em; color: var(--ink); margin: 0 0 18px; }
  .hero h1 em { font-style: normal; color: var(--leaf); }
  .hero-copy { font-size: 18px; line-height: 1.65; color: var(--muted); max-width: 46rem; margin-bottom: 26px; }
  .cta-row { display:flex; flex-wrap:wrap; gap:12px; margin-bottom: 22px; }
  .cta-primary, .cta-secondary { display:inline-flex; align-items:center; justify-content:center; gap:10px; padding: 14px 18px; border-radius: 16px; text-decoration:none; font-weight: 700; font-size: 14px; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
  .cta-primary { background: var(--leaf); color: white; box-shadow: 0 14px 30px rgba(78,140,104,0.22); }
  .cta-secondary { background: var(--white); color: var(--ink); border: 1px solid var(--border); }
  .cta-primary:hover, .cta-secondary:hover, .card-link:hover { transform: translateY(-2px); }
  .mini-metrics { display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }
  .metric { background: var(--white); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 16px; box-shadow: var(--shadow); }
  .metric strong { display:block; font-size: 18px; color: var(--ink); font-family: var(--serif); margin-bottom: 4px; }
  .metric span { font-size: 12.5px; color: var(--muted); line-height: 1.5; }
  .preview { background: var(--white); border: 1px solid var(--border); border-radius: 28px; box-shadow: var(--shadow); padding: 18px; position: relative; overflow:hidden; }
  .preview::before { content:""; position:absolute; inset:auto -60px -60px auto; width:180px; height:180px; background: radial-gradient(circle, rgba(78,140,104,0.14), transparent 68%); pointer-events:none; }
  .preview-top { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 14px; }
  .preview-title { font-family: var(--serif); font-size: 18px; font-weight: 800; color: var(--ink); }
  .preview-badge { font-size: 12px; color: var(--sage); background: rgba(78,140,104,0.08); border: 1px solid rgba(78,140,104,0.16); padding: 6px 10px; border-radius: 999px; }
  .preview-panel { border-radius: 22px; background: #fbfcfa; border: 1px solid rgba(25,40,31,0.08); padding: 16px; margin-bottom: 14px; }
  .preview-label { font-size: 12px; font-weight: 800; letter-spacing:.04em; text-transform:uppercase; color: var(--sage); margin-bottom: 8px; }
  .preview-text { color: var(--ink); font-size: 15px; line-height: 1.7; }
  .preview-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .preview-chip { background: var(--white); border: 1px solid var(--border); border-radius: 16px; padding: 12px 13px; font-size: 13px; color: var(--ink); line-height: 1.45; }
  .preview-chip strong { display:block; font-size: 12px; color: var(--sage); text-transform: uppercase; letter-spacing:.03em; margin-bottom: 4px; }
  .section { margin-top: 34px; }
  .section-head { display:flex; align-items:end; justify-content:space-between; gap:16px; margin-bottom: 16px; }
  .section h2 { font-family: var(--serif); font-size: clamp(26px, 3.3vw, 40px); line-height: 1.08; color: var(--ink); margin: 0; }
  .section p.section-lead { color: var(--muted); max-width: 48rem; font-size: 15px; line-height: 1.65; margin: 0; }
  .industry-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .card-link { display:flex; align-items:center; gap:14px; background: var(--white); border:1px solid var(--border); border-radius: 24px; padding:18px; text-decoration:none; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; box-shadow: 0 8px 20px rgba(25,40,31,0.04); }
  .card-link:hover { border-color: rgba(78,140,104,0.35); box-shadow: 0 18px 36px rgba(25,40,31,0.08); }
  .card-icon { flex-shrink:0; width:44px; height:44px; border-radius:14px; background: rgba(78,140,104,0.1); color: var(--leaf); display:flex; align-items:center; justify-content:center; }
  .card-body h3 { font-family: var(--serif); font-size: 16px; font-weight: 800; color: var(--ink); margin: 0 0 4px; }
  .card-body p { font-size: 13px; color: var(--muted); line-height: 1.55; margin: 0; }
  .card-arrow { margin-left:auto; flex-shrink:0; color: var(--muted); }
  .process-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .process-card { background: var(--white); border:1px solid var(--border); border-radius: 24px; padding: 18px; box-shadow: var(--shadow); }
  .process-index { width: 32px; height: 32px; border-radius: 50%; background: rgba(78,140,104,0.12); color: var(--leaf); display:flex; align-items:center; justify-content:center; font-weight:800; margin-bottom: 12px; }
  .process-card h3 { font-size: 16px; font-weight: 800; color: var(--ink); margin: 0 0 8px; }
  .process-card p { font-size: 13.5px; color: var(--muted); line-height: 1.65; margin: 0; }
  .final-cta { margin-top: 34px; background: linear-gradient(180deg, rgba(78,140,104,0.10), rgba(78,140,104,0.05)); border: 1px solid rgba(78,140,104,0.18); border-radius: 28px; padding: 22px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .final-cta strong { display:block; font-family: var(--serif); font-size: 22px; color: var(--ink); margin-bottom: 4px; }
  .final-cta span { display:block; font-size: 14px; color: var(--muted); line-height: 1.6; }
  .hub-footer { margin-top: 18px; font-size: 12.5px; color: var(--muted); text-align:center; }
  .hub-footer a { color: var(--sage); text-decoration: none; font-weight: 700; }
  @media (max-width: 980px) {
    .hero { grid-template-columns: 1fr; }
    .mini-metrics, .process-grid { grid-template-columns: 1fr; }
    .industry-grid { grid-template-columns: 1fr; }
    .final-cta { flex-direction:column; align-items:flex-start; }
  }
  @media (max-width: 640px) {
    .hub-wrap { padding-left: 16px; padding-right: 16px; }
    .topbar { flex-direction:column; align-items:flex-start; }
    .preview-grid { grid-template-columns: 1fr; }
    .hero h1 { font-size: clamp(34px, 11vw, 54px); }
  }
</style>
</head>
<body>
<main class="hub-wrap">
  <div class="topbar">
    <a class="brand" href="/">
      <div class="brand-mark">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 3a1 1 0 0 1 1-1h7l6 6v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3z" fill="white" opacity="0.95"/>
          <path d="M13 2v5a1 1 0 0 0 1 1h5" fill="white" opacity="0.35"/>
          <path d="M7.5 13.2h4.2M7.5 16h6.2" stroke="var(--leaf)" stroke-width="1.3" stroke-linecap="round" opacity="0.6"/>
          <path d="M16.6 6.2l-3.4 5.6h2.1l-1.5 4.6 5-6.4h-2.4l1.7-3.8z" fill="var(--leaf)"/>
        </svg>
      </div>
      <div>
        <div class="brand-name">Express Briefs</div>
        <div class="brand-sub">Create once. Market everywhere.</div>
      </div>
    </a>
    <div class="topbar-badge">
      <span style="width:6px;height:6px;border-radius:50%;background:var(--leaf);display:inline-block"></span>
      11 industries · 9 platform outputs
    </div>
  </div>

  <section class="hero">
    <div>
      <div class="eyebrow">
        <span style="width:5px;height:5px;border-radius:50%;background:var(--leaf);display:inline-block"></span>
        Outcome-first marketing copy
      </div>
      <h1>Create <em>one listing</em><br>and market it everywhere.</h1>
      <p class="hero-copy">Write the brief once, then turn it into platform-ready captions for WhatsApp, Instagram, Facebook, LinkedIn, TikTok, Snapchat, Reddit and Quora. Built for real estate, automotive, e-commerce, restaurants, fitness, recruitment, events, local services, hospitality, fashion resale and wedding vendors.</p>
      <div class="cta-row">
        <a class="cta-primary" href="/real-estate/">
          Start with Real Estate
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <a class="cta-secondary" href="/pricing/">See pricing</a>
        <a class="cta-secondary" href="#industries">Explore industries</a>
      </div>
      <div class="mini-metrics">
        <div class="metric">
          <strong>One input</strong>
          <span>Paste the details once, then reuse the same brief across every channel.</span>
        </div>
        <div class="metric">
          <strong>Multiple outputs</strong>
          <span>Each platform gets its own format, tone and call to action.</span>
        </div>
        <div class="metric">
          <strong>Industry-first</strong>
          <span>Clear landing pages for each business type from the homepage down.</span>
        </div>
      </div>
    </div>

    <aside class="preview" aria-label="Listing transformation preview">
      <div class="preview-top">
        <div class="preview-title">See the transformation</div>
        <div class="preview-badge">Input → outputs</div>
      </div>
      <div class="preview-panel">
        <div class="preview-label">Input</div>
        <div class="preview-text">Luxury 2-bedroom apartment in Lekki with pool, gym, 24/7 power and a rooftop view.</div>
      </div>
      <div class="preview-grid">
        <div class="preview-chip"><strong>Instagram</strong>Luxury living in Lekki with style, comfort and the kind of finish that gets attention.</div>
        <div class="preview-chip"><strong>WhatsApp</strong>Available now: a sleek 2-bed apartment with pool, gym and 24/7 power.</div>
        <div class="preview-chip"><strong>Facebook</strong>Perfect for families, professionals and short stays — clean, modern and ready to view.</div>
        <div class="preview-chip"><strong>LinkedIn</strong>A premium residential listing positioned for buyers who value location, lifestyle and convenience.</div>
      </div>
    </aside>
  </section>

  <section class="section" id="industries">
    <div class="section-head">
      <div>
        <h2>Built for the way people sell.</h2>
        <p class="section-lead">Each industry page speaks the language of its market, so visitors understand the product fast and see themselves in it immediately.</p>
      </div>
    </div>

    <div class="industry-grid">
${cards}
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <div>
        <h2>How it works</h2>
        <p class="section-lead">The flow is intentionally simple. That makes the promise easy to understand and the product easy to trust.</p>
      </div>
    </div>
    <div class="process-grid">
      <div class="process-card">
        <div class="process-index">1</div>
        <h3>Enter the brief</h3>
        <p>Drop in the details of your property, product, service, event or role once.</p>
      </div>
      <div class="process-card">
        <div class="process-index">2</div>
        <h3>Get channel-ready copy</h3>
        <p>We generate captions and descriptions tailored to each platform and audience.</p>
      </div>
      <div class="process-card">
        <div class="process-index">3</div>
        <h3>Copy, post and follow up</h3>
        <p>Publish faster, look more consistent and spend less time rewriting the same message.</p>
      </div>
    </div>
  </section>

  <div class="final-cta">
    <div>
      <strong>Pick a category and start with one brief.</strong>
      <span>Once the message is clear, the product sells itself.</span>
    </div>
    <a class="cta-primary" href="/real-estate/">Start with Real Estate</a>
  </div>

  <div class="hub-footer">Not sure which fits? <a href="/real-estate/">Start with Real Estate →</a></div>
</main>
</body>
</html>
`

fs.writeFileSync(path.join(ROOT, 'public', 'index.html'), html)
console.log('Built /public/index.html (hub page) with ' + list.length + ' industry cards.')
