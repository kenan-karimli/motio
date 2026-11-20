// Motio data layer: account + session, local trip store with server sync, live tracking, and the stats every screen reads.
import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import { drawWidget, KINDS as WIDGET_KINDS } from './widgets.js';
import { features, classifyTrip, vector } from './classify.js';
import { toCanvas, getFontEmbedCSS } from 'html-to-image';
import { renderStory } from './stories.js';

const Sensors = registerPlugin('MotioSensors');
const Health = registerPlugin('MotioHealth');
const native = Capacitor.isNativePlatform();
const API = window.__MOTIO_API || 'http://localhost:8787';
const KEY = 'motio.v1';
const MIN = 60000, HOUR = 3600000, DAY = 86400000;

export const MODES = {
  walk: { label: 'Walk', name: 'Walking', color: '#3DBF5C' },
  run: { label: 'Run', name: 'Running', color: '#F2766B' },
  bike: { label: 'Bike', name: 'Cycling', color: '#6E8CF7' },
  drive: { label: 'Drive', name: 'Driving', color: '#F6C343' },
  transit: { label: 'Transit', name: 'Bus & train', color: '#B57BE0' }
};
const ORDER = ['walk', 'drive', 'bike', 'transit', 'run'];

// ---------------------------------------------------------------- state
const blank = () => ({ token: null, user: null, trips: {}, lastSync: 0, dirty: {}, settings: { unit: 'km', goalMin: 180, stepGoal: 10000, recapStyle: 'mix', autoTrack: true }, demo: false, tracking: false });
let S = blank();
try { S = { ...S, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* first run */ }
// Never erase data on start. (Older builds wiped everything, the server copy too, when a version marker was
// missing, which a log out and back in caused.) Sample data is for this session only.
delete S.wipePending; S.v = 3; S.demo = false;
// Steps are kept per day now (yesterday's count used to vanish at midnight).
if (S.stepsDay) { S.stepsByDay = { ...(S.stepsByDay || {}), [S.stepsDay.day]: S.stepsDay.steps }; delete S.stepsDay; }
// Recaps now mix their designs by default; move everyone over once (they can still pick one style in Settings).
if (!S.settings.recapMixed) { S.settings = { ...S.settings, recapStyle: 'mix', recapMixed: true }; try { localStorage.setItem('motio.recapStyle', 'mix'); } catch { /* storage blocked */ } }
const listeners = new Set();
// Trips, with their GPS points, live in IndexedDB, one record each. localStorage only holds a few MB, and when
// it filled up every save failed silently and each launch went back to an old copy. Older builds kept trips in
// localStorage: they are copied over once (S.tripsInDb), and only then dropped from it.
let idbOff = false, tripsLoaded = false;
const savedAt = {}; // trip id -> updatedAt last written to IndexedDB
const tripDb = new Promise((ok, no) => {
  try {
    const r = indexedDB.open('motio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('trips', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  } catch (e) { no(e); }
});
export const ready = tripDb.then((db) => new Promise((ok) => {
  const req = db.transaction('trips').objectStore('trips').getAll();
  req.onsuccess = () => {
    for (const t of req.result) {
      savedAt[t.id] = t.updatedAt || 0;
      const mine = S.trips[t.id]; // a trip saved since launch (the live one closing) is newer
      if (!mine || (mine.updatedAt || 0) < (t.updatedAt || 0)) S.trips[t.id] = t;
    }
    ok();
  };
  req.onerror = () => { idbOff = true; ok(); };
})).catch(() => { idbOff = true; }).then(() => { tripsLoaded = true; changed(); });
function saveTrips() {
  const put = Object.values(S.trips).filter((t) => savedAt[t.id] !== (t.updatedAt || 0));
  const del = Object.keys(savedAt).filter((id) => !S.trips[id]);
  if (!put.length && !del.length) return Promise.resolve(true);
  return tripDb.then((db) => new Promise((ok, no) => {
    const tx = db.transaction('trips', 'readwrite'), st = tx.objectStore('trips');
    put.forEach((t) => st.put(t)); del.forEach((id) => st.delete(id));
    tx.oncomplete = () => { put.forEach((t) => { savedAt[t.id] = t.updatedAt || 0; }); del.forEach((id) => delete savedAt[id]); S.saveError = null; ok(true); };
    tx.onerror = tx.onabort = () => no(tx.error);
  })).catch((e) => { S.saveError = 'storage'; console.error('[motio] saving trips failed', e); return false; });
}
const flush = () => {
  try { localStorage.setItem(KEY, JSON.stringify(S.tripsInDb && !idbOff ? { ...S, trips: {} } : S)); } catch { S.saveError = 'full'; }
  if (idbOff || !tripsLoaded) return;
  saveTrips().then((ok) => {
    if (!ok || S.tripsInDb) return;
    S.tripsInDb = true; // every trip is in IndexedDB now: localStorage can let go of them
    try { localStorage.setItem(KEY, JSON.stringify({ ...S, trips: {} })); } catch { /* next flush retries */ }
  });
};
// The save below is debounced, so write right away when the app is closed or backgrounded.
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
let saveT = 0, version = 0;
// Saved changes (a trip, a setting) redraw straight away; live GPS ticks redraw at most once a second so
// they never land in the middle of a page animation every few hundred milliseconds.
let tickT = 0;
function changed(persist = true) {
  if (!persist) { if (!tickT) tickT = setTimeout(() => { tickT = 0; changed(null); }, 1000); return; }
  if (persist === null) persist = false;
  version++;
  cache.clear();
  if (persist) { clearTimeout(saveT); saveT = setTimeout(flush, 150); }
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  pushWidget();
}
// Home screen widgets. Ring, steps, streak and the compact bar are drawn natively from the numbers sent here (so
// they keep counting steps and roll over at midnight with Motio closed); the richer ones are images drawn here.
let widgetT = 0, widgetLast = 0, widgetForce = false, widgetSig = '', pngSig = '', pngAt = 0, sentAt = 0, widgetSocial = { at: 0 };
// Everything the widgets show, from today's and this week's trips.
function widgetData() {
  const t = today(), cfg = S.settings, now = Date.now();
  const goal = cfg.goalMin || 180, stepGoal = cfg.stepGoal || 10000;
  let streak = 0;
  for (let d = dayStart() - (t.min >= 1 ? 0 : DAY); streak < 400 && summarize(d, d + DAY).min >= 1; d -= DAY) streak++;
  const w0 = weekStart(), wk = summarize(w0, w0 + 7 * DAY), elapsed = now - w0, prev = summarize(w0 - 7 * DAY, w0 - 7 * DAY + elapsed);
  const vs = prev.m ? Math.round((wk.m / prev.m - 1) * 100) : null;
  const p = personality(), top = summarize(now - 30 * DAY, now).modes[0];
  return {
    time: fmtMin(t.min), goal: fmtMin(goal), pct: t.min / goal, steps: fmtNum(t.steps), stepPct: t.steps / stepGoal, stepGoalK: Math.round(stepGoal / 1000),
    dist: fmtDist(t.m), day0: dayStart(), trips: t.trips.map((x) => ({ start: x.start, end: Math.min(x.end, now), color: MODES[x.mode].color })),
    modes: t.modes.map((x) => ({ label: x.label, color: x.color })), streak,
    persona: p.enough ? p.name : 'Still warming up', personaLine: p.enough && top ? top.pct + '% ' + top.name.toLowerCase() : 'Move 3h to get your type',
    weekDist: fmtDist(wk.m), weekVs: vs == null ? 'First week on Motio' : (vs >= 0 ? '▲ ' : '▼ ') + Math.abs(vs) + '% vs last week', weekUp: vs == null || vs >= 0,
    peak: wk.peak == null ? '' : fmtHour(wk.peak), bars: days(w0, 7).map((d) => Math.round(d.min)), labels: days(w0, 7).map((d) => new Date(d.from).toLocaleDateString('en-GB', { weekday: 'narrow' })),
    todayI: Math.round((dayStart() - w0) / DAY),
    // Raw numbers for the natively drawn widgets, which carry on from these with Motio closed.
    stepsN: Math.round(t.steps), stepGoal, moved: t.min >= 1, zero: { time: fmtMin(0), dist: fmtDist(0) }
  };
}
// Friends' week and your running challenge, from the server at most every 15 minutes and only while one of those
// widgets is on the home screen.
async function socialForWidgets() {
  if (Date.now() - widgetSocial.at < 15 * MIN) return widgetSocial;
  const placed = await Sensors.widgetStatus().catch(() => ({}));
  if (!placed.friends && !placed.challenge) return widgetSocial;
  widgetSocial.at = Date.now();
  const [b, c] = await Promise.all([friends.board().catch(() => null), friends.challenges().catch(() => null)]);
  if (b && b.people) {
    const list = b.people.filter((p) => !p.hidden).sort((x, y) => y.activeMin - x.activeMin), rank = list.findIndex((p) => p.me) + 1;
    widgetSocial.friends = { n: list.length, rank, rows: list.slice(0, 3).map((p, i) => ({ rank: i + 1, me: !!p.me, name: p.me ? 'You' : String(p.name || '').split(' ')[0], min: p.activeMin, time: fmtMin(p.activeMin) })) };
  }
  if (c && c.challenges) {
    const x = c.challenges.find((y) => !y.done && !y.invited && y.members.some((m) => m.me && m.joined));
    // shortcut: km challenges stay in km for mile users (the server counts km), switch when challenges get units.
    const fmt = (v) => (x.kind === 'km' ? v + ' km' : x.kind === 'min' ? fmtMin(v) : v + (v === 1 ? ' run' : ' runs'));
    if (!x) widgetSocial.challenge = null;
    else {
      const joined = x.members.filter((m) => m.joined), me = joined.find((m) => m.me), top = joined[0], left = Math.ceil((x.end - Date.now()) / DAY);
      widgetSocial.challenge = { goal: fmt(x.target), mine: fmt(me.value), pct: x.target ? me.value / x.target : 0, n: joined.length, left: left <= 1 ? 'last day' : left + ' days left',
        lead: joined.length < 2 ? 'Keep going' : top.me ? 'You’re in the lead' : String(top.name).split(' ')[0] + ' leads with ' + fmt(top.value) };
    }
  }
  return widgetSocial;
}
// Throttled, not debounced: live GPS changes things every second, which used to keep pushing the redraw away.
function pushWidget(force) {
  if (!native) return;
  if (force) { widgetForce = true; clearTimeout(widgetT); widgetT = 0; }
  if (widgetT) return; // the pending run picks this change up too
  widgetT = setTimeout(sendWidgets, force ? 300 : Math.max(1000, widgetLast + 10000 - Date.now()));
}
async function sendWidgets() {
  const force = widgetForce;
  widgetT = 0; widgetForce = false; widgetLast = Date.now();
  pushLockCard(force);
  let ok = true;
  try {
    if (!S.token) widgetSocial = { at: 0 }; // never show the last account's friends
    const so = S.token ? await socialForWidgets() : null;
    const D = S.token ? { ...widgetData(), friends: so.friends || null, challenge: so.challenge || null } : { signedOut: true };
    const sig = JSON.stringify(D);
    // Also every half hour unchanged, so the widgets know the numbers are still current ("updated" stamp).
    if (sig !== widgetSig || force || Date.now() - sentAt > 30 * MIN) {
      sentAt = Date.now();
      await Sensors.widgetData({ json: JSON.stringify({ ...D, at: Date.now(), stepTotal: S.stepTotal == null ? -1 : S.stepTotal }) });
      widgetSig = sig;
    }
    // Images only when what they show changed (steps aren't on them), and at most once a minute.
    const { steps, stepsN, stepPct, ...shown } = D, ps = JSON.stringify(shown);
    if (D.signedOut || (ps === pngSig && !force)) return;
    if (!force && Date.now() - pngAt < MIN) { widgetT = setTimeout(sendWidgets, pngAt + MIN - Date.now()); return; }
    pngAt = Date.now();
    try { await document.fonts.load('700 40px Poppins'); } catch { /* system font is fine */ }
    for (const kind of WIDGET_KINDS) {
      try { await Sensors.updateWidget({ kind, png: drawWidget(kind, D).toDataURL('image/png').split(',')[1] }); }
      catch (e) { ok = false; console.warn('widget ' + kind, e); }
    }
    if (ok) pngSig = ps;
  } catch (e) { ok = false; widgetSig = ''; console.warn('widgets', e); }
  if (!ok && !widgetT) widgetT = setTimeout(sendWidgets, MIN); // try again rather than waiting for the next change
}
// Lock screen: Android gives apps no lock screen widgets, so "Today" lives in a silent, ongoing notification that
// shows there. Rewritten only when the numbers change.
let lockSig = '', lockChannel = false;
async function pushLockCard(force) {
  if (!native) return;
  try {
    if (!S.token || !S.settings.lockCard) { lockSig = ''; await LocalNotifications.cancel({ notifications: [{ id: 30 }] }); return; }
    const t = today(), goal = S.settings.goalMin || 180;
    const title = fmtMin(t.min) + ' on the move today';
    const body = fmtDist(t.m) + ' · ' + fmtNum(t.steps) + ' steps · ' + Math.min(999, Math.round(t.min / goal * 100)) + '% of your goal';
    if (!force && title + body === lockSig) return;
    if ((await LocalNotifications.requestPermissions()).display !== 'granted') return;
    if (!lockChannel) { await LocalNotifications.createChannel({ id: 'motio-live', name: 'Today on your lock screen', importance: 2, visibility: 1, vibration: false }); lockChannel = true; }
    lockSig = title + body;
    await LocalNotifications.schedule({ notifications: [{ id: 30, title, body, channelId: 'motio-live', ongoing: true, autoCancel: false, silent: true }] });
  } catch { /* notifications unavailable */ }
}
// ---------------------------------------------------------------- connected apps
// Health Connect (on the phone): walks, runs and rides go in as workouts with their steps and distance.
let healthT = 0;
async function healthPush(since) {
  const trips = Object.values(S.trips).filter((t) => !t.deleted && t.end > since && ['walk', 'run', 'bike'].includes(t.mode));
  if (!trips.length) { S.healthAt = Date.now(); changed(); return 0; }
  const r = await Health.writeTrips({ trips: trips.map((t) => ({ id: t.id, start: t.start, end: t.end, mode: t.mode, distanceM: t.distanceM || 0, steps: t.steps || 0, updatedAt: t.updatedAt || t.end, title: MODES[t.mode].name + ' · Motio' })) });
  S.healthAt = Date.now(); changed();
  return r.written;
}
export const health = {
  status: () => (native ? Health.getStatus() : Promise.resolve({ available: false })),
  async connect() {
    const r = await Health.connect();
    if (r.connected) { setSetting('healthSync', true); await healthPush(S.settings.importPast === false ? Date.now() - DAY : Date.now() - 30 * DAY); refreshHealthSteps(true); }
    return r;
  },
  disconnect() { setSetting('healthSync', false); S.hcSteps = {}; changed(); return Health.openSettings().catch(() => {}); },
  syncedAt: () => S.healthAt || null
};
// Reads the last 8 days' step totals from Health Connect (Samsung Health, watches, other apps), when allowed.
let hcAt = 0;
async function refreshHealthSteps(force) {
  if (!native || !S.settings.healthSync || (!force && Date.now() - hcAt < 4 * MIN)) return;
  hcAt = Date.now();
  try {
    const st = await Health.getStatus();
    if (!st.readSteps) return;
    const out = {};
    for (let i = 0, d = dayStart(); i < 8; i++, d = dayStart(d - 2 * HOUR)) {
      const r = await Health.readSteps({ from: d, to: Math.min(dayStart(d + DAY + 2 * HOUR), Date.now()) });
      out[new Date(d).toDateString()] = r.steps || 0;
    }
    S.hcSteps = out; changed();
  } catch { /* Health Connect busy or not allowed: keep the last numbers */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshHealthSteps(); });
setInterval(() => { if (!document.hidden) refreshHealthSteps(); }, 5 * MIN);
setTimeout(() => refreshHealthSteps(true), 3000);
// Fitness apps on this phone. Most of them read Motio's trips through Health Connect once it's connected.
export const PARTNERS = [
  ['com.sec.android.app.shealth', 'Samsung Health', '#1D8BE0'], ['com.google.android.apps.fitness', 'Google Fit', '#4285F4'], ['com.fitbit.FitbitMobile', 'Fitbit', '#00B0B9'],
  ['com.mi.health', 'Mi Fitness', '#FF6900'], ['com.xiaomi.wearable', 'Mi Fitness', '#FF6900'], ['com.huami.watch.hmwatchmanager', 'Zepp', '#1F1D47'],
  ['com.garmin.android.apps.connectmobile', 'Garmin Connect', '#007CC3']
];
export const apps = {
  installed: () => (native ? Sensors.installedApps({ packages: [...PARTNERS.map((p) => p[0]), 'com.strava'] }) : Promise.resolve({ 'com.sec.android.app.shealth': true, 'com.strava': true })),
  open: (pkg) => (native ? Sensors.openApp({ package: pkg }) : Promise.resolve({ ok: true }))
};
// Phone settings that keep background tracking alive (Xiaomi/Redmi stop apps unless Autostart and battery are allowed).
export const phoneSetup = {
  status: () => (native ? Sensors.setupStatus() : Promise.resolve({ battery: true, xiaomi: false })),
  open: (what) => (native ? Sensors.openSetup({ what }) : Promise.resolve())
};
// Friends: add each other by invite code and compare weekly totals (the server shares nothing else).
export const friends = {
  board: () => api('GET', '/v1/friends?from=' + weekStart()),
  add: (code) => api('POST', '/v1/friends/add', { code }),
  remove: (id) => api('POST', '/v1/friends/remove', { id }),
  respond: (id, accept) => api('POST', '/v1/friends/respond', { id, accept }),
  cancel: (id) => api('POST', '/v1/friends/cancel', { id }),
  profile: (id) => api('GET', '/v1/profile?id=' + id + '&from=' + weekStart()),
  search: (q) => api('GET', '/v1/people?q=' + encodeURIComponent(q)),
  addPerson: (id) => api('POST', '/v1/friends/add', { id }),
  respondChallenge: (id, accept) => api('POST', '/v1/challenges/respond', { id, accept }),
  cheer: (id) => api('POST', '/v1/friends/cheer', { id }),
  moments: () => api('GET', '/v1/moments'),
  challenges: () => api('GET', '/v1/challenges'),
  challenge: (kind, target, days, friendIds) => api('POST', '/v1/challenges', { kind, target, days, friendIds }),
  leave: (id) => api('POST', '/v1/challenges/leave', { id }),
  // All users with public profiles, ranked for this week by active time, distance or steps.
  leaderboard: (metric) => api('GET', '/v1/leaderboard?metric=' + metric + '&from=' + weekStart() + '&day=' + isoDay(weekStart())),
  // Sharing with friends by permission (routes, places, live location); everything is off until you turn it on.
  sharing: () => api('GET', '/v1/sharing').then((r) => { liveShare = r.mine.some((p) => p.kinds.live); return r; }),
  share: (friendId, kind, on, minutes) => api('POST', '/v1/sharing', { friendId, kind, on, minutes }).then((r) => { if (kind === 'live') friends.sharing().catch(() => {}); return r; }),
  routes: (id, from, to) => api('GET', '/v1/friend/routes?id=' + id + (from ? '&from=' + from : '') + (to ? '&to=' + to : '')),
  places: (id) => api('GET', '/v1/friend/places?id=' + id),
  live: (id) => api('GET', '/v1/friend/live?id=' + id),
  async invite(code) {
    const text = `Add me on Motio and let's compare our weeks: ${API}/i/${code} (or enter my code ${code} in Social › Friends)`;
    if (native) { await Share.share({ title: 'Motio invite', text, dialogTitle: 'Invite a friend' }); return 'shared'; }
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
    await navigator.clipboard.writeText(text); return 'copied';
  }
};
// Strava (through the server): connect with Strava's login page, then new walks, runs and rides upload automatically.
export const strava = {
  status: () => api('GET', '/v1/strava'),
  async connect() { const { url } = await api('POST', '/v1/strava/start'); await Browser.open({ url }); },
  async upload() { const r = await api('POST', '/v1/strava/upload', {}); S.stravaAt = Date.now(); changed(); return r; },
  disconnect: () => api('DELETE', '/v1/strava'),
  syncedAt: () => S.stravaAt || null
};
// Privacy policy and terms live on the server, so they can change without an app update.
export const openPage = (path) => (native ? Browser.open({ url: API + path }) : Promise.resolve(window.open(API + path, '_blank')));
export const widgetStatus = () => (native ? Sensors.widgetStatus() : Promise.resolve({}));
export const widgetPreview = (kind) => drawWidget(kind, widgetData()).toDataURL('image/png');
export const pinWidget = async (kind) => { if (!native) return { ok: false }; pushWidget(true); return Sensors.pinWidget({ kind }); };
export const sendFeedback = (kind, message) => api('POST', '/v1/feedback', { kind, message });
const cache = new Map();
const memo = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };

// ---------------------------------------------------------------- api
export class ApiError extends Error { constructor(status, body) { super(body.message || 'Request failed'); this.status = status; this.code = body.error; this.body = body; } }
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    // No network at all, or the network is fine and Motio's server can't be reached: say which.
    if (navigator.onLine === false) throw new ApiError(0, { error: 'offline', message: 'You’re offline. Check your connection.' });
    throw new ApiError(0, { error: 'server', message: 'Can’t reach Motio’s server right now. Try again in a moment.' });
  }
  const text = await res.text();
  let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    if (res.status === 401 && S.token && path !== '/v1/auth/logout') { S.token = null; S.sessionExpired = true; changed(); }
    throw new ApiError(res.status, data.error ? data : { error: res.status >= 500 ? 'server' : 'error', message: res.status >= 500 ? 'We couldn’t reach Motio.' : 'Request failed' });
  }
  return data;
}

