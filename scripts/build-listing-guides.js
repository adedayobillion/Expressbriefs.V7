// Generates /public/{slug}/listings/{platform}-...-generator.html for each
// of the 10 new industries (real estate keeps its existing hand-built set
// at /public/listings/ untouched — don't want to break indexed URLs).
//
// Run: node scripts/build-listing-guides.js
const fs = require('fs')
const path = require('path')
const { industries } = require('../industries')

const ROOT = path.join(__dirname, '..')

// ── Platform metadata — genuinely platform-specific reasoning, reused
// across every industry via {placeholders}. This is the same behavioral
// logic the original real-estate pages used (WhatsApp rewards forwardable
// brevity regardless of whether it's a house or a used car).
const PLATFORMS = {
  whatsapp: {
    label: 'WhatsApp', noun: 'Listing Generator', context: 'Broadcasts',
    why: (e) => `WhatsApp is where a huge share of ${e.audience} actually close deals — group chats, broadcast lists, direct forwards from one contact to another. It rewards short, scannable messages people can forward without editing, not polished marketing copy.`,
    tips: (e) => [
      `Lead with the number that matters — ${e.priceWord} — in the first line, since that's what people scan for in a crowded group chat.`,
      `Keep formatting simple: short lines, occasional emoji as visual anchors, no long paragraphs that get lost when forwarded.`,
      `End with a clear next step — a phone number or "DM to ${e.ctaAction}" — since WhatsApp conversations move straight to a reply.`,
      `Write it to survive forwarding: it should still make sense with zero added context when someone shares it into another group.`
    ],
    example: (e) => `${e.emoji} *${e.title}*\n${e.priceLine} | ${e.detail1}\n\n${e.detail2}. ${e.detail3}.\n\n📲 DM to ${e.ctaAction} today.`
  },
  instagram: {
    label: 'Instagram', noun: 'Caption Generator', context: 'the Feed',
    why: (e) => `Instagram is a scroll-stopping medium first, a sales channel second. If the first line doesn't earn a pause, the rest of the caption never gets read — no matter how good the ${e.entityLabelLower} is.`,
    tips: (e) => [
      `Open with a hook, not a headline — a bold claim, a number, or a question, not "${e.entityLabel} available."`,
      `Use line breaks generously; a wall of text reads as an ad and gets scrolled past.`,
      `Close with 20-30 hashtags mixing location/niche tags with broader discovery tags — this is what actually drives non-follower reach.`,
      `Still include the essentials (${e.priceWord}, key details) — hook gets the pause, details get the DM.`
    ],
    example: (e) => `${e.hookLine} ${e.emoji}\n${e.title}\n${e.priceLine}\nDM to ${e.ctaAction}.\n#${e.tag1} #${e.tag2} #${e.tag3}`
  },
  facebook: {
    label: 'Facebook', noun: 'Listing Generator', context: 'Groups & Marketplace',
    why: (e) => `Facebook's audience — largely local groups and Marketplace — rewards conversational, detail-rich posts more than punchy hooks. People read the whole thing if it's genuinely useful, and they expect enough detail to decide without messaging first.`,
    tips: (e) => [
      `Write in full sentences, not fragments — Facebook's audience skews toward reading, not skimming.`,
      `Include every detail someone would otherwise have to ask about — ${e.priceWord}, ${e.detail1}, availability.`,
      `End with a genuine, open question ("Any questions, drop them below") — Facebook's algorithm favors comments over likes.`,
      `Skip the hashtags — they don't do much on Facebook and can read as spammy in local groups.`
    ],
    example: (e) => `${e.title}\n${e.priceLine}. ${e.detail2}. ${e.detail3}.\n\nMessage me directly or drop a comment if you'd like to ${e.ctaAction} — happy to answer any questions!`
  },
  twitter: {
    label: 'Twitter (X)', noun: 'Post Generator', context: 'a Fast-Moving Feed',
    why: (e) => `Twitter gives you a few seconds and a character limit. The post has to lead with the single most impressive detail — everything else is secondary, including the ${e.priceWord.toLowerCase()}.`,
    tips: (e) => [
      `Lead with the most impressive or unusual detail, not the category — "one owner, zero accidents" beats "used car for sale."`,
      `Stay well under 280 characters; the ones that get retweeted are usually shorter than the limit, not right at it.`,
      `Use 2-3 hashtags maximum, placed at the end so they don't interrupt the read.`,
      `Include ${e.priceWord.toLowerCase()} if it's a genuine selling point — Twitter users respond to concrete numbers over vague value claims.`
    ],
    example: (e) => `${e.hookLine} ${e.priceLine}. ${e.detail1}. ${e.ctaActionCap} → #${e.tag1} #${e.tag2}`
  },
  linkedin: {
    label: 'LinkedIn', noun: 'Listing Generator', context: 'Professionals',
    why: (e) => `LinkedIn's audience reads with a professional, value-oriented lens. Posts that lean on emoji-heavy hype underperform here — the ones that work sound like a knowledgeable person sharing an opportunity, not an ad.`,
    tips: (e) => [
      `Drop the emojis and exclamation points — LinkedIn's algorithm and audience both favor a measured, professional tone.`,
      `Frame around value or opportunity, not just features — what does this actually mean for the reader?`,
      `Keep it to 150-200 words; LinkedIn truncates long posts behind "see more," and most people never click it.`,
      `Close with 3-5 relevant hashtags and a clear, low-pressure call to action.`
    ],
    example: (e) => `${e.title}\n\n${e.detail1}. ${e.detail2}.\n\n${e.priceLine} — reach out if you'd like to ${e.ctaAction} or learn more.\n\n#${e.tag1} #${e.tag2} #${e.tag3}`
  },
  tiktok: {
    label: 'TikTok', noun: 'Script Generator', context: 'a 3-Second Hook',
    why: (e) => `TikTok is a video-first platform, so the caption's real job is to accompany footage, not stand alone — but it still needs a scroll-stopping opening line, or the video never gets a chance to play.`,
    tips: (e) => [
      `Open with a bold claim or question in the first line — this is the caption equivalent of a video hook.`,
      `Write short, punchy sentences with casual, native-to-the-platform energy — no corporate phrasing.`,
      `Mix a few broad discovery hashtags (#fyp #foryou) with niche and location-based ones for reach.`,
      `End with a direct CTA that matches how TikTok users actually convert — a comment, a DM, or a bio link.`
    ],
    example: (e) => `${e.hookLine} 👀\n${e.detail1}. ${e.priceLine}.\n${e.ctaActionCap} — link in bio!\n#fyp #foryou #${e.tag1} #${e.tag2}`
  },
  snapchat: {
    label: 'Snapchat', noun: 'Post Generator', context: 'a Younger Audience',
    why: (e) => `Snapchat skews younger and more casual than any other platform on this list. Captions here should feel like a text from a friend, not marketing copy — FOMO and personality outperform polish.`,
    tips: (e) => [
      `Keep it ultra-short — 40-70 words is plenty; Snapchat captions accompany a Snap or Story, not the other way around.`,
      `Use natural emoji and casual language; overly formal copy feels out of place on this platform.`,
      `Lean into urgency or FOMO where genuine — "won't last," "limited spots" — Snapchat's audience responds to it.`,
      `A punchy CTA beats a detailed one — "Swipe up" or "DM me" over a full paragraph of instructions.`
    ],
    example: (e) => `${e.hookLine} 😍 ${e.priceLine}\n${e.ctaActionCap} before it's gone!`
  },
  reddit: {
    label: 'Reddit', noun: 'Post Generator', context: "Reddit's Culture",
    why: (e) => `Reddit actively downvotes anything that reads like an ad. The posts that work lead with genuine, useful information and only mention the offer as a natural example — self-promotion has to earn its place.`,
    tips: (e) => [
      `Write a genuine, non-clickbait title — save the promotional angle for later in the post, if at all.`,
      `Lead with real, useful context (market conditions, honest pros/cons) before mentioning this is your offer.`,
      `Avoid marketing buzzwords, hype, excessive emoji, and ALL CAPS — Reddit's culture punishes all of it.`,
      `End by inviting genuine questions rather than pushing for a sale — the soft approach performs better here.`
    ],
    example: (e) => `TITLE: ${e.redditTitle}\n\n${e.detail2}. ${e.detail3}. Happy to answer honest questions about ${e.entityLabelLower} shopping in this range — I've got one listed at ${e.priceLine.toLowerCase()} if anyone's interested, no pressure either way.`
  },
  quora: {
    label: 'Quora', noun: 'Answer Generator', context: 'Genuine Questions',
    why: (e) => `Quora rewards answers that read like expertise, not advertising. The winning format opens with real, useful context for the question being asked, then introduces the specific offer as one example — never the lead.`,
    tips: (e) => [
      `Open with genuine, useful context about the market or category before mentioning any specific offer.`,
      `Introduce your ${e.entityLabelLower} as a real example partway through, not as the opening line.`,
      `Write in a knowledgeable first-person voice — like someone answering from experience, not a business account.`,
      `Close with a soft, low-pressure note rather than a hard sell — Quora's audience is looking for advice, not ads.`
    ],
    example: (e) => `Great question. Generally, it's worth comparing ${e.priceWord.toLowerCase()} against similar options before deciding. As an example, I currently have ${e.detail1.toLowerCase()} listed at ${e.priceLine.toLowerCase()} — feel free to reach out if you'd like more details, but happy to just answer questions too.`
  }
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }

// Build a small set of derived strings from each industry's config +
// exampleInput so every platform's example box is grounded in real,
// industry-specific data rather than generic placeholder text.
function deriveExampleData(cfg) {
  // Split on ", " (comma+space) not bare "," — exampleInput fields use ", "
  // as the separator, but numbers like "42,000" and "$18,500" also contain
  // bare commas with no following space, so this avoids breaking them.
  const parts = cfg.exampleInput.split(/,\s+/).map(s => s.trim())
  const title = parts[0] || cfg.entityLabel
  const priceMatch = cfg.exampleInput.match(/[$₦£€₵]\s?[\d,.]+[\w/]*/g)
  let price = (priceMatch && priceMatch[priceMatch.length - 1]) ||
    (cfg.exampleOutput && cfg.exampleOutput.whatsapp && (cfg.exampleOutput.whatsapp.match(/[$₦£€₵]\s?[\d,.]+[\w/]*/) || [])[0]) || '$—'
  price = price.replace(/[,.]+$/, '') // strip trailing punctuation picked up from sentence context
  const detail1 = parts[1] || cfg.entityLabel + ' details'
  const detail2 = parts[2] || 'Great condition'
  const detail3 = parts[3] || 'Available now'
  const iconEmoji = { home: '🏡', car: '🚗', shop: '🛍️', food: '🔥', dumbbell: '💪', briefcase: '💼', ticket: '🎉', wrench: '🧹', suitcase: '🌊', shirt: '👖', heart: '📸' }
  return {
    audience: cfg.audience,
    entityLabel: cfg.entityLabel,
    entityLabelLower: cfg.entityLabel.toLowerCase(),
    ctaAction: cfg.ctaAction,
    ctaActionCap: cfg.ctaAction.charAt(0).toUpperCase() + cfg.ctaAction.slice(1),
    priceWord: 'price',
    title, priceLine: price, detail1, detail2, detail3,
    hookLine: title + ' —',
    redditTitle: `Thoughts on this ${cfg.entityLabel.toLowerCase()}? (${detail1})`,
    emoji: iconEmoji[cfg.icon] || '✨',
    tag1: slugify(cfg.name).replace(/-/g, ''), tag2: slugify(detail1).replace(/-/g, '').slice(0, 20) || cfg.entityLabel.replace(/\s+/g, ''), tag3: (cfg.entityLabel).replace(/\s+/g, '')
  }
}

