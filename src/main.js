import './motio.js';
import './map.js';
import './recap-scene.js';
import './mascot.js';
import { mount } from './dc-runtime.js';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { SystemBars, SystemBarsStyle, Capacitor, registerPlugin } from '@capacitor/core';

const app = document.getElementById('app');
const viewport = document.getElementById('viewport');
const barTop = document.getElementById('bar-top');
const barBot = document.getElementById('bar-bot');

// The screens are drawn on a 390 px wide canvas: scale that to the phone and give it the extra height.
function fit() {
  const r = viewport.getBoundingClientRect();
  const k = r.width / 390;
  app.style.transform = 'scale(' + k + ')';
  app.style.height = r.height / k + 'px';
}
window.addEventListener('resize', fit);
fit();

// The system bars take the colour of the screen under them, so the app looks edge to edge.
const colorAt = (x, y) => {
  for (const el of document.elementsFromPoint(x, y)) {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
  }
  return 'rgb(75, 63, 216)';
};
const isLight = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
};
let lastTop = '', lastBot = '', lastStyle = '', pending = false;
const SHEET = 'section[aria-label], aside[aria-label], [role=alertdialog], [role=dialog]';
// The page you're going to: the top overlay that isn't leaving, else the current tab. Reading its colour
// straight away (not the pixel under the bar) means the bars change as the page starts to move, not after.
function destination() {
  let best = null, bestZ = -1;
  for (const el of app.querySelectorAll('[data-page=overlay]')) {
    if (/Out /.test(el.style.animation)) continue;
    const z = +el.style.zIndex || 0;
    if (z >= bestZ) { best = el; bestZ = z; }
  }
  return best || app.querySelector('[data-page=tab][aria-hidden=false]');
}
window.__motioPage = destination;
const clear = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
// Colour at a spot of a page, measured relative to the page so it works mid-slide or off screen.
function colorIn(page, fromTop) {
  const pr = page.getBoundingClientRect();
  const x = pr.left + 3, y = fromTop ? pr.top + 3 : pr.bottom - 3;
  // Walk down the tree to the spot: at each level take the last child covering it (the one drawn on top).
  let found = null;
  for (let el = page; el;) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') break;
    if (!clear(cs.backgroundColor)) found = cs.backgroundColor;
    let next = null;
    for (const c of el.children) {
      if (c.tagName === 'NAV' || c.tagName === 'SCRIPT') continue;
      const r = c.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) next = c;
    }
    el = next;
  }
  return found;
}
let cached = { page: null, stale: true };
function syncBars() {
  pending = false;
  // Sheets, drawers and dialogs sit under the tab bar in the page stack, so the bar steps aside while one is open.
  app.classList.toggle('has-sheet', !!app.querySelector(SHEET));
  const r = viewport.getBoundingClientRect();
  const page = destination();
  // Reading a page's colours walks all its elements, so only do it when the page changes or an animation ends,
  // not on every style change while a finger drags.
  let top, bot;
  if (page && page === cached.page && !cached.stale) { top = cached.top; bot = cached.bot; }
  else {
    top = (page && colorIn(page, true)) || colorAt(r.left + 3, r.top + 3);
    bot = (page && colorIn(page, false)) || colorAt(r.left + 3, r.bottom - 3);
    cached = { page, top, bot, stale: false };
  }
  if (top !== lastTop) { lastTop = top; barTop.style.backgroundColor = top; }
  if (bot !== lastBot) { lastBot = bot; barBot.style.backgroundColor = bot; }
  const style = isLight(top) ? SystemBarsStyle.Light : SystemBarsStyle.Dark;
  if (style !== lastStyle) { lastStyle = style; SystemBars.setStyle({ style }).catch(() => {}); }
}
const scheduleSync = () => { if (!pending) { pending = true; requestAnimationFrame(syncBars); } };
new MutationObserver(scheduleSync).observe(app, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'aria-hidden'] });
const settle = () => { cached.stale = true; scheduleSync(); };
document.addEventListener('transitionend', settle, true);
document.addEventListener('animationend', settle, true);

mount('App', app);
syncBars();

// The system splash is plain purple, so drop it at once and let the page's own opening animation play on the
// same colour. The intro lifts away once the app has painted and the animation has had its moment (about 1.2 s).
SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
const intro = document.getElementById('intro');
const started = performance.now();
const endIntro = () => {
  if (!intro || intro.classList.contains('out')) return;
  syncBars();
  intro.classList.add('out');
  setTimeout(() => intro.remove(), 450);
};
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(() => {
  const wait = Math.max(0, 1250 - (performance.now() - started));
  setTimeout(() => requestAnimationFrame(endIntro), wait);
});
setTimeout(endIntro, 3500);