// Crash reports go to Motio's own server (no third party): message, stack, version and open screen only, at most
// 5 per launch, each kind once. Network errors (ApiError) are expected and not reported.
const crashSeen = new Set();
function reportCrash(err) {
  if (!err || err instanceof ApiError || crashSeen.size >= 5) return;
  const message = String(err.message || err).slice(0, 300);
  if (!message || crashSeen.has(message) || /ResizeObserver|Script error/.test(message)) return;
  crashSeen.add(message);
  const screen = [...document.querySelectorAll('[data-page=overlay] [data-dc-root], [data-page=overlay]')].length ? 'overlay' : 'tabs';
  fetch(API + '/v1/crash', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
    body: JSON.stringify({ message, stack: String(err.stack || '').slice(0, 2000), version: window.__MOTIO_VERSION || '', screen }) }).catch(() => {});
}
window.addEventListener('error', (e) => reportCrash(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportCrash(e.reason));

// Trips are per account: a different account signing in starts from its own server copy, and trips that
// hadn't uploaded when someone logged out wait (stashed) for that same account to come back.
function forAccount(user) {
  const prev = S.user && S.user.id;
  if (prev && prev !== user.id) {
    stash(prev);
    S.trips = {}; S.dirty = {}; S.lastSync = 0; live = null; S.live = null; S.anchor = null;
  }
  const back = (S.stash || {})[user.id];
  if (back) { for (const t of back) { S.trips[t.id] = t; S.dirty[t.id] = 1; } delete S.stash[user.id]; }
}
function stash(uid) {
  const left = Object.keys(S.dirty).map((id) => S.trips[id]).filter(Boolean);
  if (uid && left.length) S.stash = { ...(S.stash || {}), [uid]: left };
}
const signedIn = (d) => { forAccount(d.user); S.token = d.token; S.user = d.user; S.sessionExpired = false; if (d.user.settings) S.settings = { ...S.settings, ...d.user.settings }; changed(); sync(); if (S.settings.autoTrack) setTimeout(startTracking, 800); return d.user; };

// Asks Android for a Google account and returns its ID token; a closed sheet throws { code: 'cancelled' }.
async function signedInWithGoogle() {
  const clientId = native ? (await api('GET', '/v1/auth/google')).clientId : null;
  if (!clientId) throw Object.assign(new Error('Google sign-in isn’t available yet.'), { code: 'google_off' });
  try { return (await Sensors.googleSignIn({ clientId })).idToken; }
  catch (e) { throw Object.assign(new Error(e.code === 'cancelled' ? 'Cancelled' : 'Google sign-in failed. Try again.'), { code: e.code === 'cancelled' ? 'cancelled' : 'google_failed' }); }
}
export const auth = {
  register: (name, email, password) => api('POST', '/v1/auth/register', { name, email, password }),
  verify: async (email, code) => signedIn(await api('POST', '/v1/auth/verify', { email, code })),
  resend: (email, purpose = 'verify') => api('POST', '/v1/auth/resend', { email, purpose }),
  login: async (email, password) => signedIn(await api('POST', '/v1/auth/login', { email, password })),
  // Google: null when the server hasn't been given a Google client ID (the button stays hidden).
  googleReady: () => (native ? api('GET', '/v1/auth/google').then((r) => r.clientId || null).catch(() => null) : Promise.resolve(null)),
  async google() {
    const r = await signedInWithGoogle();
    return signedIn(await api('POST', '/v1/auth/google', { idToken: r }));
  },
  forgot: (email) => api('POST', '/v1/auth/forgot', { email }),
  reset: async (email, code, password) => signedIn(await api('POST', '/v1/auth/reset', { email, code, password })),
  logout: async () => {
    stopTracking(); await sync();
    try { await api('POST', '/v1/auth/logout', {}); } catch { /* still log out locally */ }
    stash(S.user && S.user.id); // offline: the unsynced trips upload when this account logs in again
    S = { ...blank(), settings: S.settings, stash: S.stash, tripsInDb: S.tripsInDb }; changed(); pushLockCard();
  },
  // Removes the account and every trip on the server, then clears this phone.
  changePassword: (current, next) => api('POST', '/v1/me/password', { current, next }),
  async deleteAccount(password, withGoogle) {
    await api('POST', '/v1/me/delete', withGoogle ? { idToken: await signedInWithGoogle() } : { password });
    stopTracking(); S = { ...blank(), settings: S.settings, tripsInDb: S.tripsInDb }; changed(); pushLockCard();
  },
  isSignedIn: () => !!S.token,
  sessionExpired: () => !!S.sessionExpired,
  user: () => S.user
};

export async function updateProfile(patch) {
  S.user = { ...S.user, ...patch };
  changed();
  try { const d = await api('PATCH', '/v1/me', patch); S.user = d.user; changed(); } catch (e) { if (e.code !== 'offline') throw e; }
}
export function setSetting(k, v) {
  S.settings = { ...S.settings, [k]: v };
  changed();
  if (S.token) api('PATCH', '/v1/me', { settings: { [k]: v } }).catch(() => {});
  if (k === 'autoTrack') (v ? startTracking() : stopTracking());
  if (k === 'gpsSaver' && native) Sensors.setTrackingMode({ saver: !!v }).catch(() => {});
  if (k === 'countSteps' && S.tracking) { stopTracking(); startTracking(); }
  if (k === 'dailyAlert') scheduleAlert();
  if (k === 'lockCard') pushLockCard(true);
  if (k === 'keep') prune();
}
// Evening nudge at 9 PM with the day's numbers; rescheduled whenever the app opens so the text stays fresh.
export async function scheduleAlert() {
  if (!native) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 21 }] });
    if (!S.token || S.settings.dailyAlert === false) return;
    if ((await LocalNotifications.requestPermissions()).display !== 'granted') return;
    await LocalNotifications.schedule({ notifications: [{ id: 21, title: 'Your day in moves is ready', body: 'Open Motio to see where today took you.', schedule: { on: { hour: 21, minute: 0 }, allowWhileIdle: true } }] });
  } catch { /* notifications unavailable */ }
}
export const settings = () => S.settings;

