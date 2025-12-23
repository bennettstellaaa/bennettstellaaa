// script.js — updated
const CONFIRM_OVERLAY_ID = 'heroOverlay';
const HERO_BTN_ID = 'heroBtn';
const COUNTAPI_NAMESPACE = 'bennettstellaaa_global';
const COUNTAPI_KEYS_PREFIX = 'site';

// flag to avoid repeated failing CountAPI requests
let countapiAvailable = true;

// util: LA time
function getLATimeISO() {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
    const parts = fmt.formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    if (parts.year) return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  } catch (e) { return new Date().toISOString(); }
}

// GA helper
function sendGAEvent(name, params = {}) {
  if (typeof window.gtag === 'function') {
    try { window.gtag('event', name, params); } catch (e) { /* silent */ }
  }
}

// fire-and-forget CountAPI with availability toggle
function fireAndForgetCountAPI(namespace, key) {
  if (!countapiAvailable) return;
  const url = `https://api.countapi.xyz/hit/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
  fetch(url).then(r => {
    if (!r.ok) throw new Error('CountAPI error ' + r.status);
    return r.json();
  }).catch(e => {
    // on first failure, disable further CountAPI attempts to avoid console noise
    countapiAvailable = false;
    // do not spam console; keep it quiet
  });
}

// local fallback
function localStoreEvent(type, id) {
  try {
    const store = JSON.parse(localStorage.getItem('linkpage_events') || '[]');
    store.push({type, id, at: new Date().toISOString()});
    localStorage.setItem('linkpage_events', JSON.stringify(store));
  } catch (e) {}
}

// DOM logic
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const heroBtn = document.getElementById(HERO_BTN_ID);
  const overlay = document.getElementById(CONFIRM_OVERLAY_ID);
  const overlayOpen = document.getElementById('overlayOpen');
  const overlayCancel = document.getElementById('overlayCancel');

  // ensure overlayOpen returned to normal (covers return from bfcache)
  resetOverlayOpenState();

  // initial page view tracking (non-blocking)
  trackPageView();

  // links tracking
  document.querySelectorAll('.link').forEach(a => {
    a.addEventListener('click', () => {
      const id = a.dataset.id || a.href;
      const laTime = getLATimeISO();
      sendGAEvent('link_click', {link_id: id, link_url: a.href, la_time: laTime});
      const dateKey = (new Date()).toISOString().slice(0,10).replace(/-/g,'');
      fireAndForgetCountAPI(COUNTAPI_NAMESPACE, `link_${id}`);
      fireAndForgetCountAPI(COUNTAPI_NAMESPACE, `link_${id}_${dateKey}`);
      localStoreEvent('link_click', id);
    });
  });

  // hero first click: show overlay and record view
  heroBtn.addEventListener('click', () => {
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(()=> {
      if (overlayOpen) overlayOpen.focus();
    }, 80);
    recordHeroView();
  });

  // overlay cancel
  overlayCancel.addEventListener('click', () => {
    if (document.activeElement) document.activeElement.blur();
    overlay.setAttribute('aria-hidden', 'true');
    setTimeout(()=> heroBtn.focus(), 50);
    resetOverlayOpenState();
  });

  // overlay Open: open immediately and fire analytics in background
  overlayOpen.addEventListener('click', () => {
    const href = heroBtn.dataset.href || heroBtn.getAttribute('data-href') || 'https://dfans.co/stellaa';

    // set loading state
    overlayOpen.disabled = true;
    overlayOpen.classList.add('loading');
    overlayOpen.innerHTML = '<span class="spinner" aria-hidden="true"></span><span class="sr-only">Opening...</span>';

    // open immediately in new tab (user gesture)
    try { window.open(href, '_blank', 'noopener'); } catch (err) {}

    // analytics (non-blocking)
    const laTime = getLATimeISO();
    sendGAEvent('hero_link_click', {link_id: 'hero', link_url: href, la_time: laTime});
    const dateKey = (new Date()).toISOString().slice(0,10).replace(/-/g,'');
    fireAndForgetCountAPI(COUNTAPI_NAMESPACE, 'hero_overall');
    fireAndForgetCountAPI(COUNTAPI_NAMESPACE, `hero_daily_${dateKey}`);
    localStoreEvent('hero_click', href);

    // close overlay and return focus normally after brief delay
    setTimeout(() => {
      if (document.activeElement) document.activeElement.blur();
      overlay.setAttribute('aria-hidden', 'true');
      // reset button state (so if user returns later, it will be normal)
      resetOverlayOpenState();
      setTimeout(()=> heroBtn.focus(), 50);
    }, 250);
  });

  // close overlay by clicking outside
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) {
      if (document.activeElement) document.activeElement.blur();
      overlay.setAttribute('aria-hidden', 'true');
      setTimeout(()=> heroBtn.focus(), 50);
      resetOverlayOpenState();
    }
  });

  // tap-scale microinteraction
  document.querySelectorAll('.link, .hero-button, .icon-btn, .btn').forEach(el=>{
    el.addEventListener('pointerdown', ()=> el.style.transform = 'scale(0.995)');
    el.addEventListener('pointerup', ()=> el.style.transform = '');
    el.addEventListener('pointercancel', ()=> el.style.transform = '');
    el.addEventListener('mouseleave', ()=> el.style.transform = '');
  });

  // handle pageshow (bfcache / back navigation) — reset UI and re-track pageview
  window.addEventListener('pageshow', (event) => {
    // when page is restored from bfcache, reinitialize UI states
    resetOverlayOpenState();
    const overlay = document.getElementById(CONFIRM_OVERLAY_ID);
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
    // re-track pageview (non-blocking)
    trackPageView();
  });
});

// helpers
function resetOverlayOpenState() {
  const overlayOpen = document.getElementById('overlayOpen');
  if (!overlayOpen) return;
  overlayOpen.disabled = false;
  overlayOpen.classList.remove('loading');
  overlayOpen.innerHTML = 'Open link';
}

function trackPageView() {
  const laTime = getLATimeISO();
  sendGAEvent('page_view', {la_time: laTime});
  const dateKey = (new Date()).toISOString().slice(0,10).replace(/-/g,'');
  fireAndForgetCountAPI(COUNTAPI_NAMESPACE, `${COUNTAPI_KEYS_PREFIX}_pageviews`);
  fireAndForgetCountAPI(COUNTAPI_NAMESPACE, `${COUNTAPI_KEYS_PREFIX}_pageviews_${dateKey}`);
  localStoreEvent('page_view', window.location.pathname);
}

function recordHeroView() {
  const dateKey = (new Date()).toISOString().slice(0,10).replace(/-/g,'');
  fireAndForgetCountAPI(COUNTAPI_NAMESPACE, 'hero_views');
  fireAndForgetCountAPI(COUNTAPI_NAMESPACE, `hero_views_${dateKey}`);
  localStoreEvent('hero_view', 'hero');
  sendGAEvent('hero_view', {la_time: getLATimeISO()});
}

// owner console helper (still available)
async function getCountAPI(namespace, key) {
  try {
    const url = `https://api.countapi.xyz/get/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('CountAPI get error ' + r.status);
    return await r.json();
  } catch (e) { return null; }
}

async function showOwnerStats() {
  try {
    const dateKey = (new Date()).toISOString().slice(0,10).replace(/-/g,'');
    const keys = [
      `${COUNTAPI_KEYS_PREFIX}_pageviews`,
      `${COUNTAPI_KEYS_PREFIX}_pageviews_${dateKey}`,
      'hero_views',
      `hero_views_${dateKey}`,
      'hero_overall',
      `hero_daily_${dateKey}`,
      'link_instagram',
      `link_instagram_${dateKey}`,
      'link_threads',
      `link_threads_${dateKey}`
    ];
    console.log('Counts (namespace):', COUNTAPI_NAMESPACE);
    for (const k of keys) {
      const r = await getCountAPI(COUNTAPI_NAMESPACE, k);
      console.log(k, r ? r.value : 'n/a');
    }
    console.log('Local events (this browser):', JSON.parse(localStorage.getItem('linkpage_events') || '[]'));
  } catch (e) { console.warn(e); }
}
window.showOwnerStats = showOwnerStats;
