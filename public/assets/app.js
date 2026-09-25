var token=localStorage.getItem('ps_token'),cUser=null,cUsage=null,tone='Professional',gCount=0,t0=null;
var INDUSTRY_SLUG = window.INDUSTRY_SLUG || 'real-estate';
var industryCfg = null;

window.addEventListener('DOMContentLoaded',function(){
  loadIndustry().then(function(){
    checkUrlParams();
    if(token)loadMe();else{showScreen('authScreen');if(window._pendingAuth)showAuthForm(window._pendingAuth);}
  });
});

async function loadIndustry(){
  try{
    var r = await fetch('/api/industries/'+encodeURIComponent(INDUSTRY_SLUG));
    var data = await r.json();
    if(!data.industry){console.error('Unknown industry slug, falling back to real-estate');INDUSTRY_SLUG='real-estate';return loadIndustry();}
    industryCfg = data.industry;
    tone = (data.tones && data.tones[0] && data.tones[0].key) || 'Professional';
    applyIndustryUI(data.tones||[]);
  }catch(e){console.error('[INDUSTRY LOAD ERROR]',e.message);}
}

function applyIndustryUI(tones){
  var cfg = industryCfg; if(!cfg) return;

  // Auth-screen hero copy
  var pill=document.getElementById('heroPill'); if(pill) pill.innerHTML = 'Outcome-first '+escH(cfg.name)+' marketing &middot; Any country, any language';
  var h1=document.getElementById('heroH1'); if(h1) h1.innerHTML = 'Create <em>one listing</em><br>and market it everywhere';
  var sub=document.getElementById('heroSub'); if(sub) sub.textContent = 'Serving '+cfg.audience+' worldwide — paste your details once and get platform-ready copy for WhatsApp, Instagram, Facebook, LinkedIn, TikTok and more.';
  var f3t=document.getElementById('heroFeature3Title'); if(f3t) f3t.textContent='Works for any '+cfg.entityLabel.toLowerCase()+', anywhere';
  var f3s=document.getElementById('heroFeature3Sub'); if(f3s) f3s.textContent='Adapts tone, format and call-to-action to each platform';

  // Compose page copy
  var pill2=document.getElementById('composePill'); if(pill2) pill2.innerHTML = 'Outcome-first '+escH(cfg.name)+' marketing &middot; Any country, any language';
  var h2=document.getElementById('composeH2'); if(h2) h2.innerHTML = 'Turn '+escH(cfg.entityLabel)+' details into<br><em>platform-ready copy</em> instantly';
  var csub=document.getElementById('composeSub'); if(csub) csub.textContent = 'Built for '+cfg.audience+'. Faster drafts, clearer messaging, and less rewriting across channels.';
  var icT=document.getElementById('icTitle'); if(icT) icT.textContent = cfg.entityLabel+' Details';
  var icS=document.getElementById('icSub'); if(icS) icS.textContent = 'Fill in your details to generate multiple platform-ready options';

  // Dynamic form fields — paired two-per-row (.f-row) to match the
  // original design's compact layout, instead of stacking every field
  // full-width (which made 5-6 field industries like recruitment/
  // automotive noticeably longer and less polished).
  var dyn=document.getElementById('dynFields');
  if(dyn){
    function fieldHtml(f){
      var req = f.required ? ' <span class="req">*</span>' : '';
      if(f.type==='select'){
        var opts='<option value="">Select...</option>';
        for(var j=0;j<f.options.length;j++) opts+='<option>'+escH(f.options[j])+'</option>';
        return '<div class="field"><label class="field-label">'+escH(f.label)+req+'</label><select class="f-select" id="dyn_'+f.key+'" data-key="'+f.key+'">'+opts+'</select></div>';
      }
      return '<div class="field"><label class="field-label">'+escH(f.label)+req+'</label><input class="f-input" type="text" id="dyn_'+f.key+'" data-key="'+f.key+'" placeholder="'+escH(f.placeholder||'')+'"></div>';
    }
    var html='';
    var fields=cfg.fields;
    for(var i=0;i<fields.length;i+=2){
      if(fields[i+1]){
        html+='<div class="f-row">'+fieldHtml(fields[i])+fieldHtml(fields[i+1])+'</div>';
      } else {
        html+=fieldHtml(fields[i]);
      }
    }
    dyn.innerHTML=html;
  }

  // Feature chips
  var fg=document.getElementById('featGrid');
  if(fg){
    var fhtml='';
    for(var k=0;k<cfg.features.length;k++){
      var feat=cfg.features[k];
      fhtml+='<label class="feat-item" onclick="tFeat(this)"><input type="checkbox" value="'+escH(feat)+'"><span class="feat-check"></span>'+escH(feat)+'</label>';
    }
    fg.innerHTML=fhtml;
  }

  // Tone buttons
  var tg=document.getElementById('toneGrid');
  if(tg && tones.length){
    var thtml='';
    for(var t=0;t<tones.length;t++){
      thtml+='<button class="tone-btn'+(t===0?' on':'')+'" onclick="sTone(this,\''+tones[t].key+'\')">'+escH(tones[t].label)+'</button>';
    }
    tg.innerHTML=thtml;
  }

  // Footer "Guides" links — real-estate keeps its original /listings/ path,
  // every other industry gets its own /{slug}/listings/
  var guidesHref = (INDUSTRY_SLUG === 'real-estate') ? '/listings/' : '/'+INDUSTRY_SLUG+'/listings/';
  var g1=document.getElementById('guidesLink1'); if(g1) g1.href=guidesHref;
  var g2=document.getElementById('guidesLink2'); if(g2) g2.href=guidesHref;

  var pricingHref = '/pricing/?industry='+INDUSTRY_SLUG;
  var p1=document.getElementById('pricingLink1'); if(p1) p1.href=pricingHref;
  var p2=document.getElementById('pricingLink2'); if(p2) p2.href=pricingHref;

  // "See it in action" example section
  var actH2=document.getElementById('actionH2'); if(actH2) actH2.textContent='Same '+cfg.entityLabel.toLowerCase()+'. Nine different platforms.';
  var actFacts=document.getElementById('actionFacts');
  if(actFacts && cfg.exampleInput){
    var factItems = cfg.exampleInput.split(/,\s+/).slice(0,4).map(function(f){return '<li>'+escH(f)+'</li>';}).join('');
    actFacts.innerHTML = factItems;
  }
  var actWA=document.getElementById('actionWA'); if(actWA && cfg.exampleOutput && cfg.exampleOutput.whatsapp) actWA.innerHTML=escH(cfg.exampleOutput.whatsapp).replace(/\n/g,'<br>');
  var actIG=document.getElementById('actionIG'); if(actIG && cfg.exampleOutput && cfg.exampleOutput.instagram) actIG.innerHTML=escH(cfg.exampleOutput.instagram).replace(/\n/g,'<br>');

  // "Why {audience} choose" eyebrow
  var whyE=document.getElementById('whyEyebrow'); if(whyE) whyE.textContent='Why '+cfg.audience.split(',')[0]+' choose Express Briefs';

  // FAQ platform line
  var faqP=document.getElementById('faqPlatforms'); if(faqP) faqP.textContent='WhatsApp, Instagram, Facebook, Twitter/X, LinkedIn, TikTok, Snapchat, Reddit, and Quora — plus a full standalone '+cfg.entityLabel.toLowerCase()+' description, generated together in one click.';

  // Saved / History subtitles
  var savedS=document.getElementById('savedSub'); if(savedS) savedS.textContent='Your saved '+cfg.entityLabel.toLowerCase()+' outputs — reload any time to copy or share';
  var histS=document.getElementById('historySub'); if(histS) histS.textContent='All your '+cfg.entityLabel.toLowerCase()+' campaigns';

  // Upgrade modal body
  var upB=document.getElementById('upgradeBody'); if(upB) upB.textContent="You've reached your monthly limit. Upgrade to keep generating professional "+cfg.entityLabel.toLowerCase()+" content that wins more results — worldwide.";

  // <title>/meta are set per static landing page at build time (SEO), not here.
}