// ---------------------------------------------------------------- sync
let syncing = false;
export async function sync() {
  if (!S.token || syncing) return;
  syncing = true;
  try {
    await ready; // never sync (or decide what's missing) before the stored trips have loaded
    if (S.deleteAll) { await api('DELETE', '/v1/trips?confirm=delete-all'); S.deleteAll = false; S.lastSync = 0; }
    // Signed in but nothing on this phone (new phone, cleared storage): fetch the whole history again.
    if (!Object.keys(S.trips).length) S.lastSync = 0;
    const sent = Object.keys(S.dirty).map((id) => S.trips[id]).filter(Boolean).slice(0, 500);
    const out = await api('POST', '/v1/trips/sync', { trips: sent, since: S.lastSync });
    // A trip changed again while this request was out stays dirty for the next sync.
    for (const t of sent) if ((S.trips[t.id] || {}).updatedAt === t.updatedAt) delete S.dirty[t.id];
    // Our own upload comes back with the same updatedAt: keep the local copy then. A newer server copy wins,
    // on top of the local one so nothing the server doesn't know about is lost.
    for (const t of out.trips) { const mine = S.trips[t.id]; if (!mine || (mine.updatedAt || 0) < t.updatedAt) S.trips[t.id] = mine ? { ...mine, ...t } : t; }
    // Deleted trips are kept only until the server has them.
    for (const t of Object.values(S.trips)) if (t.deleted && !S.dirty[t.id]) delete S.trips[t.id];
    S.lastSync = out.serverTime;
    if (sent.length && S.settings.stravaAuto) strava.upload().catch(() => {});
    pushSteps();
    S.syncError = null;
    changed();
  } catch (e) { S.syncError = e.code || 'error'; changed(false); } finally { syncing = false; }
}
// Auto-refresh: every minute while the app is open, and whenever it comes back to the front, trips sync
// (picking up changes from other phones) and every open screen reloads its server data ('motio:refresh').
const refreshAll = () => { if (document.hidden) return; sync(); if (S.token) friends.sharing().catch(() => {}); window.dispatchEvent(new Event('motio:refresh')); };
setTimeout(() => { if (S.token) friends.sharing().catch(() => {}); }, 4000);
setInterval(refreshAll, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });
window.addEventListener('online', () => sync());

// Daily step totals (the numbers Today shows) go to the server every 15 minutes, for the all-users steps board.
let stepsAt = 0;
const isoDay = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function pushSteps() {
  if (S.demo || Date.now() - stepsAt < 15 * MIN) return;
  stepsAt = Date.now();
  const days = [];
  for (let i = 0, d = dayStart(Date.now()); i < 8; i++, d = dayStart(d - 2 * HOUR)) days.push({ day: isoDay(d), steps: summarize(d, dayStart(d + DAY + 2 * HOUR)).steps });
  api('POST', '/v1/me/steps', { days }).catch(() => { stepsAt = 0; });
}
// Live location: only while you share it with someone, at most every 30 s, and never from inside private zones
// (the server drops those too). liveShare is refreshed by friends.sharing().
let liveShare = false, liveAt = 0;
function pushLive(p, mode) {
  if (!liveShare || !S.token || p[2] - liveAt < 30000) return;
  liveAt = p[2];
  api('POST', '/v1/live', { lat: p[0], lng: p[1], at: p[2], mode }).then((r) => { if (r && r.sharing === false) liveShare = false; }).catch(() => {});
}
export function saveTrip(t) {
  S.trips[t.id] = { ...t, updatedAt: Date.now() }; S.dirty[t.id] = 1; changed();
  if (native && S.settings.healthSync) { clearTimeout(healthT); healthT = setTimeout(() => healthPush(Date.now() - 2 * DAY).catch(() => {}), 5000); }
}
export function deleteTrip(id) { const t = S.trips[id]; if (t) saveTrip({ ...t, deleted: true, points: [] }); sync(); }
// "Keep my history for": 0 = 3 months, 1 = 1 year, 2 = forever. Deleted trips sync, so the server forgets them too.
const KEEP_DAYS = [92, 366, Infinity];
// Trips under 100 m are noise (workouts saved before the 100 m rule, "1 min run, 0 m"); normal trips already need 150 m.
function dropEmptyWorkouts() {
  if (S.emptyDropped) return;
  S.emptyDropped = true; // a one-time clean-up of old builds' empty workouts, not something to redo each launch
  let n = 0;
  for (const t of Object.values(S.trips)) if (!t.deleted && (t.distanceM || 0) < 100) { S.trips[t.id] = { ...t, deleted: true, points: [], updatedAt: Date.now() }; S.dirty[t.id] = 1; n++; }
  if (n) { changed(); setTimeout(() => sync(), 3000); }
}
ready.then(dropEmptyWorkouts);
export function prune() {
  const cut = Date.now() - KEEP_DAYS[S.settings.keep ?? 1] * DAY;
  let n = 0;
  for (const t of Object.values(S.trips)) if (!t.deleted && t.end < cut) { S.trips[t.id] = { ...t, deleted: true, points: [], updatedAt: Date.now() }; S.dirty[t.id] = 1; n++; }
  if (n) { changed(); sync(); }
  return n;
}
// Private zones hide route points near places like home; they are stored with your settings.
export async function addZoneHere(name) {
  let c;
  if (native) c = (await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })).coords;
  else c = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition((p) => ok(p.coords), no, { timeout: 15000 }));
  const zones = [...(S.settings.zones || []), { id: Date.now(), name, lat: +c.latitude.toFixed(5), lng: +c.longitude.toFixed(5), r: 200 }];
  setSetting('zones', zones);
  return zones;
}
export const addZoneAt = (lat, lng, name) => setSetting('zones', [...(S.settings.zones || []), { id: Date.now(), name, lat: +lat.toFixed(5), lng: +lng.toFixed(5), r: 200 }]);
export const removeZone = (id) => setSetting('zones', (S.settings.zones || []).filter((z) => z.id !== id));
function metres(a0, a1, b0, b1) { const k = Math.PI / 180, x = (b1 - a1) * k * Math.cos(((a0 + b0) / 2) * k), y = (b0 - a0) * k; return Math.sqrt(x * x + y * y) * 6371000; }
const outsideZones = (pts) => { const z = S.settings.zones || []; return z.length ? pts.filter((p) => z.every((q) => metres(p[0], p[1], q.lat, q.lng) > q.r)) : pts; };
export function retypeTrip(id, mode) {
  if (live && live.id === id) { live.mode = mode; live.locked = true; changed(); return; }
  const t = S.trips[id];
  if (!t) return;
  saveTrip({ ...t, mode, locked: true });
  learn(t.f || vector(features(t)), mode);
}
// Corrections teach the classifier; kept with your settings so they follow you to a new phone.
function learn(v, mode) {
  const list = [...(S.settings.learned || []), { v, m: mode }].slice(-200);
  setSetting('learned', list);
}
export async function deleteHistory() {
  live = null; S.live = null; S.anchor = null;
  S.trips = {}; S.dirty = {}; S.lastSync = 0; S.deleteAll = true; changed();
  await sync(); // if offline, the delete waits in deleteAll and runs on the next sync
}
export async function exportData(format, from = 0, to = Date.now(), parts = {}) {
  await sync(); // include trips that haven't uploaded yet
  const q = Object.entries(parts).filter(([, on]) => !on).map(([k]) => `&${k}=0`).join('');
  let res;
  try { res = await fetch(`${API}/v1/export?format=${format}&from=${from}&to=${to}${q}`, { headers: { Authorization: 'Bearer ' + S.token } }); }
  catch { throw new ApiError(0, { error: 'offline', message: 'You’re offline. Check your connection.' }); }
  if (!res.ok) throw new ApiError(res.status, { error: 'export', message: 'Export failed' });
  return res.text();
}
// Phone: write to the cache folder and open the share sheet. Browser: a normal download.
export async function saveFile(name, text, mime) {
  if (native) {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [uri], dialogTitle: 'Save or send your Motio export' });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------------------------------------------------------------- tracking
