// Shared legal content — used by the in-app modal (openLegal in app.js)
// and the standalone /legal.html page. Edit here, both stay in sync.
var LEGAL_CONTENT = {
  privacy: { title: 'Privacy Policy', html:
    '<h3>What we collect</h3>'+
    '<p>When you create an account we store your name, email address, and a securely hashed password (we never store your password in plain text). When you generate a listing, we store the property details you enter and the content Express Briefs generates, so you can revisit it in your history.</p>'+
    '<h3>How we use it</h3>'+
    '<ul><li>To generate your listing copy and keep your account signed in.</li><li>To send account emails — verification, password resets, and billing receipts.</li><li>To enforce your plan\'s monthly usage limit.</li></ul>'+
    '<h3>Third parties we work with</h3>'+
    '<ul><li><strong>Groq</strong> — processes the property details you submit to generate listing copy.</li><li><strong>Bachs</strong> — processes payments for paid plans. We never see or store your card details.</li><li><strong>SendByte</strong> — delivers transactional emails (verification, reset, receipts) on our behalf.</li><li><strong>Google Analytics</strong> — helps us understand how the app is used (pages visited, features used), only if you\'ve accepted analytics cookies. You can decline or change this anytime under Cookie Settings.</li></ul>'+
    '<p>We do not sell your data, and we do not use advertising or retargeting cookies.</p>'+
    '<h3>Your rights</h3>'+
    '<p>Wherever you are in the world, you can ask us to access, correct, export, or delete your personal data at any time. Just contact us using the details in Support and we\'ll action it promptly — usually within a few business days.</p>'+
    '<h3>Data retention</h3>'+
    '<p>We keep your account data for as long as your account is active. If you delete your account, we remove your personal data within 30 days, except where we\'re required to keep billing records for legal or tax reasons.</p>'+
    '<h3>Contact</h3>'+
    '<p>Questions about this policy? Reach us at <a href="mailto:privacy@expressbriefs.com">privacy@expressbriefs.com</a>.</p>'
  },
  terms: { title: 'Terms of Service', html:
    '<h3>Your account</h3>'+
    '<p>You must provide accurate information when you register, and you\'re responsible for keeping your login credentials secure. You must be legally able to enter a binding agreement to use Express Briefs.</p>'+
    '<h3>Acceptable use</h3>'+
    '<p>Express Briefs is built for generating property marketing copy. Please don\'t use it to generate misleading, discriminatory, or fraudulent listing content, and don\'t attempt to abuse, reverse-engineer, or overload the service.</p>'+
    '<h3>Plans &amp; billing</h3>'+
    '<ul><li>Free plan includes a limited number of listings per month, at no cost.</li><li>Paid plans renew monthly and are billed automatically via Bachs until you cancel.</li><li>You can cancel anytime from your account; you\'ll keep access until the end of your current billing period.</li><li>Fees are non-refundable except where required by law.</li></ul>'+
    '<h3>Your content</h3>'+
    '<p>You own the listing copy Express Briefs generates for you and are free to use it commercially. Because it\'s AI-generated, we recommend reviewing it for accuracy before publishing — you\'re responsible for the final listing you publish.</p>'+
    '<h3>Service availability</h3>'+
    '<p>We aim for high uptime but don\'t guarantee uninterrupted access. We may update or change features over time to improve the product.</p>'+
    '<h3>Limitation of liability</h3>'+
    '<p>Express Briefs is provided "as is." To the extent permitted by law, we\'re not liable for indirect losses arising from your use of generated content or the service being temporarily unavailable.</p>'+
    '<h3>Contact</h3>'+
    '<p>Questions about these terms? Reach us at <a href="mailto:support@expressbriefs.com">support@expressbriefs.com</a>.</p>'
  },
  cookies: { title: 'Cookie Policy', html:
    '<h3>Short version</h3>'+
    '<p>Signing in and saving listings on this device uses your browser\'s local storage, not cookies, and that\'s always on since the app can\'t work without it. Separately, with your permission, we use Google Analytics to understand how people use Express Briefs so we can improve it. You choose whether that\'s on, and you can change your mind anytime.</p>'+
    '<h3>Always on — local storage (not a cookie)</h3>'+
    '<ul><li><strong>Session token</strong> — keeps you signed in between visits, until you log out.</li><li><strong>Saved listings</strong> — copies of listings you\'ve chosen to save, kept on your device.</li><li><strong>Cookie preference</strong> — remembers your analytics choice so we don\'t ask every visit.</li></ul>'+
    '<h3>Optional — Google Analytics</h3>'+
    '<p>If you accept analytics, Google Analytics sets cookies to understand which pages and features are used and how people move through the app. We use this in aggregate — it helps us fix confusing steps and improve the product, not to identify or advertise to you individually. We don\'t run ad pixels or retargeting scripts of any kind.</p>'+
    '<p>You can accept, decline, or change this choice at any time via <strong>Cookie Settings</strong> in the footer.</p>'+
    '<h3>Managing your data</h3>'+
    '<p>You can clear local storage anytime by logging out or clearing your browser\'s site data for expressbriefs.com. Declining analytics stops new Analytics cookies from being set on future visits.</p>'
  },
  support: { title: 'Support', html:
    '<p>Have a question, hit an issue, or want to request a feature? We read every message.</p>'+
    '<div class="support-email-box">'+
      '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24" style="color:var(--leaf);flex-shrink:0"><path d="M3 6h18v12H3z" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 7l9 6 9-6" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
      '<div><div style="font-size:11px;color:var(--muted);margin-bottom:2px">Email us</div><strong><a href="mailto:support@expressbriefs.com" style="color:inherit">support@expressbriefs.com</a></strong></div>'+
    '</div>'+
    '<h3>Response time</h3>'+
    '<p>We typically reply within 1 business day. Paid plan subscribers get priority support.</p>'+
    '<h3>Billing questions</h3>'+
    '<p>For billing or subscription issues, include the email address on your account so we can look it up quickly.</p>'
  }
};