async function loadMe(){
  try{
    var r=await api('/api/auth/me');
    if(r.error){logout();return}
    cUser=r.user;cUsage=r.usage;
    showScreen('appScreen');renderUI();
    if(cUser.is_admin)addAdminTab();
    if(window._pendingPlan){
      var pp=window._pendingPlan;window._pendingPlan=null;
      payWithBachs(pp);
    }
  }catch(e){logout()}
}

function showScreen(n){
  document.querySelectorAll('.screen').forEach(function(s){
    s.classList.remove('active');
    s.style.display='none';
  });
  var el=document.getElementById(n);
  if(!el)return;
  el.style.display=(n==='authScreen')?'grid':'block';
  el.classList.add('active');
}

function showAuthForm(t){
  document.getElementById('authIntro').classList.add('hidden');
  document.getElementById('authFormWrap').classList.remove('hidden');
  switchTab(t);
}
function hideAuthForm(){
  document.getElementById('authFormWrap').classList.add('hidden');
  document.getElementById('authIntro').classList.remove('hidden');
}
function switchTab(t){
  document.querySelectorAll('.auth-tab').forEach(function(b,i){
    b.classList.toggle('active',(i===0&&t==='login')||(i===1&&t==='register'));
  });
  // Hide ALL forms first, then show only the right one
  ['loginForm','registerForm','forgotForm','resetForm'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.classList.add('hidden');
  });
  document.getElementById(t==='login'?'loginForm':'registerForm').classList.remove('hidden');
  document.getElementById('authHeading').textContent = t==='login'?'Welcome Back':'Get Started Free';
  document.getElementById('authSub').textContent = t==='login'?'Sign in to your Express Briefs account':'Create your account in 30 seconds';
  var tabs=document.getElementById('authTabs'); if(tabs) tabs.style.display='';
  // Clear fields on switch
  if(t==='login'){
    document.getElementById('loginEmail').value='';
    document.getElementById('loginPassword').value='';
    document.getElementById('loginError').style.display='none';
  } else {
    document.getElementById('registerError').style.display='none';
  }
}

function showForgot(){
  ['loginForm','registerForm','resetForm'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.classList.add('hidden');
  });
  document.getElementById('forgotForm').classList.remove('hidden');
  document.getElementById('authTabs').style.display='none';
  document.getElementById('authHeading').textContent='Reset Password';
  document.getElementById('authSub').textContent="We'll send a reset link to your inbox";
  document.getElementById('forgotEmail').value='';
  document.getElementById('forgotError').style.display='none';
  document.getElementById('forgotSuccess').style.display='none';
}

function hideForgot(){
  document.getElementById('forgotForm').classList.add('hidden');
  document.getElementById('resetForm').classList.add('hidden');
  switchTab('login');
}

async function forgotPassword(){
  var email=document.getElementById('forgotEmail').value.trim();
  var errEl=document.getElementById('forgotError'),sucEl=document.getElementById('forgotSuccess'),btn=document.getElementById('forgotBtn');
  errEl.style.display='none'; sucEl.style.display='none';
  if(!email){errEl.textContent='Please enter your email address.';errEl.style.display='block';return;}
  btn.disabled=true; btn.childNodes[0].textContent='Sending... ';
  var r=await apiNA('/api/auth/forgot-password',{method:'POST',body:{email:email}});
  btn.disabled=false; btn.childNodes[0].textContent='Send Reset Link ';
  if(r.error){errEl.textContent=r.error;errEl.style.display='block';}
  else{sucEl.textContent=r.message||'Check your inbox for the reset link.';sucEl.style.display='block';}
}