// A trip starts when you move and ends after 4 still minutes. Each trip holds one way of moving;
// a change of pace that lasts 2+ minutes starts a new trip of the new type.
const STILL_END = 4 * MIN;
let trackingOn = false, live = S.live || null;

const hav = (a, b) => {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
// Broad kind of movement: on foot, cycling or in a vehicle. A trip splits only when this changes.
const KIND = { walk: 'foot', run: 'foot', bike: 'bike', drive: 'vehicle', transit: 'vehicle', vehicle: 'vehicle' };
const typeOf = (t) => (t.locked ? t.mode : classifyTrip(features(t), S.settings.learned || []));

// Google Activity Recognition (on-device ML): the latest guess, and time per activity during the live trip.
let ar = null, arSub = null, locSub = null;
function onActivity(e) {
  // Readings recorded while Motio was closed are replayed later with their own time.
  const now = e.at && e.at <= Date.now() + 5000 ? e.at : Date.now();
  // Every reading counts, "still" too: a trip that was mostly still isn't a drive because of one vehicle guess.
  if (live && ar) {
    live.ar = live.ar || {};
    live.ar[ar.type] = (live.ar[ar.type] || 0) + Math.min(now - ar.at, 2 * MIN) * ar.conf / 100;
  }
  ar = { type: e.type, conf: e.confidence, at: now };
  if (e.confidence >= 70 && KIND[e.type]) consider(e.type, now);
  if (live && !live.workout && e.type === 'still' && e.confidence >= 80 && now - live.lastMove > 2 * MIN) closeLive(live.lastMove);
  changed(false);
}

// A different kind of moving (on foot / bike / vehicle) for 90 s ends this trip and starts the next one,
// which takes over the readings from the moment the change began (walk → bus splits at the bus stop).
function consider(type, now) {
  if (!live || live.locked) return;
  const kind = KIND[type];
  if (kind === KIND[live.mode]) { live.candidate = null; return; }
  live.candidate = live.candidate && live.candidate.kind === kind ? live.candidate : { kind, since: now };
  if (now - live.candidate.since < 90000) return;
  const since = live.candidate.since, old = live;
  const cut = Math.max(1, old.points.findIndex((q) => q[2] >= since));
  const moved = old.points.slice(cut - 1);
  old.points = old.points.slice(0, cut);
  old.distanceM = Math.max(0, old.distanceM - pathLen(moved));
  old.end = old.points[old.points.length - 1][2]; // ends at its last movement, not while waiting at the stop
  old.lastMove = Math.min(old.lastMove, since);
  closeLive(since);
  moved[0] = [moved[0][0], moved[0][1], Math.max(moved[0][2], since - 30000), moved[0][3]];
  startLive(type === 'vehicle' ? 'drive' : type, moved[0]);
  live.points = moved; live.distanceM = pathLen(moved); live.end = moved[moved.length - 1][2]; live.lastMove = now;
}
const pathLen = (pts) => pts.reduce((a, q, i) => a + (i ? hav(pts[i - 1], q) : 0), 0);

// A "trip" that never got far from where it began and zig-zagged, or that Google saw as mostly still: position noise.
function wandered(t) {
  const pts = t.points || [];
  if (pts.length < 2) return true;
  const far = Math.max(...pts.map((q) => hav(pts[0], q)));
  const a = t.ar || {}, all = Object.values(a).reduce((x, y) => x + y, 0), stillShare = all ? (a.still || 0) / all : 0;
  return far < 300 && (stillShare >= 0.5 || t.distanceM > 3 * far);
}
function closeLive(endAt) {
  if (!live) return;
  const t = live; live = null; S.live = null;
  t.end = Math.min(endAt, t.end);
  if (t.workout ? t.end - t.start - t.workout.pausedMs < 60000 || t.distanceM < 100 : t.distanceM < 150 || (t.distanceM < 400 && t.end - t.start < 90000) || (!t.locked && wandered(t))) { changed(); return; } // GPS jitter or fidgeting, not a trip
  const f = features(t);
  const done = { id: t.id, start: t.start, end: t.end, mode: t.locked ? t.mode : classifyTrip(f, S.settings.learned || []), locked: !!t.locked,
    distanceM: Math.round(t.distanceM), steps: t.steps, maxSpeed: t.maxSpeed, points: t.points, f: vector(f), ...(t.workout ? { workout: true, pausedMs: t.workout.pausedMs } : {}) };
  saveTrip(done);
  if (S.settings.webhook) sendWebhook(done).catch(() => {});
}

function onLocation(loc) {
  if (!loc) return;
  const p = [+loc.latitude.toFixed(6), +loc.longitude.toFixed(6), loc.time || Date.now(), Math.round(loc.accuracy || 0)];
  if ((loc.accuracy || 0) > 80) return;
  S.lastFix = p;
  const now = p[2];
  pushLive(p, live ? live.mode : null);
  if (live && live.workout) { workoutFix(p, loc); return; }
  // Standing still sends no GPS updates at all, so a long gap means the trip ended back then.
  if (live && now - live.lastMove > STILL_END) { S.anchor = live.points[live.points.length - 1]; closeLive(live.lastMove); }
  // Indoors the phone's position wanders 50–300 m while you sit still; only fixes this sharp can show real movement.
  const sharp = p[3] <= 25;
  const saysStill = ar && ar.type === 'still' && ar.conf >= 60; // Google's last word (it stays quiet while you stay still)
  if (live) {
    const prev = live.points[live.points.length - 1];
    const d = hav(prev, p), dt = Math.max(1, (now - prev[2]) / 1000);
    // The GPS chip's own (Doppler) speed is steady; speed from two wandering positions is not.
    const doppler = loc.speed != null && loc.speed >= 0 && p[3] <= 35 ? loc.speed : null;
    const speed = doppler != null ? doppler : d / dt;
    // Jumps faster than 250 km/h are GPS errors; vague fixes say nothing about movement.
    if (d / dt > 70) return;
    if (p[3] > 40) { changed(false); return; }
    if ((d < Math.max(8, p[3] * 0.8) && speed < 0.6) || (saysStill && speed < 0.8 && d < Math.max(30, 2 * p[3]))) {
      // Standing: remember since when, so a stop (bus stop, red light) can be counted when moving resumes.
      if (!live.stillSince) live.stillSince = now;
      changed(false); return;
    }
    // A pause of 8–150 s between moving stretches is a stop; also counted when GPS went quiet for that long.
    const paused = (now - (live.stillSince || prev[2])) / 1000;
    if (paused >= 8 && paused <= 150 && (live.stillSince || d / dt < 3)) live.stops = (live.stops || 0) + 1;
    live.stillSince = 0;
    live.lastMove = now;
    // Without a recent reading from the activity model, sustained speed decides: three sharp fixes over 25 km/h
    // in a row mean a vehicle, under 8 km/h means on foot. One jumpy fix never does.
    live.fast = sharp && speed > 7 ? (live.fast || 0) + 1 : speed < 2.2 ? 0 : live.fast || 0;
    if (!(ar && now - ar.at < 60000) && sharp) { if (live.fast >= 3) consider('vehicle', now); else if (speed < 2.2) consider('walk', now); }
    live.points.push(p); live.distanceM += d; live.end = now;
    if (sharp) live.maxSpeed = Math.max(live.maxSpeed, Math.min(speed, 70));
    if (live.points.length > 6000) live.points.splice(1, 1);
    // The type shown while moving is re-judged from the whole trip so far, at most every 20 s.
    if (!live.locked && now - (live.judged || 0) > 20000) { live.judged = now; live.mode = typeOf(live); }
  } else {
    // A trip starts only after leaving the resting spot by more than the GPS error, or at a trusted speed.
    // The resting spot stays put while you walk away from it; it only moves once you've settled somewhere new.
    if (S.anchor && (now - S.anchor[2] > STILL_END || now < S.anchor[2])) S.anchor = p; // stale, or the clock jumped back
    const moved = S.anchor ? hav(S.anchor, p) : 0;
    const arMoving = ar && now - ar.at < 60000 && ar.type !== 'still' && ar.conf >= 60;
    // Start when Google says you're moving, or sharp fixes show a real departure; when Google says still, only a big move counts.
    const departed = sharp && (saysStill ? moved > 250 : moved > Math.max(80, 3 * p[3]) || ((loc.speed || 0) > 1.5 && p[3] < 20));
    if (S.anchor && ((arMoving && moved > Math.max(30, p[3])) || departed)) {
      const guess = arMoving ? (ar.type === 'vehicle' ? 'drive' : ar.type) : (loc.speed || 0) > 8 ? 'drive' : 'walk';
      startLive(guess, [S.anchor[0], S.anchor[1], Math.max(S.anchor[2], now - 60000), S.anchor[3]]); live.points.push(p); live.end = now; live.distanceM = moved; live.lastMove = now;
      S.anchor = null;
    } else if (!S.anchor && sharp) S.anchor = p;
  }
  changed(false);
}
function startLive(mode, first, at = first[2]) {
  live = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: at, end: at, mode, distanceM: 0, steps: 0, maxSpeed: 0, points: first ? [first] : [], lastMove: at, ar: {} };
  S.live = live;
}
// A workout: you pick the type and press start; it records until you finish, with pauses, and never splits or ends on its own.
function workoutFix(p, loc) {
  const w = live.workout, prev = live.points[live.points.length - 1], now = p[2];
  if (w.pausedAt) return changed(false);
  if (prev) {
    const d = hav(prev, p), dt = Math.max(1, (now - prev[2]) / 1000);
    if (d / dt > 70) return;
    if (d < Math.max(5, p[3] * 0.6)) return changed(false); // GPS jitter while standing
    const speed = loc.speed != null && loc.speed >= 0 ? loc.speed : d / dt;
    if (!w.skip) { live.distanceM += d; live.maxSpeed = Math.max(live.maxSpeed, Math.min(speed, 70)); }
  }
  w.skip = false; // the stretch covered while paused doesn't count
  live.points.push(p); live.end = now; live.lastMove = now;
  if (live.points.length > 6000) live.points.splice(1, 1);
  changed(false);
}
export async function startWorkout(mode) {
  const wasOff = native && !trackingOn;
  if (wasOff && !(await startTracking()).ok) return { ok: false };
  if (live) closeLive(Date.now());
  const now = Date.now(), f = S.lastFix && now - S.lastFix[2] < 2 * MIN ? [S.lastFix[0], S.lastFix[1], now, S.lastFix[3]] : null;
  startLive(mode, f, now);
  live.locked = true; live.workout = { pausedMs: 0, pausedAt: 0, wasOff };
  changed();
  return { ok: true };
}
export function pauseWorkout(on) {
  const w = live && live.workout;
  if (!w) return;
  const now = Date.now();
  if (on && !w.pausedAt) w.pausedAt = now;
  if (!on && w.pausedAt) { w.pausedMs += now - w.pausedAt; w.pausedAt = 0; w.skip = true; }
  changed();
}
// Saves the workout and returns its id, or null when it was too short to keep.
export function finishWorkout() {
  const w = live && live.workout;
  if (!w) return null;
  pauseWorkout(false);
  const id = live.id;
  live.end = live.lastMove = Date.now();
  closeLive(live.end);
  if (w.wasOff) stopTracking();
  return S.trips[id] ? id : null;
}
export const workout = () => {
  if (!live || !live.workout) return null;
  const w = live.workout, now = Date.now();
  return { ...liveTrip(), paused: !!w.pausedAt, activeMs: now - live.start - w.pausedMs - (w.pausedAt ? now - w.pausedAt : 0) };
};
// Ends a trip that went quiet even if no more GPS updates come, and keeps the live trip saved across restarts.
// Saved every few seconds (cheap now that trips aren't in localStorage), so a killed app loses almost nothing.
setInterval(() => {
  if (live && !live.workout && trackingReplayed() && Date.now() - live.lastMove > STILL_END) closeLive(live.lastMove);
  if (live) { S.live = live; flush(); }
}, 5000);
// With native tracking, what happened while Motio was closed is replayed first (startTracking); only after
// that can we tell whether the restored trip really ended.
const trackingReplayed = () => trackingOn || !native || !(S.token && S.settings.autoTrack);
if (live && !live.workout && trackingReplayed() && Date.now() - live.lastMove > STILL_END) setTimeout(() => closeLive(live.lastMove), 0);
if (live && live.workout && native) setTimeout(() => startTracking(), 0); // keep recording a workout after the app restarts
function onSteps(total) {
  if (total == null) return;
  const now = Date.now(), day = new Date().toDateString(), last = S.stepTotal;
  // The phone counts steps since it was switched on, also while Motio is closed. The last total is saved,
  // so those steps count too; a smaller number means the phone restarted and counting began again at zero.
  const delta = last == null ? 0 : total >= last ? total - last : total;
  const byDay = (S.stepsByDay = S.stepsByDay || {});
  byDay[day] = (byDay[day] || 0) + delta;
  for (const k of Object.keys(byDay)) if (Date.now() - new Date(k).getTime() > 62 * DAY) delete byDay[k];
  // Only steps taken just now belong to the trip in progress, not a backlog from hours closed.
  if (live && !(live.workout && live.workout.pausedAt) && S.stepAt && now - S.stepAt < 2 * MIN) live.steps += delta;
  S.stepTotal = total; S.stepAt = now;
  changed(false);
}

