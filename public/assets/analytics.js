// ══════════ GOOGLE TAG MANAGER (consent-gated) ══════════
// Shared, defensive version of the loader in app.js for pages that don't
// load the full app bundle (marketing/guide pages, legal, pricing, home).
// Uses the same 'eb_cookie_consent' localStorage key as app.js so a choice
// made on any page is respected everywhere on the site.
(function () {
  window.GTM_ID = window.GTM_ID || 'GTM-5G3NRJWM';
  window.dataLayer = window.dataLayer || [];

  var gaLoaded = false;
  function loadGA() {
    if (gaLoaded || !window.GTM_ID) return;
    var f = document.getElementsByTagName('script')[0];
    var j = document.createElement('script');
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + window.GTM_ID;
    f.parentNode.insertBefore(j, f);
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    gaLoaded = true;
  }

  window.trackEvent = window.trackEvent || function (name, params) {
    if (!gaLoaded) return;
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
  };

  window.setCookieConsent = window.setCookieConsent || function (granted) {
    localStorage.setItem('eb_cookie_consent', granted ? 'granted' : 'denied');
    var b = document.getElementById('cookieBanner');
    if (b) b.classList.remove('show');
    if (granted) loadGA();
  };

  window.openCookieSettings = window.openCookieSettings || function () {
    var b = document.getElementById('cookieBanner');
    if (b) b.classList.add('show');
  };

  function init() {
    var c = localStorage.getItem('eb_cookie_consent');
    if (c === 'granted') {
      loadGA();
    } else if (c === null) {
      setTimeout(function () {
        var b = document.getElementById('cookieBanner');
        if (b) b.classList.add('show');
      }, 900);
    }
    // c === 'denied' → do nothing, respect the choice
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