// Invite links (https://…/i/CODE or motio://add/CODE): keep the code and open Friends, which sends the request.
const takeInvite = (url) => {
  const m = /(?:\/i\/|add\/)([A-Za-z0-9]{6})/.exec(url || '');
  if (!m) return;
  window.__motioInvite = m[1].toUpperCase();
  if (window.__motioGo) window.__motioGo('friends');
  // Friends may already be open (it won't mount again), so tell it there's a new code.
  window.dispatchEvent(new Event('motio:invite'));
};
// Shared card links (https://…/s/CODE or motio://s/CODE): open the person who shared it (or You, if it's yours).
const takeShare = (url) => {
  const m = /(?:\/s\/|\/\/s\/)([a-z0-9]{6,12})/.exec(url || '');
  if (!m || !window.Motio) return;
  window.Motio.sharedCard(m[1]).then((r) => {
    const me = window.Motio.auth.user();
    if (me && r.user.id === me.id) { if (window.__motioGo) window.__motioGo('you'); return; }
    window.__motioFriend = r.user.id;
    if (window.__motioGo) window.__motioGo('friend');
  }).catch(() => {});
};
const takeLink = (url) => { takeInvite(url); takeShare(url); };
CapApp.addListener('appUrlOpen', (e) => takeLink(e.url));
CapApp.getLaunchUrl().then((r) => r && takeLink(r.url)).catch(() => {});
CapApp.addListener('backButton', () => {
  if (!(window.__motioBack && window.__motioBack())) CapApp.minimizeApp();
}).catch(() => {});

// In-app updates: a newer signed APK on GitHub Releases (named motio-<versionCode>.apk) shows an update card
// on the main tabs; the Update page (design/Update.dc.html) downloads it (pause, resume, cancel) and installs it.
const Updater = registerPlugin('Updater');
const RELEASES = 'https://api.github.com/repos/kenan-karimli/motio/releases/latest';
let updateCheckedAt = 0;
const setUpdate = (patch) => { window.__motioUpdate = { ...window.__motioUpdate, ...patch }; window.dispatchEvent(new Event('motio:update')); };
async function checkUpdate() {
  if (!Capacitor.isNativePlatform() || Date.now() - updateCheckedAt < 3600000 || window.__motioUpdate) return;
  updateCheckedAt = Date.now();
  try {
    const [rel, me] = await Promise.all([fetch(RELEASES).then((r) => (r.ok ? r.json() : null)), Updater.version()]);
    const asset = rel && (rel.assets || []).find((a) => /^motio-\d+\.apk$/.test(a.name));
    if (!asset || Number(asset.name.match(/\d+/)[0]) <= Number(me.code)) return;
    const name = String(rel.tag_name).replace(/^v/, '');
    // A download paused or finished in an earlier session picks up where it was.
    const st = await Updater.status({ name });
    setUpdate({ name, url: asset.browser_download_url, total: asset.size, got: st.partial, pct: Math.round(st.partial / asset.size * 100),
      notes: String(rel.body || ''), date: rel.published_at, current: me.name, state: st.downloaded ? 'downloaded' : st.partial ? 'paused' : 'ready' });
  } catch (e) { updateCheckedAt = 0; /* offline: try again next time the app opens */ }
}
let progressSub = null;
// One entry point for the Update page and the card: download, pause, resume, cancel, install.
window.__motioUpdateDo = async (action) => {
  const u = window.__motioUpdate;
  if (!u) return;
  const name = u.name;
  if (action === 'pause') return Updater.pause();
  if (action === 'cancel') { await Updater.cancel({ name }); if (u.state !== 'downloading') setUpdate({ state: 'ready', pct: 0, got: 0 }); return; }
  if (action === 'install') {
    try { const r = await Updater.install({ name }); setUpdate({ state: r.needsPermission ? 'permission' : 'installing' }); }
    catch (e) { setUpdate({ state: e.code === 'missing' ? 'ready' : 'failed' }); }
    return;
  }
  if (u.state === 'downloading') return;
  setUpdate({ state: 'downloading' });
  if (!progressSub) progressSub = await Updater.addListener('progress', (e) => setUpdate({ pct: e.pct, got: e.got, total: e.total || u.total }));
  try {
    const r = await Updater.download({ url: u.url, name });
    if (r.done) { setUpdate({ state: 'downloaded', pct: 100 }); window.__motioUpdateDo('install'); }
    else if (r.paused) setUpdate({ state: 'paused' });
    else setUpdate({ state: 'ready', pct: 0, got: 0 });
  } catch (e) { setUpdate({ state: e.code === 'busy' ? 'downloading' : 'failed' }); }
};
setTimeout(checkUpdate, 3000);
CapApp.addListener('appStateChange', ({ isActive }) => {
  if (!isActive) return;
  checkUpdate();
  // Back from Android's "allow installs" screen: carry on installing.
  if (window.__motioUpdate && window.__motioUpdate.state === 'permission') window.__motioUpdateDo('install');
});