let stepSub = null;
// Tracking runs in a native service (TrackService) that keeps recording with Motio closed and restarts
// after a reboot. Starting it replays what it recorded meanwhile, oldest first, then events arrive live.
export async function startTracking() {
  if (!native || trackingOn) return { ok: trackingOn };
  try {
    // Ask only when not yet allowed: requesting an already granted permission can hang on some phones.
    let perm = await Geolocation.checkPermissions().catch(() => null);
    if (!perm || perm.location !== 'granted') perm = await Geolocation.requestPermissions({ permissions: ['location'] }).catch(() => null);
    if (!perm || perm.location !== 'granted') { S.trackError = 'denied'; changed(false); return { ok: false }; }
    if (S.settings.countSteps !== false) {
      try { await Sensors.requestStepPermission(); } catch { /* no step sensor */ }
      stepSub = await Sensors.addListener('steps', (e) => onSteps(e.steps)).catch(() => null);
      const st = await Sensors.getSteps().catch(() => ({}));
      onSteps(st.steps);
    }
    arSub = await Sensors.addListener('activity', onActivity).catch(() => null);
    locSub = await Sensors.addListener('location', onLocation).catch(() => null);
    const { backlog } = await Sensors.startTracking();
    const items = (backlog || []).filter((x) => x && (x.at || x.time)).sort((x, y) => (x.at || x.time) - (y.at || y.time));
    for (const x of items) { if (x.k === 'a') onActivity(x); else onLocation(x); }
    trackingOn = true; S.tracking = true; S.trackError = null;
    if (live && !live.workout && Date.now() - live.lastMove > STILL_END) closeLive(live.lastMove);
    changed();
    // "Allow all the time" lets tracking restart by itself after a reboot; ask once, Settings offers it again.
    if (!S.askedBackground) { S.askedBackground = true; setTimeout(() => Sensors.requestBackgroundLocation().catch(() => {}), 1500); }
    return { ok: true };
  } catch (e) { S.trackError = e && e.code === 'denied' ? 'denied' : 'error'; changed(false); return { ok: false }; }
}
export function stopTracking() {
  closeLive(Date.now());
  if (native) Sensors.stopTracking().catch(() => {});
  trackingOn = false;
  if (locSub) { locSub.remove(); locSub = null; }
  if (stepSub) { stepSub.remove(); stepSub = null; }
  if (arSub) { arSub.remove(); arSub = null; }
  S.tracking = false; changed();
}
export const tracking = () => ({ on: trackingOn, live: !!live, error: S.trackError || null, mode: live ? live.mode : null });
export const requestBackgroundLocation = () => (native ? Sensors.requestBackgroundLocation() : Promise.resolve());
export const openLocationSettings = () => (native ? Sensors.openSetup({ what: 'app' }) : Promise.resolve());

// ---------------------------------------------------------------- share cards
// Draws a 1080×1920 story card and shares, saves or copies it. Returns the message to show.
function drawCard({ kicker, big, line, bg = '#4B3FD8', fg = '#FFFFFF' }) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
  g.globalAlpha = 0.12; g.fillStyle = fg; g.beginPath(); g.arc(940, 260, 360, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.lineWidth = 90; g.strokeStyle = fg; g.moveTo(-60, 1650); g.bezierCurveTo(300, 1420, 700, 1880, 1140, 1560); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = fg; g.textBaseline = 'alphabetic';
  g.font = '700 64px Poppins, sans-serif'; g.fillText('motio', 96, 200);
  g.font = '600 46px Poppins, sans-serif'; g.globalAlpha = 0.8; g.fillText(String(kicker).toUpperCase(), 96, 760); g.globalAlpha = 1;
  let size = 260; g.font = `700 ${size}px Poppins, sans-serif`;
  while (g.measureText(big).width > 900 && size > 90) { size -= 10; g.font = `700 ${size}px Poppins, sans-serif`; }
  g.fillText(big, 90, 760 + size);
  g.font = '500 52px Poppins, sans-serif';
  const words = String(line).split(' '); let row = '', y = 900 + size;
  for (const w of words) { if (g.measureText(row + w).width > 880) { g.fillText(row, 96, y); row = ''; y += 70; } row += w + ' '; }
  g.fillText(row, 96, y);
  g.font = '600 40px Poppins, sans-serif'; g.globalAlpha = 0.85; g.fillText('Tracked with Motio', 96, 1800);
  return c;
}
// The image a share sends is a picture of what's on screen: the current page, without buttons, sheets or the tab bar,
// fitted into a 1080×1920 story with side bands in the page's own edge colour.
let fontCSS = null;
const NO_SHOT = /share|close|back|menu|previous story|next story|finish|edit profile|settings|open map/i;
export async function captureScreen() {
  const page = (window.__motioPage && window.__motioPage()) || document.getElementById('app');
  const props = [...getComputedStyle(document.body)].filter((p) => !/^(animation|transition)/.test(p));
  const filter = (n) => {
    if (n.nodeType !== 1) return true;
    if (n.tagName === 'NAV' || n.hasAttribute('data-noshot') || n.matches('section[aria-label], [role=status], [role=alertdialog], [role=dialog]')) return false;
    const label = n.getAttribute('aria-label') || (n.tagName === 'BUTTON' ? n.textContent.trim() : '');
    return !((n.tagName === 'BUTTON' || n.tagName === 'A') && NO_SHOT.test(label));
  };
  if (fontCSS == null) fontCSS = await getFontEmbedCSS(page).catch(() => '');
  const w = page.offsetWidth, h = page.offsetHeight;
  const shot = await toCanvas(page, { width: w, height: h, pixelRatio: 1080 / w, filter, includeStyleProperties: props, fontEmbedCSS: fontCSS });
  const out = document.createElement('canvas'); out.width = 1080; out.height = 1920;
  const g = out.getContext('2d');
  const edge = shot.getContext('2d').getImageData(4, Math.round(shot.height / 2), 1, 1).data;
  g.fillStyle = `rgb(${edge[0]},${edge[1]},${edge[2]})`; g.fillRect(0, 0, 1080, 1920);
  const k = Math.min(1080 / shot.width, 1920 / shot.height), dw = shot.width * k, dh = shot.height * k;
  g.drawImage(shot, (1080 - dw) / 2, (1920 - dh) / 2, dw, dh);
  // Quiet credit line at the bottom, light or dark to suit the page.
  const light = (0.299 * edge[0] + 0.587 * edge[1] + 0.114 * edge[2]) / 255 > 0.6;
  g.fillStyle = light ? 'rgba(31,29,71,0.55)' : 'rgba(255,255,255,0.7)';
  g.font = '600 34px Poppins, sans-serif'; g.textAlign = 'center';
  g.fillText('Tracked with Motio', 540, 1868);
  return out.toDataURL('image/png');
}

// Sends an image (data URL) one way: an app directly, the share sheet, Documents, or as text to the clipboard.
export async function shareImage(dataUrl, how = 'share', text = 'Tracked with Motio.') {
  if (how === 'copy') {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    return 'Copied to clipboard';
  }
  const data = dataUrl.split(',')[1];
  const name = `motio-${Date.now()}.png`;
  if (native) {
    if (how === 'save') {
      try { await Filesystem.writeFile({ path: 'Motio/' + name, data, directory: Directory.Documents, recursive: true }); return 'Saved to Documents › Motio'; } catch { /* fall back to the share sheet */ }
    }
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    // Story, WhatsApp, X and Messages open that app directly; if it isn't installed, use the share sheet.
    const APPS = { story: 'Instagram', whatsapp: 'WhatsApp', x: 'X', sms: 'Messages' };
    let note = null;
    if (APPS[how]) {
      const r = await Sensors.shareTo({ target: how, path: name, text }).catch(() => ({ ok: false }));
      if (r.ok) return null;
      note = APPS[how] + ' isn’t installed, so pick another app';
    }
    await Share.share({ title: 'My Motio', text, files: [uri], dialogTitle: how === 'save' ? 'Save your image' : 'Share your image' });
    return note;
  }
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], name, { type: 'image/png' });
  if (how !== 'save' && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return null; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'Image downloaded';
}
// A drawn card as an image: trip shares, and the fallback when a screen picture can't be taken.
export async function cardImage(card) {
  try { await document.fonts.load('700 64px Poppins'); } catch { /* system font is fine */ }
  return drawCard(card).toDataURL('image/png');
}
// A drawn card (trip sheet) shared the same ways.
export async function shareCard(card, how = 'share') {
  const text = `${card.kicker}: ${card.big}. ${card.line}. Tracked with Motio.`;
  if (how === 'copy') return shareImage('', 'copy', text);
  try { await document.fonts.load('700 64px Poppins'); } catch { /* system font is fine */ }
  return shareImage(drawCard(card).toDataURL('image/png'), how, text);
}