var _resetToken=null;

async function doResetPassword(){
  var pw=document.getElementById('resetPassword').value;
  var cf=document.getElementById('resetConfirm').value;
  var errEl=document.getElementById('resetError'),btn=document.getElementById('resetBtn');
  errEl.style.display='none';
  if(!pw||pw.length<8){errEl.textContent='Password must be at least 8 characters.';errEl.style.display='block';return;}
  if(pw!==cf){errEl.textContent='Passwords do not match.';errEl.style.display='block';return;}
  btn.disabled=true; btn.childNodes[0].textContent='Saving... ';
  var r=await apiNA('/api/auth/reset-password',{method:'POST',body:{token:_resetToken,password:pw}});
  btn.disabled=false; btn.childNodes[0].textContent='Set New Password ';
  if(r.error){errEl.textContent=r.error;errEl.style.display='block';}
  else{toast('Password updated! Please log in.','success');hideForgot();}
}

function togglePw(inputId,btn){
  var inp=document.getElementById(inputId);
  var isText=inp.type==='text';
  inp.type=isText?'password':'text';
  btn.innerHTML=isText
    ?'<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 20 20"><path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="2.5"/></svg>'
    :'<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 20 20"><path d="M3 3l14 14M10 4c3.5 0 6.5 2.5 8 5.5-.5 1-1.2 1.9-2.1 2.7M6.3 6.6A8.8 8.8 0 0 0 2 9.5c1.5 3 4.5 5.5 8 5.5 1.4 0 2.8-.4 4-1" stroke-linecap="round"/></svg>';
  btn.setAttribute('aria-label', isText ? 'Show password' : 'Hide password');
}

async function resendVerification(){
  var r=await api('/api/auth/resend-verification',{method:'POST'});
  if(r.error)toast(r.error,'error');
  else toast('Verification email sent! Check your inbox.','success');
}

async function payWithBachs(plan){
  trackEvent('begin_checkout',{plan:plan});
  var lb=document.getElementById('payLoading');
  if(lb){lb.classList.add('show');lb.textContent='Redirecting to secure payment...';}
  var r=await api('/api/payment/initialize',{method:'POST',body:{plan:plan,industry:INDUSTRY_SLUG}});
  if(lb)lb.classList.remove('show');
  if(r.error){toast(r.error,'error');return;}
  if(r.authorization_url)window.location.href=r.authorization_url;
}

function checkUrlParams(){
  var params=new URLSearchParams(window.location.search);

  var authReq=params.get('auth');
  if(authReq && ['login','register'].includes(authReq)){
    window._pendingAuth=authReq;
    // Only redirect somewhere else after login if the link that brought us
    // here said where — e.g. /developers/ sends people back to /developers/
    // to finish creating an API key. Otherwise we just enter the app normally.
    var nextParam=params.get('next');
    if(nextParam && nextParam.charAt(1)!=='/' && /^\/[a-zA-Z0-9\/_-]*\/?$/.test(nextParam)){
      window._redirectAfterAuth=nextParam;
    }
    var url=new URL(window.location.href);
    url.searchParams.delete('auth');
    url.searchParams.delete('next');
    window.history.replaceState({},'',url.pathname+url.search);
  }

  var planReq=params.get('plan');
  if(planReq && ['starter','pro','agency'].includes(planReq)){
    window._pendingPlan=planReq;
    window.history.replaceState({},'',window.location.pathname);
  }

  // Reset token — always show reset form, even if logged in
  if(params.get('reset_token')){
    _resetToken=params.get('reset_token');
    // Clear any existing session so auth screen shows
    token=null; cUser=null; localStorage.removeItem('ps_token');
    window.history.replaceState({},'',window.location.pathname);
    // Show auth screen with reset form
    showScreen('authScreen');
    document.getElementById('authIntro').classList.add('hidden');
    document.getElementById('authFormWrap').classList.remove('hidden');
    ['loginForm','registerForm','forgotForm'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.classList.add('hidden');
    });
    document.getElementById('resetForm').classList.remove('hidden');
    document.getElementById('authTabs').style.display='none';
    document.getElementById('authHeading').textContent='Set New Password';
    document.getElementById('authSub').textContent='Enter your new password below';
    return; // stop here — don't load the app
  }

  if(params.get('verified')==='1'){
    toast('Email verified! You\'re all set.','success');
    if(cUser)cUser.email_verified=1;
    var vb=document.getElementById('verifyBanner'); if(vb)vb.classList.remove('show');
    window.history.replaceState({},'',window.location.pathname);
  }

  var payment=params.get('payment');
  if(payment){
    var pb=document.getElementById('paymentBanner');
    if(pb){
      pb.style.display='flex';
      if(payment==='success'){
        pb.style.background='rgba(46,122,82,0.1)';pb.style.borderColor='rgba(46,122,82,0.3)';pb.style.color='var(--sage)';
        pb.innerHTML='🎉 Payment successful! Your plan has been upgraded. <button onclick="this.parentElement.style.display=\'none\'" aria-label="Dismiss">✕</button>';
        if(typeof loadMe==='function')loadMe();
        trackEvent('purchase_success',{});
      }else if(payment==='processing'){
        var ref=params.get('ref');
        pb.style.background='rgba(181,232,83,0.12)';pb.style.borderColor='rgba(181,232,83,0.35)';pb.style.color='var(--sage)';
        pb.innerHTML='⏳ Confirming your payment, this only takes a few seconds…';
        if(ref)pollPaymentStatus(ref,pb);
      }else{
        pb.style.background='rgba(239,68,68,0.08)';pb.style.borderColor='rgba(239,68,68,0.2)';pb.style.color='#dc2626';
        pb.innerHTML='❌ Payment was not completed. Please try again. <button onclick="this.parentElement.style.display=\'none\'" aria-label="Dismiss">✕</button>';
      }
    }
    window.history.replaceState({},'',window.location.pathname);
  }
}

