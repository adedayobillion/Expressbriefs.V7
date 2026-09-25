// Generates /public/{slug}/index.html for every industry in industries.js,
// using public/index.html as the shared template (same CSS/JS, different
// <head> SEO block + hero copy baked in statically for crawlers, plus a
// window.INDUSTRY_SLUG override so the shared app.js renders the right form).
//
// Run: node scripts/build-landing-pages.js
const fs = require('fs')
const path = require('path')
const { industries } = require('../industries')

const ROOT = path.join(__dirname, '..')
const TEMPLATE_PATH = path.join(ROOT, 'templates', 'shared-shell.html')
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8')

// Outcome-first copy generated from the industry config so the landing pages
// stay consistent and easy to maintain.
const keywordMap = {
  'real-estate': 'AI property listing generator, real estate listing generator, property description generator, property ad generator, real estate content generator',
  'automotive': 'AI vehicle listing generator, car dealer copywriter, auto listing generator, vehicle description generator, used car marketing tool',
  'ecommerce': 'AI product listing generator, product description generator, e-commerce copywriter, online store marketing tool, social media product posts',
  'restaurants': 'AI restaurant marketing tool, menu copy generator, restaurant caption generator, daily specials generator, food truck marketing',
  'fitness': 'AI fitness marketing tool, gym social media generator, personal trainer copywriter, class schedule posts, fitness studio marketing',
  'recruitment': 'AI job posting generator, recruiter marketing tool, staffing agency copywriter, LinkedIn job post generator, hiring social media posts',
  'events': 'AI event marketing tool, event promo generator, ticket sales copywriter, concert social media posts, festival marketing generator',
  'local-services': 'AI local service marketing, cleaner social media generator, salon marketing tool, artisan copywriter, service business generator',
  'hospitality': 'AI hotel marketing tool, travel package generator, resort social media copywriter, tour operator marketing, hospitality content generator',
  'fashion-resale': 'AI fashion marketing tool, boutique social media generator, thrift resale copywriter, fashion listing generator, stylist marketing tool',
  'wedding-vendors': 'AI wedding marketing tool, wedding vendor copywriter, photography package generator, event vendor social media, planner marketing generator'
}

function makeCopy(slug, cfg) {
  const label = cfg.entityLabel.toLowerCase()
  const shortLabel = cfg.entityLabel.split('/')[0].trim()
  const shortLabelLower = shortLabel.toLowerCase()
  return {
    title: `Express Briefs — ${shortLabel} Marketing in Minutes`,
    description: `Turn one ${shortLabelLower} into ready-to-post copy for every platform, in seconds. Built for ${cfg.audience}.`,
    keywords: `${keywordMap[slug]}, platform-ready captions, multi-platform marketing copy, ${slug.replace(/-/g, ' ')} social media copy`,
    eyebrow: 'Create once. Market everywhere.',
    h1: `Turn one <em>${label}</em><br>brief into platform-ready copy`,
    sub: `Paste the details once. Express Briefs writes channel-ready captions and descriptions for ${cfg.audience} in seconds.`,
    feature3: [`Works for any ${label}, anywhere`, 'Adapts tone, format and call-to-action to each platform']
  }
}