// ---------------------------------------------------------------- sample data (Settings › About, tap the version 7 times)
function sampleTrips() {
  const out = [];
  const base = new Date(); base.setHours(0, 0, 0, 0);
  const home = [40.4093, 49.8671], work = [40.3777, 49.8920], park = [40.3953, 49.8822];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const path = (a, b, start, mins, wiggle) => {
    const pts = []; const n = Math.max(6, Math.round(mins));
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push([+(a[0] + (b[0] - a[0]) * k + Math.sin(k * 6) * wiggle).toFixed(6), +(a[1] + (b[1] - a[1]) * k + Math.cos(k * 5) * wiggle).toFixed(6), start + k * mins * MIN, 6]); }
    return pts;
  };
  for (let d = 34; d >= 0; d--) {
    const day = base.getTime() - d * DAY, wd = new Date(day).getDay(), lazy = rnd() < 0.15;
    const add = (h, m, mode, mins, km, a, b, steps = 0, top = 0) => {
      const start = day + h * HOUR + m * MIN;
      if (start > Date.now()) return;
      out.push({ id: `demo-${d}-${h}-${m}`, start, end: start + mins * MIN, mode, distanceM: Math.round(km * 1000), steps, maxSpeed: top / 3.6, points: path(a, b, start, mins, mode === 'walk' ? 0.0012 : 0.002), updatedAt: start });
    };
    const j = (x) => x * (0.8 + rnd() * 0.4);
    if (wd >= 1 && wd <= 5) {
      add(7, 40 + Math.round(rnd() * 10), 'walk', Math.round(j(25)), j(2), home, [40.40, 49.875], Math.round(j(3300)), 6);
      add(8, 6, rnd() < 0.6 ? 'bike' : 'transit', Math.round(j(36)), j(11), [40.40, 49.875], work, 0, 31);
      if (!lazy) add(12, 30, 'walk', Math.round(j(22)), j(1.8), work, park, Math.round(j(2800)), 6);
      add(18, 10, rnd() < 0.5 ? 'drive' : 'transit', Math.round(j(50)), j(30), work, home, 0, 74);
      if (rnd() < 0.45) add(20, 30, 'run', Math.round(j(28)), j(5), home, park, Math.round(j(4400)), 15);
    } else {
      add(10, 15, 'walk', Math.round(j(70)), j(6), home, park, Math.round(j(9000)), 6);
      if (rnd() < 0.7) add(14, 0, 'bike', Math.round(j(55)), j(17), park, [40.36, 49.83], 0, 33);
      add(18, 40, 'drive', Math.round(j(45)), j(36), [40.36, 49.83], home, 0, 96);
    }
  }
  return Object.fromEntries(out.map((t) => [t.id, t]));
}
export function setDemo(on) { S.demo = !!on; changed(); }
export const isDemo = () => !!S.demo;
const allTrips = () => memo('all', () => Object.values(S.demo ? sampleTrips() : S.trips).filter((t) => !t.deleted).concat(live && !S.demo ? [{ ...live, live: true }] : []).sort((a, b) => a.start - b.start));