// Poll while a webhook confirmation is still in flight. Never shows failure
// on timeout — the webhook may just be slow, not wrong — it tells the person
// to check back instead of alarming them with a false negative.
function pollPaymentStatus(ref,pb,attempt){
  attempt=attempt||0;
  fetch('/api/payment/status?ref='+encodeURIComponent(ref))
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.status==='success'){
        pb.style.background='rgba(46,122,82,0.1)';pb.style.borderColor='rgba(46,122,82,0.3)';pb.style.color='var(--sage)';
        pb.innerHTML='🎉 Payment successful! Your plan has been upgraded. <button onclick="this.parentElement.style.display=\'none\'" aria-label="Dismiss">✕</button>';
        if(typeof loadMe==='function')loadMe();
        trackEvent('purchase_success',{});
      }else if(d.status==='failed'){
        pb.style.background='rgba(239,68,68,0.08)';pb.style.borderColor='rgba(239,68,68,0.2)';pb.style.color='#dc2626';
        pb.innerHTML='❌ Payment was not completed. Please try again. <button onclick="this.parentElement.style.display=\'none\'" aria-label="Dismiss">✕</button>';
      }else if(attempt<10){
        setTimeout(function(){pollPaymentStatus(ref,pb,attempt+1)},2500);
      }else{
        pb.style.background='rgba(181,232,83,0.12)';pb.style.borderColor='rgba(181,232,83,0.35)';pb.style.color='var(--sage)';
        pb.innerHTML='⏳ Still confirming — this can take a minute. We\'ll email you once it\'s done. <button onclick="this.parentElement.style.display=\'none\'" aria-label="Dismiss">✕</button>';
      }
    })
    .catch(function(){ /* network hiccup — just stop polling quietly, don't scare anyone */ });
}

async function login(){
  var e=document.getElementById('loginEmail').value.trim(),p=document.getElementById('loginPassword').value;
  var err=document.getElementById('loginError'),btn=document.getElementById('loginBtn');
  err.style.display='none';
  if(!e||!p){showErr(err,'Enter your email and password');return}
  btn.disabled=true;btn.childNodes[0].textContent='Signing in... ';
  var r=await apiNA('/api/auth/login',{method:'POST',body:{email:e,password:p}});
  btn.disabled=false;btn.childNodes[0].textContent='Sign In ';
  if(r.error){showErr(err,r.error);return}
  token=r.token;cUser=r.user;localStorage.setItem('ps_token',token);
  trackEvent('login',{method:'email'});
  if(window._redirectAfterAuth){window.location.href=window._redirectAfterAuth;return}
  await loadMe();
}

async function register(){
  var n=document.getElementById('regName').value.trim(),e=document.getElementById('regEmail').value.trim(),p=document.getElementById('regPassword').value;
  var err=document.getElementById('registerError'),btn=document.getElementById('registerBtn');
  err.style.display='none';
  if(!n||!e||!p){showErr(err,'All fields are required');return}
  btn.disabled=true;btn.childNodes[0].textContent='Creating account... ';
  var r=await apiNA('/api/auth/register',{method:'POST',body:{name:n,email:e,password:p,next:window._redirectAfterAuth||undefined}});
  btn.disabled=false;btn.childNodes[0].textContent='Create Free Account ';
  if(r.error){showErr(err,r.error);return}
  token=r.token;cUser=r.user;localStorage.setItem('ps_token',token);
  toast('Welcome to Express Briefs!','success');
  trackEvent('sign_up',{method:'email'});
  if(window._redirectAfterAuth){window.location.href=window._redirectAfterAuth;return}
  await loadMe();
}