const copy = Object.fromEntries(Object.entries(industries).map(([slug, cfg]) => [slug, makeCopy(slug, cfg)]))

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function buildPage(slug, cfg, c) {
  let html = template

  html = html.replace(
    /<title>.*?<\/title>/,
    `<title>${esc(c.title)}</title>`
  )
  html = html.replace(
    /<meta name="description" content=".*?">/,
    `<meta name="description" content="${esc(c.description)}">`
  )
  html = html.replace(
    /<meta name="keywords" content=".*?">/,
    `<meta name="keywords" content="${esc(c.keywords)}">`
  )
  html = html.replace(
    /<link rel="canonical" href=".*?">/,
    `<link rel="canonical" href="https://expressbriefs.com/${slug}/">`
  )
  html = html.replace(
    /<meta property="og:title" content=".*?">/,
    `<meta property="og:title" content="${esc(c.title)}">`
  )
  html = html.replace(
    /<meta property="og:description" content=".*?">/,
    `<meta property="og:description" content="${esc(c.description)}">`
  )
  html = html.replace(
    /<meta name="twitter:title" content=".*?">/,
    `<meta name="twitter:title" content="${esc(c.title)}">`
  )
  html = html.replace(
    /<meta name="twitter:description" content=".*?">/,
    `<meta name="twitter:description" content="${esc(c.description)}">`
  )

  // Static hero copy (crawlable without JS) — app.js will also set this at
  // runtime, but baking it in here means SEO doesn't depend on JS executing.
  html = html.replace(
    /<span id="heroPill">.*?<\/span>/,
    `<span id="heroPill">${c.eyebrow}</span>`
  )
  html = html.replace(
    /<h1 id="heroH1">.*?<\/h1>/,
    `<h1 id="heroH1">${c.h1}</h1>`
  )
  html = html.replace(
    /<p id="heroSub">.*?<\/p>/,
    `<p id="heroSub">${esc(c.sub)}</p>`
  )
  html = html.replace(
    /<strong id="heroFeature3Title">.*?<\/strong>/,
    `<strong id="heroFeature3Title">${esc(c.feature3[0])}</strong>`
  )
  html = html.replace(
    /<span id="heroFeature3Sub">.*?<\/span>/,
    `<span id="heroFeature3Sub">${esc(c.feature3[1])}</span>`
  )

  // Force the shared app.js to load this industry's config
  html = html.replace(
    /window\.INDUSTRY_SLUG = window\.INDUSTRY_SLUG \|\| "real-estate";/,
    `window.INDUSTRY_SLUG = "${slug}";`
  )

  // ── Bake the rest of the previously-hardcoded real-estate content into
  // the static HTML too (not just the JS runtime override), so it's correct
  // even before JS executes — matters for SEO crawlers and first paint.
  const guidesHref = slug === 'real-estate' ? '/listings/' : `/${slug}/listings/`
  html = html.replace(/href="\/listings\/" id="guidesLink1"/, `href="${guidesHref}" id="guidesLink1"`)
  html = html.replace(/href="\/listings\/" id="guidesLink2"/, `href="${guidesHref}" id="guidesLink2"`)

  const pricingHref = `/pricing/?industry=${slug}`
  html = html.replace(/href="\/pricing" id="pricingLink1"/, `href="${pricingHref}" id="pricingLink1"`)
  html = html.replace(/href="\/pricing" id="pricingLink2"/, `href="${pricingHref}" id="pricingLink2"`)

  html = html.replace(/<h2 class="mkt-h2" id="actionH2">.*?<\/h2>/, `<h2 class="mkt-h2" id="actionH2">Same ${cfg.entityLabel.toLowerCase()}. Nine different platforms.</h2>`)
  const factParts = (cfg.exampleInput || '').split(/,\s+/).slice(0, 4).map(f => `<li>${esc(f)}</li>`).join('')
  html = html.replace(/<ul class="mkt-fact-list" id="actionFacts">[\s\S]*?<\/ul>/, `<ul class="mkt-fact-list" id="actionFacts">${factParts}</ul>`)
  if (cfg.exampleOutput && cfg.exampleOutput.whatsapp) {
    const wa = esc(cfg.exampleOutput.whatsapp).replace(/\n/g, '<br>')
    html = html.replace(/<p class="mkt-out-text" id="actionWA">.*?<\/p>/, `<p class="mkt-out-text" id="actionWA">${wa}</p>`)
  }
  if (cfg.exampleOutput && cfg.exampleOutput.instagram) {
    const ig = esc(cfg.exampleOutput.instagram).replace(/\n/g, '<br>')
    html = html.replace(/<p class="mkt-out-text" id="actionIG">.*?<\/p>/, `<p class="mkt-out-text" id="actionIG">${ig}</p>`)
  }

  html = html.replace(/<p class="mkt-eyebrow" id="whyEyebrow">.*?<\/p>/, `<p class="mkt-eyebrow" id="whyEyebrow">Why ${esc(cfg.audience.split(',')[0])} choose Express Briefs</p>`)
  html = html.replace(/<p id="faqPlatforms">.*?<\/p>/, `<p id="faqPlatforms">WhatsApp, Instagram, Facebook, Twitter/X, LinkedIn, TikTok, Snapchat, Reddit, and Quora — plus a full standalone ${esc(cfg.entityLabel.toLowerCase())} description, generated together in one click.</p>`)
  html = html.replace(/<p id="savedSub">.*?<\/p>/, `<p id="savedSub">Your saved ${esc(cfg.entityLabel.toLowerCase())} outputs — reload any time to copy or share</p>`)
  html = html.replace(/<p id="historySub">.*?<\/p>/, `<p id="historySub">All your ${esc(cfg.entityLabel.toLowerCase())} campaigns</p>`)
  html = html.replace(/<p id="upgradeBody">.*?<\/p>/, `<p id="upgradeBody">You've reached your monthly limit. Upgrade to keep generating professional ${esc(cfg.entityLabel.toLowerCase())} content that wins more results — worldwide.</p>`)

  return html
}

let built = 0
for (const slug of Object.keys(industries)) {
  const c = copy[slug]
  if (!c) { console.log('Skipping ' + slug + ' — no copy defined'); continue }
  const outDir = path.join(ROOT, 'public', slug)
  fs.mkdirSync(outDir, { recursive: true })
  const html = buildPage(slug, industries[slug], c)
  fs.writeFileSync(path.join(outDir, 'index.html'), html)
  console.log('Built /public/' + slug + '/index.html')
  built++
}
console.log('\n' + built + ' landing pages generated.')