// ---------------------------------------------------------------- stats
export const fmtMin = (m) => { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + 'm'; };
export const fmtDist = (meters, unit = S.settings.unit) => unit === 'mi' ? (meters / 1609.34).toFixed(meters < 16093 ? 1 : 0) + ' mi' : (meters / 1000).toFixed(meters < 10000 ? 1 : 0) + ' km';
export const fmtSpeed = (ms, unit = S.settings.unit) => unit === 'mi' ? Math.round(ms * 2.23694) + ' mph' : Math.round(ms * 3.6) + ' km/h';
export const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
export const fmtHour = (h) => (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
export const dayStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
// Weeks start on Sunday, or Monday when that's set in Settings.
export const weekStart = (t = Date.now()) => dayStart(t) - ((new Date(t).getDay() - (S.settings.weekMonday ? 1 : 0) + 7) % 7) * DAY;
export const monthStart = (t = Date.now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };

// Steps for a range: within one day, Health Connect's total (every app and watch, deduplicated, so the same
// number as Samsung Health) when Motio may read it, otherwise the larger of trip steps and the phone's step
// counter. Longer ranges add up their days, so weeks and recaps agree with Today.
function daySteps(from, to, tripSteps) {
  if (to - from <= DAY) {
    const key = new Date(from).toDateString(), hc = (S.hcSteps || {})[key];
    if (hc != null) return hc;
    return Math.max(tripSteps, (S.stepsByDay || {})[key] || 0);
  }
  if (to - from > 400 * DAY) return tripSteps;
  let sum = 0;
  for (let d = dayStart(from); d < to; d = dayStart(d + DAY + 2 * HOUR)) sum += summarize(Math.max(d, from), Math.min(dayStart(d + DAY + 2 * HOUR), to)).steps;
  return sum;
}
export function summarize(from, to) {
  return memo(`sum:${from}:${to}`, () => {
    const trips = allTrips().filter((t) => t.end > from && t.start < to);
    const per = Object.fromEntries(ORDER.map((k) => [k, { ms: 0, m: 0, steps: 0, top: 0, trips: 0 }]));
    const hourly = new Array(24).fill(0);
    let ms = 0, m = 0, steps = 0, top = 0;
    for (const t of trips) {
      const d = Math.max(0, Math.min(t.end, to) - Math.max(t.start, from));
      const p = per[t.mode] || per.walk;
      p.ms += d; p.m += t.distanceM; p.steps += t.steps || 0; p.top = Math.max(p.top, t.maxSpeed || 0); p.trips++;
      ms += d; m += t.distanceM; steps += t.steps || 0; top = Math.max(top, t.maxSpeed || 0);
      // Minutes per clock hour, one step per hour instead of per minute (much faster for long ranges).
      for (let x = Math.max(t.start, from), end = Math.min(t.end, to); x < end;) {
        const d = new Date(x), next = Math.min(end, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime());
        hourly[d.getHours()] += (next - x) / MIN; x = next;
      }
    }
    if (!S.demo) steps = daySteps(from, to, steps);
    const peak = hourly.indexOf(Math.max(...hourly));
    const modes = ORDER.map((k) => ({ key: k, ...MODES[k], ...per[k], pct: ms ? Math.round(per[k].ms / ms * 100) : 0 })).filter((x) => x.ms >= 30000).sort((a, b) => b.ms - a.ms); // a few seconds of a mode is noise, not a "0m run"
    return { from, to, trips, ms, min: ms / MIN, m, steps, top, hourly, peak: ms ? peak : null, modes, per, avg: ms ? m / (ms / 1000) : 0 };
  });
}
export const today = () => summarize(dayStart(), dayStart() + DAY);
export const range = (kind, anchor = Date.now()) => {
  if (kind === 'week') return summarize(weekStart(anchor), weekStart(anchor) + 7 * DAY);
  if (kind === 'month') { const a = monthStart(anchor), d = new Date(a); return summarize(a, new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()); }
  return summarize(dayStart(anchor), dayStart(anchor) + DAY);
};
export const days = (from, n) => Array.from({ length: n }, (_, i) => summarize(from + i * DAY, from + (i + 1) * DAY));

// ---------------------------------------------------------------- goals
// Daily-goal streaks, the last five weeks, and weekly goals per way of moving (run 3 times, ride 40 km).
export function goals() {
  return memo('goals', () => {
    const goal = S.settings.goalMin || 180, t0 = dayStart(), wk0 = weekStart();
    const hit = (d) => summarize(d, d + DAY).min >= goal;
    // A rest day: one missed day per week, between two goal days, keeps the streak going (it doesn't add to it).
    let streak = 0, restThisWeek = false;
    const rested = new Set();
    for (let d = t0 - (hit(t0) ? 0 : DAY); streak < 400; d -= DAY) {
      if (hit(d)) { streak++; continue; }
      const w = Math.floor((d - wk0) / (7 * DAY));
      if (!streak || rested.has(w) || !hit(d - DAY)) break;
      rested.add(w); if (w === 0) restThisWeek = true;
    }
    // shortcut: best streak looks back one year, enough until people have longer streaks than that.
    let best = streak, run = 0;
    for (let d = t0 - 365 * DAY; d <= t0; d += DAY) { run = hit(d) ? run + 1 : 0; best = Math.max(best, run); }
    const grid = days(wk0 - 28 * DAY, 35).map((d) => ({ day: d.from, min: d.min, pct: Math.min(1, d.min / goal), future: d.from > t0 }));
    const wk = summarize(wk0, wk0 + 7 * DAY), unitM = S.settings.unit === 'mi' ? 1609.34 : 1000;
    const week = (S.settings.weekGoals || []).map((g) => {
      const p = wk.per[g.mode] || { trips: 0, m: 0, ms: 0 };
      const have = g.metric === 'times' ? p.trips : g.metric === 'km' ? p.m / unitM : p.ms / MIN;
      return { ...g, have, pct: Math.min(1, have / g.target), done: have >= g.target };
    });
    const t = today();
    return { goal, stepGoal: S.settings.stepGoal || 10000, streak, best: Math.max(best, streak), restThisWeek, grid, week, todayMin: t.min, todaySteps: t.steps, daysLeft: Math.max(0, Math.round((wk0 + 7 * DAY - Date.now()) / DAY)) };
  });
}
export const addWeekGoal = (mode, metric, target) => setSetting('weekGoals', [...(S.settings.weekGoals || []), { id: Date.now(), mode, metric, target }]);
export const removeWeekGoal = (id) => setSetting('weekGoals', (S.settings.weekGoals || []).filter((g) => g.id !== id));

// ---------------------------------------------------------------- body
// Active calories from time on foot and on the bike (MET × weight × hours); driving and transit aren't counted.
const MET = { walk: 3.5, run: 9.8, bike: 7.0 };
export function body() {
  return memo('body', () => {
    const b = S.settings.body || {}, kg = b.kg || 70, t0 = dayStart(), wk0 = weekStart(), now = Date.now();
    const kcal = (x) => Object.keys(MET).reduce((a, k) => a + MET[k] * kg * (x.per[k].ms / HOUR), 0);
    const active = (x) => Object.keys(MET).reduce((a, k) => a + x.per[k].ms / MIN, 0);
    const t = summarize(t0, t0 + DAY), thisW = summarize(wk0, now), lastW = summarize(wk0 - 7 * DAY, now - 7 * DAY);
    return {
      kg, cm: b.cm || 175, known: !!b.kg, today: kcal(t), todayMin: active(t),
      per: Object.keys(MET).map((k) => ({ key: k, kcal: MET[k] * kg * (t.per[k].ms / HOUR), min: t.per[k].ms / MIN })),
      week: days(t0 - 6 * DAY, 7).map((d) => ({ day: d.from, kcal: kcal(d), min: active(d) })),
      weekKcal: kcal(thisW), lastKcal: kcal(lastW), weekMin: active(thisW)
    };
  });
}

// ---------------------------------------------------------------- achievements
// Badges earned from your real trips; progress shows how close you are.
export function achievements() {
  return memo('ach', () => {
    const trips = allTrips().filter((t) => !t.live);
    const days = [];
    if (trips.length) for (let d = dayStart(trips[0].start); d <= dayStart(); d += DAY) days.push(summarize(d, d + DAY));
    let streak = 0, best = 0, carFree = 0, bestCarFree = 0;
    for (const d of days) {
      streak = d.min >= 10 ? streak + 1 : 0; best = Math.max(best, streak);
      carFree = d.min >= 10 && !d.per.drive.ms ? carFree + 1 : 0; bestCarFree = Math.max(bestCarFree, carFree);
    }
    const weeks = new Map();
    for (const t of trips) { const w = weekStart(t.start); if (!weeks.has(w)) weeks.set(w, new Set()); weeks.get(w).add(t.mode); }
    const hourMin = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
    const max = (arr) => arr.reduce((a, b) => Math.max(a, b), 0);
    const goal = S.settings.goalMin || 180;
    const totalKm = trips.reduce((a, t) => a + t.distanceM, 0) / 1000;
    const list = [
      ['first', 'First steps', 'Record your first trip', 1, trips.length, '#3DBF5C'],
      ['walk5', '5 km on foot', 'Walk or run 5 km in one day', 5, max(days.map((d) => (d.per.walk.m + d.per.run.m) / 1000)), '#3DBF5C', 'km'],
      ['steps10k', '10,000 steps', 'Take 10,000 steps in one day', 10000, max(days.map((d) => d.steps)), '#F2766B', 'steps'],
      ['streak7', 'One-week streak', 'Move at least 10 minutes every day for 7 days', 7, best, '#F6C343', 'days'],
      ['streak30', 'Thirty-day streak', 'Keep it going for 30 days', 30, best, '#F6C343', 'days'],
      ['goal10', 'Goal getter', 'Reach your daily goal on 10 days', 10, days.filter((d) => d.min >= goal).length, '#5B4FE0', 'days'],
      ['all5', 'All five', 'Walk, run, cycle, drive and take transit in one week', 5, max([...weeks.values()].map((m) => m.size)), '#B57BE0', 'ways'],
      ['transit10', 'Bus regular', 'Take 10 bus or train trips', 10, trips.filter((t) => t.mode === 'transit').length, '#B57BE0', 'trips'],
      ['carfree', 'Car-free week', 'Seven days in a row moving without driving', 7, bestCarFree, '#3DBF5C', 'days'],
      ['ride20', 'Long ride', 'Cycle 20 km in one trip', 20, max(trips.filter((t) => t.mode === 'bike').map((t) => t.distanceM / 1000)), '#6E8CF7', 'km'],
      ['early', 'Early bird', 'Start a trip before 6:30 AM', 1, trips.filter((t) => hourMin(t.start) < 390).length, '#F6C343'],
      ['night', 'Night owl', 'Be on the move after 11 PM', 1, trips.filter((t) => hourMin(t.end) >= 1380 || hourMin(t.start) >= 1380).length, '#2D2A6E'],
      ['k100', '100 km club', 'Cover 100 km in total', 100, totalKm, '#F2766B', 'km'],
      ['k1000', '1,000 km club', 'Cover 1,000 km in total', 1000, totalKm, '#F2766B', 'km']
    ];
    return list.map(([id, title, desc, target, value, color, unit]) => ({
      id, title, desc, color, got: value >= target, progress: Math.min(1, value / target),
      label: value >= target ? 'Earned' : unit ? `${unit === 'km' ? value.toFixed(value < 10 ? 1 : 0) : fmtNum(value)} / ${fmtNum(target)} ${unit}` : 'Not yet',
      fresh: value >= target && !(S.settings.seenBadges || []).includes(id)
    }));
  });
}
export const markBadgesSeen = () => setSetting('seenBadges', achievements().filter((a) => a.got).map((a) => a.id));

// ---------------------------------------------------------------- places
// Where you spend time, found from where trips start and end (spots within 150 m count as one place).
export function places() {
  return memo('places', () => {
    const trips = allTrips().filter((t) => !t.live && t.points && t.points.length);
    const spots = [];
    const at = (p) => { let c = spots.find((x) => hav(x, p) < 150); if (!c) { c = [p[0], p[1], { visits: 0, ms: 0, night: 0, work: 0, last: 0 }]; spots.push(c); } return c; };
    trips.forEach((t, i) => {
      const end = t.points[t.points.length - 1], c = at(end);
      c[2].visits++; c[2].last = Math.max(c[2].last, t.end);
      const next = trips[i + 1];
      if (next && hav(end, next.points[0]) < 150) {
        // Time spent here until the next trip, split into night (home-like) and weekday office hours (work-like).
        for (let x = t.end; x < Math.min(next.start, t.end + 16 * HOUR); x += 15 * MIN) {
          const d = new Date(x), h = d.getHours();
          c[2].ms += 15 * MIN;
          if (h >= 22 || h < 6) c[2].night += 15 * MIN;
          else if (h >= 9 && h < 17 && d.getDay() % 6) c[2].work += 15 * MIN;
        }
      }
    });
    spots.sort((a, b) => b[2].ms - a[2].ms || b[2].visits - a[2].visits);
    const home = spots.reduce((a, c) => (c[2].night > (a ? a[2].night : 0) ? c : a), null);
    const work = spots.filter((c) => c !== home).reduce((a, c) => (c[2].work > (a ? a[2].work : 0) ? c : a), null);
    const names = S.settings.placeNames || {};
    return spots.slice(0, 10).map((c, i) => {
      const id = c[0].toFixed(3) + ',' + c[1].toFixed(3);
      const auto = c === home ? 'Home' : c === work ? 'Work' : 'Place ' + (i + 1);
      return { id, lat: c[0], lng: c[1], name: names[id] || auto, kind: c === home ? 'home' : c === work ? 'work' : 'place', visits: c[2].visits, hours: c[2].ms / HOUR, last: c[2].last };
    });
  });
}
export const renamePlace = (id, name) => setSetting('placeNames', { ...(S.settings.placeNames || {}), [id]: String(name).slice(0, 30) });

// ---------------------------------------------------------------- timeline, trip details, insights
// One day as a story: stays at places between trips, and the trips themselves.
export function timeline(day = dayStart()) {
  const trips = summarize(day, day + DAY).trips;
  const pl = places();
  const placeAt = (p) => (p ? pl.find((x) => hav([x.lat, x.lng], p) < 150) : null);
  const items = [];
  trips.forEach((t, i) => {
    const prev = trips[i - 1];
    const stayStart = prev ? prev.end : Math.max(day, t.start - 8 * HOUR);
    if (t.start - stayStart > 5 * MIN && t.points && t.points.length) {
      const pp = placeAt(t.points[0]);
      items.push({ kind: 'stay', start: prev ? stayStart : null, end: t.start, name: pp ? pp.name : 'A stop', placeKind: pp ? pp.kind : 'place' });
    }
    items.push({ kind: 'trip', id: t.id, mode: t.mode, start: t.start, end: t.end, distanceM: t.distanceM, steps: t.steps || 0, live: !!t.live });
  });
  const last = trips[trips.length - 1];
  if (last && !last.live && last.points && last.points.length) {
    const pp = placeAt(last.points[last.points.length - 1]);
    items.push({ kind: 'stay', start: last.end, end: null, name: pp ? pp.name : 'A stop', placeKind: pp ? pp.kind : 'place' });
  }
  return items;
}
export const findTrip = (id) => allTrips().find((t) => t.id === id) || null;

// Weekly findings for Insights: when you move, your big day, how regular you are, and the week in other terms.
export function findings() {
  return memo('findings', () => {
    const now = Date.now(), from = dayStart() - 6 * DAY, wk = summarize(from, now), out = [];
    if (wk.min < 20) return out;
    const before10 = wk.hourly.slice(0, 10).reduce((a, m) => a + m, 0), after18 = wk.hourly.slice(18).reduce((a, m) => a + m, 0);
    const share = Math.round(before10 / wk.min * 100), late = Math.round(after18 / wk.min * 100);
    out.push({ kind: 'hours', kicker: 'When you move', hourly: wk.hourly.slice(6), peak: wk.peak,
      text: share >= 35 ? `You’re a morning mover: ${share}% of your week happened before 10 AM.` : late >= 35 ? `You come alive in the evening: ${late}% of your week came after 6 PM.` : `Your busiest hour was ${fmtHour(wk.peak)}.` });
    const ds = days(from, 7), mins = ds.map((d) => d.min), top = mins.indexOf(Math.max(...mins)), avg = wk.min / 7;
    out.push({ kind: 'days', kicker: 'Your big day', mins, labels: ds.map((d) => new Date(d.from).toLocaleDateString('en-GB', { weekday: 'narrow' })), top,
      text: `${new Date(ds[top].from).toLocaleDateString('en-GB', { weekday: 'long' })} wins with ${fmtMin(mins[top])}` + (avg > 0 && mins[top] >= 1.8 * avg ? `, ${(mins[top] / avg).toFixed(1)}× your usual day.` : '.') });
    // First trip of each of the last 14 days: how steady your start is.
    const starts = days(dayStart() - 13 * DAY, 14).map((d) => d.trips[0]).filter(Boolean).map((t) => { const x = new Date(t.start); return x.getHours() * 60 + x.getMinutes(); });
    if (starts.length >= 4) {
      const mean = starts.reduce((a, m) => a + m, 0) / starts.length, sd = Math.sqrt(starts.reduce((a, m) => a + (m - mean) ** 2, 0) / starts.length);
      const hm = (m) => Math.floor(m / 60) + ':' + String(Math.round(m % 60)).padStart(2, '0');
      out.push({ kind: 'clock', kicker: 'Habits', starts, mean, sd,
        text: sd <= 20 ? `Like clockwork: your day starts around ${hm(mean)}, give or take ${Math.max(1, Math.round(sd))} minutes.` : `Your days start anywhere from ${hm(Math.min(...starts))} to ${hm(Math.max(...starts))}.` });
    }
    const top2 = wk.modes[0];
    if (top2) out.push({ kind: 'mix', kicker: 'How you moved', modes: wk.modes.map((m) => ({ key: m.key, pct: m.pct, color: m.color, label: m.label })), text: `${top2.label} took ${top2.pct}% of your moving time this week.` });
    const km = wk.m / 1000;
    if (km >= 2) out.push({ kind: 'compare', kicker: 'Put another way', km, text: km >= 42.2 ? `${fmtDist(wk.m)} this week: that’s ${(km / 42.195).toFixed(1)} marathons.` : `${fmtDist(wk.m)} this week: ${Math.round(km / 0.4)} laps of a running track.` });
    return out;
  });
}

// Memories: your biggest trip on this date a week, a month and a year ago (only the ones that exist).
export function memories() {
  return memo('memories', () => {
    const today = summarize(dayStart(), dayStart() + DAY);
    return [[7, '1 week'], [30, '1 month'], [365, '1 year']].map(([n, label]) => {
      const d = dayStart() - n * DAY, sum = summarize(d, d + DAY), t = sum.trips.slice().sort((a, b) => b.distanceM - a.distanceM)[0];
      return t && t.distanceM >= 300 ? { label, day: d, trip: t, thenMin: sum.min, nowMin: today.min } : null;
    }).filter(Boolean);
  });
}

// After a workout: time without pauses, pace, calories, splits, a pace curve and whether it beat your best.
export function workoutSummary(id) {
  const t = findTrip(id);
  if (!t) return null;
  const ms = Math.max(1, t.end - t.start - (t.pausedMs || 0)), km = t.distanceM / 1000;
  const kg = (S.settings.body && S.settings.body.kg) || 70;
  const pts = t.points || [], series = [];
  for (let i = 1; i < pts.length; i++) { const dt = (pts[i][2] - pts[i - 1][2]) / 1000; if (dt > 0) series.push(Math.min(15, hav(pts[i - 1], pts[i]) / dt)); }
  const smooth = series.map((_, i) => { const w = series.slice(Math.max(0, i - 3), i + 4); return w.reduce((a, v) => a + v, 0) / w.length; });
  const same = allTrips().filter((x) => x.id !== t.id && x.mode === t.mode && !x.live);
  const pace = (x) => (x.end - x.start - (x.pausedMs || 0)) / Math.max(0.001, x.distanceM / 1000);
  const best = !same.length ? null : km > Math.max(...same.map((x) => x.distanceM / 1000)) ? 'Longest ' + MODES[t.mode].label.toLowerCase() + ' yet'
    : km >= 1 && same.filter((x) => x.distanceM >= 1000).every((x) => pace(t) < pace(x)) ? 'Fastest ' + MODES[t.mode].label.toLowerCase() + ' yet' : null;
  // Pace and speed only mean something over real distance; impossible values (GPS noise) are left out.
  const measurable = km >= 0.1, paceS = measurable ? ms / 1000 / km : null, speed = measurable ? km / (ms / HOUR) : null;
  return { trip: t, ms, km, paceS: paceS && paceS < 3600 && paceS > 60 ? paceS : null, speed: speed && speed < 80 ? speed : null,
    kcal: (MET[t.mode] || 0) * kg * (ms / HOUR), splits: measurable ? splits(t) : [], series: measurable ? smooth : [], best };
}
// Splits: time for each full kilometre (or mile), from the GPS points.
export function splits(t) {
  const unitM = S.settings.unit === 'mi' ? 1609.34 : 1000, out = [];
  let acc = 0, from = t.points && t.points[0] ? t.points[0][2] : t.start;
  for (let i = 1; t.points && i < t.points.length; i++) {
    acc += hav(t.points[i - 1], t.points[i]);
    if (acc >= unitM) { out.push((t.points[i][2] - from) / 1000); acc -= unitM; from = t.points[i][2]; }
  }
  // GPS gaps leave the route shorter than the trip; per-unit times would then be wrong, so show none.
  return pathLen(t.points || []) < 0.7 * t.distanceM ? [] : out; // seconds per unit
}
// Activity calendar, weekly trend, this week vs last, and CO2 not emitted by moving without a car.
export function insights() {
  return memo('insights', () => {
    const today = dayStart(), first = today - 181 * DAY;
    const cal = days(first, 182).map((d) => ({ day: d.from, min: d.min }));
    const w0 = weekStart();
    const weeks = Array.from({ length: 12 }, (_, i) => { const a = w0 - (11 - i) * 7 * DAY; return { from: a, min: summarize(a, a + 7 * DAY).min }; });
    const elapsed = Date.now() - w0;
    const cur = summarize(w0, w0 + 7 * DAY), prev = summarize(w0 - 7 * DAY, w0 - 7 * DAY + elapsed);
    const month = summarize(monthStart(), Date.now());
    // kg CO2 per km: average car 0.17; bus/train 0.04; walking, running and cycling 0.
    const savedKg = (month.per.walk.m + month.per.run.m + month.per.bike.m) / 1000 * 0.17 + month.per.transit.m / 1000 * (0.17 - 0.04);
    return { cal, weeks, cur, prev, savedKg, monthKm: month.m / 1000 };
  });
}

// ---------------------------------------------------------------- explorer
// The city as ~150 m squares; every square a trip passed through is "uncovered".
const CELL = 0.00135;
export function explorer() {
  return memo('explorer', () => {
    const seen = new Map(), w0 = weekStart();
    for (const t of allTrips()) for (const p of t.points || []) {
      const k = Math.round(p[0] / CELL) + ':' + Math.round(p[1] / (CELL / Math.cos((p[0] * Math.PI) / 180)));
      const was = seen.get(k);
      if (!was || p[2] < was[2]) seen.set(k, [p[0], p[1], p[2]]);
    }
    const cells = [...seen.values()];
    const home = places().find((x) => x.kind === 'home') || (cells[0] ? { lat: cells[0][0], lng: cells[0][1] } : { lat: 40.4093, lng: 49.8671 });
    // "Your city": everything within 8 km of home, about 9,900 squares.
    const cityCells = Math.round((Math.PI * 8000 * 8000) / (150 * 150));
    const inCity = cells.filter((c) => hav([home.lat, home.lng], c) < 8000).length;
    return { cells, count: cells.length, newThisWeek: cells.filter((c) => c[2] >= w0).length, pct: (inCity / cityCells) * 100, home, km2: (cells.length * 0.0225) };
  });
}

// Current speed over the last few fixes, so one jumpy GPS fix doesn't spike the number.
export const liveTrip = () => (live ? { ...live, speed: S.lastFix && live.points.length > 1 ? (() => { const pts = live.points.slice(-4); return pathLen(pts) / Math.max(1, (pts[pts.length - 1][2] - pts[0][2]) / 1000); })() : 0 } : null);

// ---------------------------------------------------------------- connections
// GPX files from Strava, Garmin, Komoot or any tracker become trips (one per track). Returns how many were added.
export function importGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('not_gpx');
  const TYPES = { run: 'run', running: 'run', walk: 'walk', walking: 'walk', hiking: 'walk', hike: 'walk', ride: 'bike', cycling: 'bike', biking: 'bike', bike: 'bike', driving: 'drive', drive: 'drive', bus: 'transit', train: 'transit', transit: 'transit' };
  let added = 0;
  for (const trk of doc.querySelectorAll('trk')) {
    const pts = [...trk.querySelectorAll('trkpt')].map((n) => [+n.getAttribute('lat'), +n.getAttribute('lon'), Date.parse(n.querySelector('time')?.textContent || ''), 5])
      .filter((p) => p.every(Number.isFinite));
    if (pts.length < 2) continue;
    const t = { start: pts[0][2], end: pts[pts.length - 1][2], points: pts, distanceM: pts.reduce((a, q, i) => a + (i ? hav(pts[i - 1], q) : 0), 0), steps: 0 };
    const named = TYPES[(trk.querySelector('type')?.textContent || '').trim().toLowerCase()];
    const id = 'g' + t.start.toString(36) + Math.round(t.distanceM).toString(36);
    saveTrip({ ...t, id, mode: named || classifyTrip(features(t), S.settings.learned || []), locked: !!named, maxSpeed: 0, f: vector(features(t)) });
    added++;
  }
  return added;
}
// Webhooks: every finished trip is posted as JSON to your URL (IFTTT, Zapier, Make, Home Assistant, n8n…).
export async function sendWebhook(t, url = S.settings.webhook) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    event: 'trip.finished', app: 'motio', trip: { id: t.id, mode: t.mode, type: MODES[t.mode].name, start: new Date(t.start).toISOString(), end: new Date(t.end).toISOString(),
      minutes: Math.round((t.end - t.start) / MIN), km: +(t.distanceM / 1000).toFixed(2), steps: t.steps || 0, top_kmh: Math.round((t.maxSpeed || 0) * 3.6) } }) });
  if (!res.ok) throw new Error('webhook ' + res.status);
}