function logout(){
  token=null;cUser=null;localStorage.removeItem('ps_token');
  ['loginEmail','loginPassword','regName','regEmail','regPassword'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  hideAuthForm();
  showScreen('authScreen');
}
function showErr(el,m){el.textContent=m;el.style.display='block';}

function renderUI(){
  if(!cUser)return;
  document.getElementById('userName').textContent=cUser.name.split(' ')[0];
  document.getElementById('userAvatar').textContent=cUser.name.charAt(0).toUpperCase();
  if(cUsage){
    var p=Math.min(100,(cUsage.used/cUsage.limit)*100);
    document.getElementById('usageFill').style.width=p+'%';
    document.getElementById('usageFill').style.background=p>85?'#ef4444':p>60?'#f59e0b':'var(--lime)';
    document.getElementById('usageText').textContent=cUsage.used+'/'+cUsage.limit;
  }
  var ub=document.getElementById('upgradeBtn');
  if(cUser.plan==='agency')ub.style.display='none';
  if(cUser.is_admin){ub.querySelector('span')&&(ub.querySelector('span').textContent='Admin');ub.onclick=function(){showPage('admin');loadAdmin()};}
}

function addAdminTab(){
  var c=document.querySelector('.nav-center');
  if(document.getElementById('tab-admin'))return;
  var b=document.createElement('button');b.className='ntab';b.id='tab-admin';
  b.innerHTML='<svg width="14" height="14" color="currentColor"><use href="#icon-admin"/></svg> Admin';
  b.onclick=function(){showPage('admin');loadAdmin();};
  c.appendChild(b);
}

function showPage(n){
  if(n==='admin'&&(!cUser||!cUser.is_admin)){toast('Admin access only.','error');return;}
  document.querySelectorAll('.app-page').forEach(function(p){p.classList.remove('active')});
  document.querySelectorAll('.ntab').forEach(function(t){t.classList.remove('active')});
  document.getElementById('page-'+n).classList.add('active');
  var t=document.getElementById('tab-'+n);if(t)t.classList.add('active');
  if(n==='history')loadHist();
  if(n==='saved')renderSaved();
  trackEvent('page_view',{page_title:n,page_location:location.href+'#'+n});
}

function collectDynFields(){
  var fields={};
  if(!industryCfg) return fields;
  industryCfg.fields.forEach(function(f){
    var el=document.getElementById('dyn_'+f.key);
    fields[f.key]=el?el.value.trim():'';
  });
  return fields;
}

async function generate(){
  if(!industryCfg){toast('Still loading — try again in a second','error');return}
  var fields=collectDynFields();
  var missing=industryCfg.fields.filter(function(f){return f.required && !fields[f.key];});
  if(missing.length){toast('Please fill in: '+missing.map(function(f){return f.label;}).join(', '),'error');return}
  var plats=[];
  document.querySelectorAll('.plat').forEach(function(l){
    if(!l.querySelector('input').checked)return;
    var tx=l.textContent.trim();
    if(tx.includes('WhatsApp'))plats.push('WhatsApp');
    else if(tx.includes('Instagram'))plats.push('Instagram');
    else if(tx.includes('Facebook'))plats.push('Facebook');
    else if(tx.includes('Twitter'))plats.push('Twitter');
    else if(tx.includes('LinkedIn'))plats.push('LinkedIn');
    else if(tx.includes('TikTok'))plats.push('TikTok');
    else if(tx.includes('Snapchat'))plats.push('Snapchat');
    else if(tx.includes('Reddit'))plats.push('Reddit');
    else if(tx.includes('Quora'))plats.push('Quora');
  });
  if(!plats.length){toast('Please select at least one platform','error');return}
  var feats=[];
  document.querySelectorAll('#featGrid input:checked').forEach(function(c){feats.push(c.value);});
  var ex=document.getElementById('extraDetails').value.trim();
  var btn=document.getElementById('genBtn');
  btn.disabled=true;btn.classList.add('loading');btn.querySelector('.btxt').textContent='Writing your '+industryCfg.heroVerb+'...';
  document.getElementById('emptyState').style.display='none';
  document.getElementById('resultsContainer').innerHTML='';
  t0=Date.now();
  var r=await api('/api/generate',{method:'POST',body:{industry:INDUSTRY_SLUG,fields:fields,features:feats,extra:ex,tone:tone,platforms:plats}});
  btn.disabled=false;btn.classList.remove('loading');btn.querySelector('.btxt').textContent='Generate '+(industryCfg.heroVerb.charAt(0).toUpperCase()+industryCfg.heroVerb.slice(1));
  if(r.error){if(r.upgrade)openUpgrade();else toast(r.error,'error');document.getElementById('emptyState').style.display='block';return}
  if(r.usage){cUsage=r.usage;renderUI();}
  if(!r.content){toast('No content returned from AI. Check your Groq API key in .env','error');document.getElementById('emptyState').style.display='block';console.error('No content in response:',r);return;}
  var parsed=parseC(r.content,plats);
  window._lastParsed=parsed;
  window._lastMeta={industry:INDUSTRY_SLUG,fields:fields,date:new Date().toISOString()};
  document.getElementById('emptyState').style.display='none';
  document.getElementById('resultsContainer').style.display='block';
  renderR(parsed);gCount++;
  trackEvent('generate_listing',{platform_count:plats.length,industry:INDUSTRY_SLUG});
  var elapsed=((Date.now()-t0)/1000).toFixed(1),wds=r.content.split(' ').filter(Boolean).length;
  var sb=document.getElementById('statsBar');sb.classList.add('show');
  document.getElementById('stot').textContent=gCount;
  document.getElementById('splat').textContent=plats.length;
  document.getElementById('stime').textContent=Math.round(plats.length*18)+'m';
  document.getElementById('swords').textContent=wds;
  toast('Generated '+(plats.length+2)+' '+industryCfg.heroVerb+' in '+elapsed+'s','success');
}

function parseC(text,plats){
  var s={};
  var keys=['FULL LISTING','WHATSAPP','INSTAGRAM','FACEBOOK','TWITTER','LINKEDIN','TIKTOK','SNAPCHAT','REDDIT','QUORA','HEADLINES'];
  var map={'FULL LISTING':'listing','WHATSAPP':'whatsapp','INSTAGRAM':'instagram','FACEBOOK':'facebook','TWITTER':'twitter','LINKEDIN':'linkedin','TIKTOK':'tiktok','SNAPCHAT':'snapchat','REDDIT':'reddit','QUORA':'quora','HEADLINES':'headlines'};
  // Split by section headers instead of regex to avoid escape issues
  for(var i=0;i<keys.length;i++){
    var header='['+keys[i]+']';
    var idx=text.toUpperCase().indexOf(header);
    if(idx===-1)continue;
    var start=idx+header.length;
    // Find next section header
    var end=text.length;
    for(var j=0;j<keys.length;j++){
      if(j===i)continue;
      var nextIdx=text.toUpperCase().indexOf('['+keys[j]+']',start);
      if(nextIdx>-1&&nextIdx<end)end=nextIdx;
    }
    s[map[keys[i]]]=text.slice(start,end).trim();
  }
  return s;
}

var rcIconMap={listing:'icon-compose',whatsapp:'icon-wa',instagram:'icon-ig',facebook:'icon-fb',twitter:'icon-tw',linkedin:'icon-ln',tiktok:'icon-tk',snapchat:'icon-sc',reddit:'icon-rd',quora:'icon-qa',headlines:'icon-generate'};

var rcLabelMap={listing:'Full Property Listing',whatsapp:'WhatsApp Message',instagram:'Instagram Caption',facebook:'Facebook Post',twitter:'Twitter Post',linkedin:'LinkedIn Post',tiktok:'TikTok Caption',snapchat:'Snapchat Caption',reddit:'Reddit Post',quora:'Quora Answer',headlines:'Headline Options'};

function buildShareUrl(k, text) {
  var enc = encodeURIComponent(text);
  var map = {
    whatsapp:  'https://wa.me/?text=' + enc,
    facebook:  'https://www.facebook.com/sharer/sharer.php?u=&quote=' + enc,
    twitter:   'https://twitter.com/intent/tweet?text=' + enc,
    linkedin:  'https://www.linkedin.com/shareArticle?mini=true&summary=' + enc,
    instagram: 'https://www.instagram.com/',
    tiktok:    'https://www.tiktok.com/upload',
    snapchat:  'https://www.snapchat.com/',
    reddit:    'https://www.reddit.com/submit?selftext=true&text=' + enc,
    quora:     'https://www.quora.com/'
  };
  return map[k] || null;
}

function openShareBtn(btn, k) {
  var card = btn.closest('.result-card');
  var txt = card.querySelector('.rc-content').textContent;
  var url = buildShareUrl(k, txt);
  if (url) window.open(url, '_blank');
}

function renderR(p){
  var c=document.getElementById('resultsContainer');c.innerHTML='';
  document.getElementById('emptyState').style.display='none';
  var badges={listing:'rb-main',whatsapp:'rb-wa',instagram:'rb-ig',facebook:'rb-fb',twitter:'rb-tw',linkedin:'rb-ln',tiktok:'rb-tk',snapchat:'rb-sc',reddit:'rb-rd',quora:'rb-qa',headlines:'rb-main'};
  var labels={listing:'Full Property Listing',whatsapp:'WhatsApp Message',instagram:'Instagram Caption',facebook:'Facebook Post',twitter:'Twitter Post',linkedin:'LinkedIn Post',tiktok:'TikTok Caption',snapchat:'Snapchat Caption',reddit:'Reddit Post',quora:'Quora Answer',headlines:'Headline Options'};
  var ord=['listing','whatsapp','instagram','tiktok','snapchat','facebook','twitter','linkedin','reddit','quora','headlines'];
  var d=0;
  ord.forEach(function(k){
    if(!p[k])return;
    var w=p[k].split(/\s+/).filter(Boolean).length;
    var div=document.createElement('div');
    div.className='result-card';
    div.style.animationDelay=d+'ms';
    var badge=badges[k]||'rb-l';
    var label=labels[k]||k;
    var isSerif=(k==='listing');
    div.innerHTML=
      '<div class="rc-head">'+
        '<div class="rc-label">'+
          '<span class="rc-badge '+badge+'">'+k.toUpperCase()+'</span>'+
          '<span class="rc-title">'+label+'</span>'+
        '</div>'+
        '<div class="rc-actions">'+
          (buildShareUrl(k,'')?'<button class="btn-open btn-open-'+k+'" onclick="openShareBtn(this,\''+k+'\')">Open '+k.charAt(0).toUpperCase()+k.slice(1)+'</button>':'')+
          '<button class="btn-redo" onclick="redoS(this,\''+k+'\')">Redo</button>'+
          '<button class="btn-copy" onclick="cpR(this)">Copy</button>'+
        '</div>'+
      '</div>'+
      '<div class="rc-content'+(isSerif?' serif':'')+'" data-k="'+k+'">'+escH(p[k])+'</div>'+
      '<div class="rc-footer">'+w+' words</div>';
    c.appendChild(div);d+=60;
  });
  var sb=document.createElement('div');sb.style.cssText='display:flex;justify-content:flex-end;margin-top:16px';
  sb.innerHTML='<button onclick="saveOutput()" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:var(--leaf);color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sans)">&#128190; Save This Listing</button>';
  c.appendChild(sb);
}

function cpR(btn){
  var txt=btn.closest('.result-card').querySelector('.rc-content').textContent;
  navigator.clipboard.writeText(txt).then(function(){
    btn.classList.add('done');
    btn.innerHTML='<svg width="13" height="13" color="white"><use href="#icon-check"/></svg> Copied';
    setTimeout(function(){btn.classList.remove('done');btn.innerHTML='<svg width="13" height="13" color="currentColor"><use href="#icon-copy"/></svg> Copy';},2000);
  });
}

async function redoS(btn,k){
  var card=btn.closest('.result-card'),el=card.querySelector('.rc-content'),orig=el.textContent;
  btn.innerHTML='<svg width="13" height="13" color="currentColor"><use href="#icon-redo"/></svg> ...';btn.disabled=true;
  var pm={whatsapp:'WhatsApp',instagram:'Instagram',facebook:'Facebook',twitter:'Twitter',linkedin:'LinkedIn',tiktok:'TikTok',snapchat:'Snapchat',reddit:'Reddit',quora:'Quora'};var plat=pm[k]||'WhatsApp';
  var fields=collectDynFields();
  var ex=document.getElementById('extraDetails').value.trim();
  var r=await api('/api/generate',{method:'POST',body:{industry:INDUSTRY_SLUG,fields:fields,extra:ex,features:[],tone:tone,platforms:[plat]}});
  if(r.error){toast(r.error,'error');el.textContent=orig;}
  else{var p=parseC(r.content,[plat]);el.textContent=p[k]||p.whatsapp||p.listing||orig;toast('Rewritten!','success');}
  btn.innerHTML='<svg width="13" height="13" color="currentColor"><use href="#icon-redo"/></svg> Redo';btn.disabled=false;
}

function tFeat(l){var c=l.querySelector('input');c.checked=!c.checked;l.classList.toggle('on',c.checked);var ck=l.querySelector('.feat-check');if(c.checked){ck.innerHTML='<svg width="11" height="11"><use href="#icon-check"/></svg>';ck.style.background='var(--leaf)';ck.style.borderColor='var(--leaf)';}else{ck.innerHTML='';ck.style.background='';ck.style.borderColor='';}}
function sTone(btn,t){document.querySelectorAll('.tone-btn').forEach(function(b){b.classList.remove('on');});btn.classList.add('on');tone=t;}
function tPlat(l){var c=l.querySelector('input');c.checked=!c.checked;l.classList.toggle('on',c.checked);}

function saveOutput(){
  if(!window._lastParsed||!Object.keys(window._lastParsed).length){toast('Nothing to save — generate a listing first.','error');return;}
  var meta=window._lastMeta||{};
  var f=meta.fields||{};
  var firstKey=industryCfg?industryCfg.fields[0].key:null;
  var title=(f[firstKey]||(industryCfg?industryCfg.entityLabel:'Listing'))+(f.location?' — '+f.location:'');
  var saves=JSON.parse(localStorage.getItem('ps_saves')||'[]');
  saves.unshift({title:title,meta:meta,content:window._lastParsed,date:meta.date||new Date().toISOString()});
  if(saves.length>50)saves=saves.slice(0,50);
  try{
    localStorage.setItem('ps_saves',JSON.stringify(saves));
    toast((industryCfg?industryCfg.entityLabel:'Listing')+' saved! View it in the Saved tab.','success');
  }catch(e){toast('Storage full — delete some saved listings first.','error');}
}

function renderSaved(){
  var saves=JSON.parse(localStorage.getItem('ps_saves')||'[]');
  var c=document.getElementById('savedList');if(!c)return;
  if(!saves.length){
    c.innerHTML='<div style="text-align:center;padding:60px 20px;color:var(--muted)"><svg width="36" height="36" color="var(--muted)" style="opacity:0.3;margin-bottom:12px"><use href="#icon-templates"/></svg><p style="font-size:13px;max-width:260px;margin:8px auto;line-height:1.6">No saved listings yet.<br>Generate a listing then click <strong>Save This Listing</strong>.</p></div>';
    return;
  }
  c.innerHTML=saves.map(function(s,i){
    var preview='';
    if(s.content){var keys=Object.keys(s.content);var first=s.content.listing||s.content[keys[0]]||'';preview=first.substring(0,120)+(first.length>120?'...':'');}
    var date=s.date?new Date(s.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'';
    return '<div style="background:white;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px;cursor:pointer" onclick="openSaved('+i+')">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px">'+
        '<div>'+
          '<div style="font-weight:600;font-size:14px">'+escH(s.title)+'</div>'+
          '<div style="font-size:11px;color:var(--muted);margin-top:2px">'+date+(s.meta&&s.meta.fields&&s.meta.fields.price?' · '+escH(s.meta.fields.price):'')+'</div>'+
        '</div>'+
        '<button onclick="event.stopPropagation();deleteSaved('+i+')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;color:var(--muted);font-family:var(--sans)">Delete</button>'+
      '</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:8px;font-style:italic;line-height:1.5">'+escH(preview)+'</div>'+
    '</div>';
  }).join('');
}

function openSaved(i){
  var saves=JSON.parse(localStorage.getItem('ps_saves')||'[]');
  var s=saves[i];if(!s)return;
  var labels={listing:'Full Listing',whatsapp:'WhatsApp',instagram:'Instagram',facebook:'Facebook',twitter:'Twitter',linkedin:'LinkedIn',tiktok:'TikTok',snapchat:'Snapchat',reddit:'Reddit',quora:'Quora',headlines:'Headlines'};
  var ord=['listing','whatsapp','instagram','tiktok','snapchat','facebook','twitter','linkedin','reddit','quora','headlines'];
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  var box=document.createElement('div');
  box.style.cssText='background:white;border-radius:16px;padding:28px;max-width:640px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)';
  var header=document.createElement('div');
  header.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:16px';
  var titleEl=document.createElement('div');
  titleEl.style.cssText='font-size:15px;font-weight:700;flex:1;padding-right:16px';
  titleEl.textContent=s.title||'Saved Listing';
  var closeBtn=document.createElement('button');
  closeBtn.style.cssText='background:none;border:none;cursor:pointer;font-size:24px;color:var(--muted);line-height:1;flex-shrink:0';
  closeBtn.textContent='×';
  closeBtn.onclick=function(){overlay.remove();};
  header.appendChild(titleEl);header.appendChild(closeBtn);box.appendChild(header);
  if(s.content){
    ord.forEach(function(k){
      if(!s.content[k])return;
      var sec=document.createElement('div');sec.style.marginBottom='14px';
      var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px';
      var lbl=document.createElement('span');lbl.style.cssText='font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted)';lbl.textContent=labels[k]||k;
      var cpBtn=document.createElement('button');cpBtn.style.cssText='font-size:11px;font-weight:600;color:var(--leaf);background:none;border:1px solid rgba(46,122,82,0.3);border-radius:5px;padding:3px 8px;cursor:pointer;font-family:var(--sans)';cpBtn.textContent='Copy';
      var txt=s.content[k];
      cpBtn.onclick=function(){navigator.clipboard.writeText(txt).then(function(){toast('Copied!','success');});};
      var body=document.createElement('div');body.style.cssText='background:var(--paper);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word';body.textContent=txt;
      row.appendChild(lbl);row.appendChild(cpBtn);sec.appendChild(row);sec.appendChild(body);box.appendChild(sec);
    });
  }
  overlay.appendChild(box);
  overlay.addEventListener('click',function(e){if(e.target===this)this.remove();});
  document.body.appendChild(overlay);
}

function deleteSaved(i){
  var saves=JSON.parse(localStorage.getItem('ps_saves')||'[]');
  saves.splice(i,1);localStorage.setItem('ps_saves',JSON.stringify(saves));renderSaved();toast('Deleted.','info');
}


async function loadHist(){
  var c=document.getElementById('histList'),s=document.getElementById('histStats');if(!c)return;
  if(s)s.innerHTML='<div class="stat-card"><div class="stat-n">0</div><div class="stat-l">Campaigns</div></div><div class="stat-card"><div class="stat-n">0</div><div class="stat-l">Listings Made</div></div><div class="stat-card"><div class="stat-n">'+(cUsage?cUsage.used:0)+'</div><div class="stat-l">This Month</div></div>';
  c.innerHTML='<div style="text-align:center;padding:48px;color:var(--muted)"><svg width="36" height="36" color="var(--muted)" style="margin-bottom:12px;opacity:0.4"><use href="#icon-history"/></svg><br><br>No history yet &mdash; generate your first listing!</div>';
}
function clearHist(){toast('History cleared','info');}

async function loadAdmin(){
  var st=await api('/api/admin/stats'),us=await api('/api/admin/users');
  var sa=document.getElementById('adminStats');
  if(sa)sa.innerHTML='<div class="stat-card"><div class="stat-n">'+(st.total_users||0)+'</div><div class="stat-l">Total Users</div></div><div class="stat-card"><div class="stat-n">'+(st.paid_users||0)+'</div><div class="stat-l">Paid Users</div></div><div class="stat-card"><div class="stat-n">'+(st.total_generations||0)+'</div><div class="stat-l">Generations</div></div>';
  var pc={free:'pb-free',starter:'pb-starter',pro:'pb-pro',agency:'pb-agency'};
  document.getElementById('adminBody').innerHTML=(us||[]).map(function(u){
    return '<tr><td><div style="font-weight:600">'+escH(u.name||'&mdash;')+'</div><div style="font-size:11px;color:var(--muted);font-family:var(--mono)">'+escH(u.email)+'</div></td><td><span class="plan-badge '+(pc[u.plan]||'pb-free')+'">'+u.plan+'</span></td><td>'+((u.total_gens)||0)+'</td><td style="font-size:11px;font-family:var(--mono)">'+(((u.created_at||'').split(' ')[0])||'&mdash;')+'</td><td style="font-size:11px;font-family:var(--mono)">'+(u.last_login?u.last_login.split(' ')[0]:'Never')+'</td><td><select class="plan-sel" onchange="setP('+u.id+',this.value)">'+['free','starter','pro','agency'].map(function(p){return'<option value="'+p+'"'+(u.plan===p?' selected':'')+'>'+p+'</option>';}).join('')+'</select></td></tr>';
  }).join('');
}

async function setP(uid,plan){var r=await api('/api/admin/set-plan',{method:'POST',body:{userId:uid,plan:plan}});if(r.success)toast('Plan updated!','success');else toast(r.error||'Failed','error');}

function openUpgrade(){document.getElementById('upModal').classList.add('open');trackEvent('view_upgrade_modal');}
function closeUp(){document.getElementById('upModal').classList.remove('open');}
document.getElementById('upModal').addEventListener('click',function(e){if(e.target.id==='upModal')closeUp();});

// ══════════ LEGAL / SUPPORT CONTENT ══════════
function openLegal(key){
  var c = LEGAL_CONTENT[key]; if(!c) return;
  document.getElementById('legalTitle').textContent = c.title;
  document.getElementById('legalBody').innerHTML = c.html;
  document.getElementById('legalBody').scrollTop = 0;
  document.getElementById('legalModal').classList.add('open');
}
function closeLegal(){ document.getElementById('legalModal').classList.remove('open'); }
document.getElementById('legalModal').addEventListener('click',function(e){if(e.target.id==='legalModal')closeLegal();});

// ══════════ GOOGLE TAG MANAGER (loads only after consent) ══════════
var gaLoaded = false;
function loadGA(){
  if(gaLoaded || !window.GTM_ID) return;
  var f=document.getElementsByTagName('script')[0], j=document.createElement('script');
  j.async=true; j.src='https://www.googletagmanager.com/gtm.js?id='+window.GTM_ID;
  f.parentNode.insertBefore(j,f);
  dataLayer.push({'gtm.start': new Date().getTime(), event:'gtm.js'});
  gaLoaded = true;
}
function trackEvent(name, params){
  if(!gaLoaded) return;
  dataLayer.push(Object.assign({event:name}, params||{}));
}

// ══════════ COOKIE CONSENT ══════════
function setCookieConsent(granted){
  localStorage.setItem('eb_cookie_consent', granted ? 'granted' : 'denied');
  document.getElementById('cookieBanner').classList.remove('show');
  if(granted) loadGA();
}
function openCookieSettings(){
  document.getElementById('cookieBanner').classList.add('show');
}
(function initConsent(){
  var c = localStorage.getItem('eb_cookie_consent');
  if(c === 'granted'){ loadGA(); }
  else if(c === null){ setTimeout(function(){ document.getElementById('cookieBanner').classList.add('show'); }, 900); }
  // c === 'denied' → do nothing, respect the choice
})();

async function api(path,opts){
  try{var r=await fetch(path,{method:opts&&opts.method||'GET',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:opts&&opts.body?JSON.stringify(opts.body):undefined});return r.json();}
  catch(e){return{error:'Network error: '+e.message};}
}
async function apiNA(path,opts){
  try{var r=await fetch(path,{method:opts&&opts.method||'GET',headers:{'Content-Type':'application/json'},body:opts&&opts.body?JSON.stringify(opts.body):undefined});return r.json();}
  catch(e){return{error:'Network error: '+e.message};}
}

function toast(m,t){var el=document.getElementById('toast');el.textContent=m;el.className='toast show '+(t||'info');clearTimeout(window._tt);window._tt=setTimeout(function(){el.classList.remove('show');},3500);}
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