function pageSlug(industrySlug, platformKey, cfg) {
  const nounMap = { whatsapp: 'listing-generator', instagram: 'caption-generator', facebook: 'listing-generator', twitter: 'post-generator', linkedin: 'listing-generator', tiktok: 'script-generator', snapchat: 'post-generator', reddit: 'post-generator', quora: 'answer-generator' }
  return `${platformKey}-${slugify(cfg.entityLabel)}-${nounMap[platformKey]}`
}

function buildGuidePage(industrySlug, cfg, platformKey) {
  const p = PLATFORMS[platformKey]
  const e = deriveExampleData(cfg)
  const title = `${p.label} ${cfg.entityLabel} ${p.noun} | Express Briefs`
  const desc = `Generate ${p.label}-ready ${cfg.entityLabel.toLowerCase()} posts in seconds. Copy built for how ${p.label} actually works — free to start.`
  const canonical = `https://expressbriefs.com/${industrySlug}/listings/${pageSlug(industrySlug, platformKey, cfg)}`
  const tips = p.tips(e).map(t => `      <li>${t}</li>`).join('\n')
  const example = esc(p.example(e))

  const otherPlatforms = Object.keys(PLATFORMS).filter(k => k !== platformKey).map(k =>
    `      <a href="/${industrySlug}/listings/${pageSlug(industrySlug, k, cfg)}">${PLATFORMS[k].label}</a>`
  ).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<!-- ══════════ GOOGLE TAG MANAGER (consent-gated, see /assets/analytics.js) ══════════ -->
<script>
  window.GTM_ID = 'GTM-5G3NRJWM';
  window.dataLayer = window.dataLayer || [];
</script>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --ink:#111714; --sage:#3d6b52; --leaf:#4e8c68; --mint:#7ec8a0; --lime:#b5e853;
  --paper:#f6f3ee; --paper2:#ede9e1; --white:#ffffff; --td:#111714; --tl:#f6f3ee;
  --muted:rgba(17,23,20,0.42); --border:rgba(17,23,20,0.09); --r:12px; --r-lg:18px;
  --sans:"Montserrat",sans-serif; --mono:"JetBrains Mono",monospace;
  --shadow-md:0 4px 24px rgba(17,23,20,0.1);
}
.cookie-banner { position: fixed; left: 16px; right: 16px; bottom: 16px; max-width: 480px; margin: 0 auto; background: var(--ink); color: var(--tl); border-radius: 14px; padding: 18px 20px; box-shadow: var(--shadow-md); z-index: 1500; transform: translateY(140%); opacity: 0; transition: all 0.35s cubic-bezier(0.16,1,0.3,1); }
.cookie-banner.show { transform: translateY(0); opacity: 1; }
.cookie-banner p { font-size: 12.5px; line-height: 1.6; color: rgba(246,243,238,0.8); margin-bottom: 12px; }
.cookie-banner a { color: var(--mint); }
.cookie-banner-actions { display: flex; gap: 10px; }
.cookie-banner-actions button { flex: 1; padding: 9px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--sans); border: none; }
.cookie-banner-accept { background: var(--leaf); color: white; }
.cookie-banner-accept:hover { background: var(--sage); }
.cookie-banner-dismiss { background: rgba(246,243,238,0.1); color: var(--tl); }
.cookie-banner-dismiss:hover { background: rgba(246,243,238,0.18); }
@media (max-width: 520px) { .cookie-banner { left: 10px; right: 10px; bottom: 10px; } }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:var(--sans); color:var(--td); background:var(--paper); line-height:1.6; }
.wrap { max-width:760px; margin:0 auto; padding:0 24px; }
header { padding:22px 0; border-bottom:1px solid var(--border); }
.brand { display:flex; align-items:center; gap:10px; text-decoration:none; color:var(--ink); width:fit-content; }
.brand-mark { width:34px; height:34px; background:var(--leaf); border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.brand-name { font-weight:800; font-size:17px; letter-spacing:-0.01em; }
.eyebrow { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--sage); background:rgba(78,140,104,0.1); padding:6px 12px; border-radius:20px; margin:40px 0 18px; }
h1 { font-size:clamp(28px,4.2vw,42px); font-weight:800; letter-spacing:-0.02em; line-height:1.12; margin-bottom:16px; }
.sub { font-size:17px; color:rgba(17,23,20,0.65); max-width:600px; margin-bottom:28px; }
.cta { display:inline-flex; align-items:center; gap:8px; background:var(--leaf); color:white; font-weight:700; font-size:14.5px; padding:14px 26px; border-radius:10px; text-decoration:none; box-shadow:var(--shadow-md); transition:transform 0.15s, background 0.15s; }
.cta:hover { background:var(--sage); transform:translateY(-1px); }
section { margin:52px 0; }
h2 { font-size:22px; font-weight:800; margin-bottom:14px; letter-spacing:-0.01em; }
p { font-size:15.5px; color:var(--td); margin-bottom:14px; }
ul { margin:0 0 14px 20px; }
li { font-size:15.5px; margin-bottom:10px; }
.example-box { background:var(--ink); color:var(--tl); border-radius:var(--r-lg); padding:26px 28px; font-family:var(--mono); font-size:13.5px; white-space:pre-wrap; line-height:1.7; margin-top:8px; }
.example-label { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); font-weight:700; margin-bottom:10px; }
.cta-band { background:var(--white); border:1px solid var(--border); border-radius:var(--r-lg); padding:36px 32px; text-align:center; margin:56px 0; }
.cta-band h2 { margin-bottom:10px; }
.cta-band p { max-width:440px; margin:0 auto 22px; color:var(--muted); }
.other-platforms { margin:52px 0; }
.plat-grid { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.plat-grid a { font-size:13px; color:var(--sage); text-decoration:none; background:rgba(78,140,104,0.08); padding:8px 14px; border-radius:8px; font-weight:600; }
.plat-grid a:hover { background:rgba(78,140,104,0.16); }
footer { border-top:1px solid var(--border); padding:26px 0 40px; text-align:center; font-size:12px; color:var(--muted); }
footer a { color:var(--muted); }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <a href="/" class="brand">
      <div class="brand-mark"><svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M5 3a1 1 0 0 1 1-1h7l6 6v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3z" fill="currentColor" opacity="0.92"/>
      <path d="M13 2v5a1 1 0 0 0 1 1h5" fill="white" opacity="0.22"/>
      <path d="M7.5 13.2h4.2M7.5 16h6.2" stroke="white" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/>
      <path d="M16.6 6.2l-3.4 5.6h2.1l-1.5 4.6 5-6.4h-2.4l1.7-3.8z" fill="white"/>
    </svg></div>
      <span class="brand-name">Express Briefs</span>
    </a>
  </div>
</header>

<div class="wrap">
  <div class="eyebrow">Built for ${esc(p.label)} ${esc(p.context)}</div>
  <h1>${esc(p.label)} ${esc(cfg.entityLabel)} ${esc(p.noun)}</h1>
  <p class="sub">Turn ${cfg.entityLabel.toLowerCase()} details into a ready-to-post ${p.label} message — the format ${esc(cfg.audience)} actually use to get results.</p>
  <a href="/${industrySlug}/" class="cta">Generate a free ${esc(p.label)} post →</a>

  <section>
    <h2>Why ${esc(p.label)} needs its own format</h2>
    <p>${p.why(e)}</p>
  </section>

  <section>
    <h2>Tips for a ${esc(p.label)} post that performs</h2>
    <ul>
${tips}
    </ul>
  </section>

  <section>
    <div class="example-label">Example ${esc(p.label)} output from Express Briefs</div>
    <div class="example-box">${example}</div>
  </section>

  <div class="cta-band">
    <h2>Write your ${esc(p.label)} post in seconds</h2>
    <p>Express Briefs generates ready-to-post copy for ${esc(p.label)} and 8 other platforms from one set of ${cfg.entityLabel.toLowerCase()} details — free to start.</p>
    <a href="/${industrySlug}/" class="cta">Try it free →</a>
  </div>

  <div class="other-platforms">
    <h2>Guides for other platforms</h2>
    <div class="plat-grid">
${otherPlatforms}
    </div>
  </div>
</div>

<footer>
  <div class="wrap">
    &copy; 2026 Express Briefs · <a href="/${industrySlug}/">Home</a> · <a href="/pricing/?industry=${industrySlug}">Pricing</a> · <a href="/legal/">Privacy &amp; Terms</a>
  </div>
</footer>
<div class="cookie-banner" id="cookieBanner">
  <p>We use essential local storage to keep you signed in — that's always on and never optional. We'd also like to use <strong>Google Analytics</strong> to understand how people use Express Briefs and improve it. See our <a href="/legal/">Cookie Policy</a> for details.</p>
  <div class="cookie-banner-actions">
    <button class="cookie-banner-dismiss" onclick="setCookieConsent(false)">Necessary only</button>
    <button class="cookie-banner-accept" onclick="setCookieConsent(true)">Accept analytics</button>
  </div>
</div>
<script src="/assets/analytics.js" defer></script>
</body>
</html>
`
}

function buildIndexPage(industrySlug, cfg) {
  const cards = Object.keys(PLATFORMS).map(k => {
    const p = PLATFORMS[k]
    return `      <a class="card" href="/${industrySlug}/listings/${pageSlug(industrySlug, k, cfg)}">
        <div class="card-plat">${esc(p.label)}</div>
        <div class="card-desc">${esc(p.why(deriveExampleData(cfg)).split('.')[0])}.</div>
      </a>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(cfg.name)} Guides | Express Briefs</title>