export function records() {
  return memo('records', () => {
    const trips = allTrips();
    const best = (mode, f) => trips.filter((t) => t.mode === mode).reduce((a, t) => (!a || f(t) > f(a) ? t : a), null);
    const ride = best('bike', (t) => t.distanceM);
    const run = trips.filter((t) => t.mode === 'run' && t.distanceM > 800).reduce((a, t) => { const pace = (t.end - t.start) / t.distanceM; return !a || pace < a.pace ? { t, pace } : a; }, null);
    let stepsDay = null;
    for (let d = dayStart(trips.length ? trips[0].start : Date.now()); d <= dayStart(); d += DAY) { const s = summarize(d, d + DAY); if (s.steps && (!stepsDay || s.steps > stepsDay.steps)) stepsDay = { day: d, steps: s.steps }; }
    return { ride, run, stepsDay };
  });
}

export function personality(anchor = Date.now()) {
  anchor = Math.ceil(anchor / MIN) * MIN;
  return memo('pers:' + anchor, () => {
    const s = summarize(anchor - 30 * DAY, anchor);
    if (s.ms < 3 * HOUR) return { key: null, name: 'Still warming up', enough: false };
    const share = (k) => s.per[k].ms / s.ms;
    const foot = share('walk') + share('run');
    const night = s.hourly.slice(20).concat(s.hourly.slice(0, 4)).reduce((a, b) => a + b, 0) / Math.max(1, s.hourly.reduce((a, b) => a + b, 0));
    const ways = s.modes.length;
    let key = 'wanderer';
    if (night > 0.3) key = 'nightowl';
    else if (share('drive') > 0.5) key = 'roadtripper';
    else if (share('run') > 0.18) key = 'speedster';
    else if (foot > 0.33 && ways >= 3) key = 'wanderer';
    else if (s.hourly[7] + s.hourly[8] + s.hourly[17] + s.hourly[18] > 0.5 * s.hourly.reduce((a, b) => a + b, 0)) key = 'commuter';
    else key = 'explorer';
    const names = { wanderer: 'The Urban Wanderer', speedster: 'The Speedster', commuter: 'The Commuter', roadtripper: 'The Road Tripper', explorer: 'The Explorer', nightowl: 'The Night Owl' };
    return { key, name: names[key], enough: true, foot, ways, night, s };
  });
}

// Route of a time window for the map: points with time and mode, in order.
export function route(from, to) {
  return allTrips().filter((t) => t.end > from && t.start < to && t.points && t.points.length).map((t) => ({ id: t.id, mode: t.mode, color: MODES[t.mode].color, start: t.start, end: t.end, points: outsideZones(t.points), distanceM: t.distanceM, live: !!t.live })).filter((r) => r.points.length > 1);
}

export const status = () => ({ signedIn: !!S.token, user: S.user, demo: !!S.demo, syncError: S.syncError || null, pending: Object.keys(S.dirty).length, syncedAt: S.lastSync || 0, trips: Object.values(S.trips).filter((t) => !t.deleted).length, version, tracking: tracking(), api: API });
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Resume tracking after a restart when the user had it on.
if (S.token && S.settings.autoTrack) setTimeout(() => startTracking(), 1500);
if (S.token) setTimeout(scheduleAlert, 4000);
if (S.token) setTimeout(() => pushLockCard(true), 4500);
if (S.token) ready.then(() => setTimeout(prune, 5000));
if (S.token) setTimeout(sync, 2500);

const Motio = { MODES, PARTNERS, requestBackgroundLocation, apps, phoneSetup, findings, memories, workoutSummary, friends, body, goals, addWeekGoal, removeWeekGoal, explorer, liveTrip, workout, startWorkout, pauseWorkout, finishWorkout, timeline, findTrip, splits, insights, achievements, markBadgesSeen, places, renamePlace, addZoneAt, importGpx, sendWebhook, storyImage: renderStory, openPage, cardImage, health, strava, captureScreen, shareImage, sendFeedback, pinWidget, widgetStatus, widgetPreview, shareCard, saveFile, scheduleAlert, deleteTrip, prune, addZoneHere, removeZone, auth, updateProfile, setSetting, settings, sync, saveTrip, retypeTrip, deleteHistory, exportData, startTracking, stopTracking, tracking, openLocationSettings, setDemo, isDemo, summarize, today, range, days, records, personality, route, status, subscribe, fmtMin, fmtDist, fmtSpeed, fmtNum, fmtHour, dayStart, weekStart, monthStart, DAY, HOUR, MIN };
// Test hook: feed simulated GPS fixes and activity results (used from the dev tools, not by screens).
Motio._feed = { location: onLocation, activity: onActivity, live: () => live };
window.Motio = Motio;
export default Motio;