<meta name="description" content="Platform-specific guides for writing ${esc(cfg.name.toLowerCase())} posts that perform — WhatsApp, Instagram, TikTok and 6 more platforms.">
<meta name="robots" content="index, follow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="canonical" href="https://expressbriefs.com/${industrySlug}/listings/">
<!-- ══════════ GOOGLE TAG MANAGER (consent-gated, see /assets/analytics.js) ══════════ -->
<script>
  window.GTM_ID = 'GTM-5G3NRJWM';
  window.dataLayer = window.dataLayer || [];
</script>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --ink:#111714; --sage:#3d6b52; --leaf:#4e8c68; --paper:#f6f3ee; --white:#ffffff;
  --td:#111714; --tl:#f6f3ee; --muted:rgba(17,23,20,0.42); --border:rgba(17,23,20,0.09); --r-lg:18px;
  --sans:"Montserrat",sans-serif; --shadow-md:0 4px 24px rgba(17,23,20,0.1);
}
.cookie-banner { position: fixed; left: 16px; right: 16px; bottom: 16px; max-width: 480px; margin: 0 auto; background: var(--ink); color: var(--tl); border-radius: 14px; padding: 18px 20px; box-shadow: var(--shadow-md); z-index: 1500; transform: translateY(140%); opacity: 0; transition: all 0.35s cubic-bezier(0.16,1,0.3,1); }
.cookie-banner.show { transform: translateY(0); opacity: 1; }
.cookie-banner p { font-size: 12.5px; line-height: 1.6; color: rgba(246,243,238,0.8); margin-bottom: 12px; }
.cookie-banner a { color: var(--mint, #7ec8a0); }
.cookie-banner-actions { display: flex; gap: 10px; }
.cookie-banner-actions button { flex: 1; padding: 9px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--sans); border: none; }
.cookie-banner-accept { background: var(--leaf); color: white; }
.cookie-banner-accept:hover { background: var(--sage); }
.cookie-banner-dismiss { background: rgba(246,243,238,0.1); color: var(--tl); }
.cookie-banner-dismiss:hover { background: rgba(246,243,238,0.18); }
@media (max-width: 520px) { .cookie-banner { left: 10px; right: 10px; bottom: 10px; } }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:var(--sans); color:var(--td); background:var(--paper); line-height:1.6; }
.wrap { max-width:860px; margin:0 auto; padding:0 24px; }
header { padding:22px 0; border-bottom:1px solid var(--border); }
.brand { display:flex; align-items:center; gap:10px; text-decoration:none; color:var(--ink); width:fit-content; }
.brand-mark { width:34px; height:34px; background:var(--leaf); border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.brand-name { font-weight:800; font-size:17px; letter-spacing:-0.01em; }
h1 { font-size:clamp(28px,4.2vw,40px); font-weight:800; letter-spacing:-0.02em; margin:40px 0 14px; }
.sub { font-size:16.5px; color:rgba(17,23,20,0.65); max-width:560px; margin-bottom:40px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; margin-bottom:56px; }
.card { display:block; background:var(--white); border:1px solid var(--border); border-radius:14px; padding:20px 22px; text-decoration:none; color:var(--td); transition:transform 0.15s, box-shadow 0.15s; }
.card:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
.card-plat { font-weight:800; font-size:15.5px; margin-bottom:6px; color:var(--sage); }
.card-desc { font-size:13px; color:var(--muted); line-height:1.5; }
footer { border-top:1px solid var(--border); padding:26px 0 40px; text-align:center; font-size:12px; color:var(--muted); }
footer a { color:var(--muted); }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <a href="/" class="brand">
      <div class="brand-mark"><svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M5 3a1 1 0 0 1 1-1h7l6 6v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3z" fill="currentColor" opacity="0.92"/>
      <path d="M13 2v5a1 1 0 0 0 1 1h5" fill="white" opacity="0.22"/>
      <path d="M7.5 13.2h4.2M7.5 16h6.2" stroke="white" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/>
      <path d="M16.6 6.2l-3.4 5.6h2.1l-1.5 4.6 5-6.4h-2.4l1.7-3.8z" fill="white"/>
    </svg></div>
      <span class="brand-name">Express Briefs</span>
    </a>
  </div>
</header>
<div class="wrap">
  <h1>${esc(cfg.name)} Guides, by Platform</h1>
  <p class="sub">Every platform rewards a different kind of post. Here's how to write for each one — plus a free tool that generates all nine at once.</p>
  <div class="grid">
${cards}
  </div>
</div>
<footer>
  <div class="wrap">
    &copy; 2026 Express Briefs · <a href="/${industrySlug}/">Home</a> · <a href="/pricing/?industry=${industrySlug}">Pricing</a> · <a href="/legal/">Privacy &amp; Terms</a>
  </div>
</footer>
<div class="cookie-banner" id="cookieBanner">
  <p>We use essential local storage to keep you signed in — that's always on and never optional. We'd also like to use <strong>Google Analytics</strong> to understand how people use Express Briefs and improve it. See our <a href="/legal/">Cookie Policy</a> for details.</p>
  <div class="cookie-banner-actions">
    <button class="cookie-banner-dismiss" onclick="setCookieConsent(false)">Necessary only</button>
    <button class="cookie-banner-accept" onclick="setCookieConsent(true)">Accept analytics</button>
  </div>
</div>
<script src="/assets/analytics.js" defer></script>
</body>
</html>
`
}

let pageCount = 0
for (const slug of Object.keys(industries)) {
  if (slug === 'real-estate') { console.log('Skipping real-estate — keeps its existing hand-built /listings/ set'); continue }
  const cfg = industries[slug]
  const outDir = path.join(ROOT, 'public', slug, 'listings')
  fs.mkdirSync(outDir, { recursive: true })

  fs.writeFileSync(path.join(outDir, 'index.html'), buildIndexPage(slug, cfg))
  pageCount++

  for (const platformKey of Object.keys(PLATFORMS)) {
    const html = buildGuidePage(slug, cfg, platformKey)
    const fname = pageSlug(slug, platformKey, cfg) + '.html'
    fs.writeFileSync(path.join(outDir, fname), html)
    pageCount++
  }
  console.log('Built guides for /' + slug + '/listings/ (10 pages)')
}
console.log('\n' + pageCount + ' guide pages generated.')
