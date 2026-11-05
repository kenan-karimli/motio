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

const BG = registerPlugin('BackgroundGeolocation');
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
const blank = () => ({ token: null, user: null, trips: {}, lastSync: 0, dirty: {}, settings: { unit: 'km', goalMin: 180, stepGoal: 10000, recapStyle: 'bold', autoTrack: true }, demo: false, tracking: false });
let S = blank();
try { S = { ...S, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* first run */ }
// Data v2: trips recorded by the old tracker were unreliable (never-ending trips, wrong types), so start clean once.
if (S.v !== 2) { S = { ...S, v: 2, trips: {}, dirty: {}, lastSync: 0, demo: false, anchor: null, live: null, stepsDay: null, wipePending: !!S.token }; }
const listeners = new Set();
const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* full */ } };
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
// Home screen widget: push today's numbers a few seconds after things change.
let widgetT = 0, widgetSig = '';
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
    todayI: Math.round((dayStart() - w0) / DAY)
  };
}
// Home screen widgets: redraw a few seconds after things change, only when what they show changed.
function pushWidget(force) {
  if (!native || !S.token) return;
  clearTimeout(widgetT);
  widgetT = setTimeout(async () => {
    pushLockCard(force);
    const D = widgetData(), sig = JSON.stringify(D);
    if (sig === widgetSig && !force) return;
    widgetSig = sig;
    try { await document.fonts.load('700 40px Poppins'); } catch { /* system font is fine */ }
    for (const kind of WIDGET_KINDS) {
      const png = drawWidget(kind, D).toDataURL('image/png').split(',')[1];
      await Sensors.updateWidget({ kind, png }).catch(() => {});
    }
  }, force ? 300 : 4000);
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
    if (r.connected) { setSetting('healthSync', true); await healthPush(S.settings.importPast === false ? Date.now() - DAY : Date.now() - 30 * DAY); }
    return r;
  },
  disconnect() { setSetting('healthSync', false); return Health.openSettings().catch(() => {}); },
  syncedAt: () => S.healthAt || null
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

const signedIn = (d) => { S.token = d.token; S.user = d.user; S.sessionExpired = false; if (d.user.settings) S.settings = { ...S.settings, ...d.user.settings }; changed(); sync(); if (S.settings.autoTrack) setTimeout(startTracking, 800); return d.user; };

export const auth = {
  register: (name, email, password) => api('POST', '/v1/auth/register', { name, email, password }),
  verify: async (email, code) => signedIn(await api('POST', '/v1/auth/verify', { email, code })),
  resend: (email, purpose = 'verify') => api('POST', '/v1/auth/resend', { email, purpose }),
  login: async (email, password) => signedIn(await api('POST', '/v1/auth/login', { email, password })),
  forgot: (email) => api('POST', '/v1/auth/forgot', { email }),
  reset: async (email, code, password) => signedIn(await api('POST', '/v1/auth/reset', { email, code, password })),
  logout: async () => { stopTracking(); await sync(); try { await api('POST', '/v1/auth/logout', {}); } catch { /* still log out locally */ } S = { ...blank(), settings: S.settings }; changed(); pushLockCard(); },
  // Removes the account and every trip on the server, then clears this phone.
  async deleteAccount(password) {
    await api('POST', '/v1/me/delete', { password });
    stopTracking(); S = { ...blank(), settings: S.settings }; changed(); pushLockCard();
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
    if (S.wipePending) { await api('DELETE', '/v1/trips'); S.wipePending = false; S.lastSync = 0; }
    const dirty = Object.keys(S.dirty).map((id) => S.trips[id]).filter(Boolean);
    const out = await api('POST', '/v1/trips/sync', { trips: dirty.slice(0, 500), since: S.lastSync });
    for (const t of dirty.slice(0, 500)) delete S.dirty[t.id];
    for (const t of out.trips) { const mine = S.trips[t.id]; if (!mine || (mine.updatedAt || 0) <= t.updatedAt) S.trips[t.id] = t; }
    S.lastSync = out.serverTime;
    if (dirty.length && S.settings.stravaAuto) strava.upload().catch(() => {});
    S.syncError = null;
    changed();
  } catch (e) { S.syncError = e.code || 'error'; changed(false); } finally { syncing = false; }
}
setInterval(() => { if (Object.keys(S.dirty).length) sync(); }, 60000);
window.addEventListener('online', () => sync());

export function saveTrip(t) {
  S.trips[t.id] = { ...t, updatedAt: Date.now() }; S.dirty[t.id] = 1; changed();
  if (native && S.settings.healthSync) { clearTimeout(healthT); healthT = setTimeout(() => healthPush(Date.now() - 2 * DAY).catch(() => {}), 5000); }
}
export function deleteTrip(id) { const t = S.trips[id]; if (t) saveTrip({ ...t, deleted: true, points: [] }); sync(); }
// "Keep my history for": 0 = 3 months, 1 = 1 year, 2 = forever. Deleted trips sync, so the server forgets them too.
const KEEP_DAYS = [92, 366, Infinity];
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
  S.trips = {}; S.dirty = {}; S.lastSync = 0; S.wipePending = true; changed();
  await sync(); // if offline, the wipe waits in wipePending and runs on the next sync
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
let watcherId = null, live = S.live || null, lastStepTotal = null;

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
let ar = null, arSub = null;
function onActivity(e) {
  const now = Date.now();
  if (live && ar && ar.type !== 'still') {
    live.ar = live.ar || {};
    live.ar[ar.type] = (live.ar[ar.type] || 0) + Math.min(now - ar.at, 2 * MIN) * ar.conf / 100;
  }
  ar = { type: e.type, conf: e.confidence, at: now };
  if (e.confidence >= 70 && KIND[e.type]) consider(e.type, now);
  if (live && e.type === 'still' && e.confidence >= 80 && now - live.lastMove > STILL_END) closeLive(live.lastMove);
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

function closeLive(endAt) {
  if (!live) return;
  const t = live; live = null; S.live = null;
  t.end = Math.min(endAt, t.end);
  if (t.distanceM < 150 || (t.distanceM < 400 && t.end - t.start < 90000)) { changed(); return; } // GPS jitter or fidgeting, not a trip
  const f = features(t);
  saveTrip({ id: t.id, start: t.start, end: t.end, mode: t.locked ? t.mode : classifyTrip(f, S.settings.learned || []), locked: !!t.locked,
    distanceM: Math.round(t.distanceM), steps: t.steps, maxSpeed: t.maxSpeed, points: t.points, f: vector(f) });
}

function onLocation(loc) {
  if (!loc) return;
  const p = [+loc.latitude.toFixed(6), +loc.longitude.toFixed(6), loc.time || Date.now(), Math.round(loc.accuracy || 0)];
  if ((loc.accuracy || 0) > 80) return;
  S.lastFix = p;
  const now = p[2];
  // Standing still sends no GPS updates at all, so a long gap means the trip ended back then.
  if (live && now - live.lastMove > STILL_END) { S.anchor = live.points[live.points.length - 1]; closeLive(live.lastMove); }
  if (live) {
    const prev = live.points[live.points.length - 1];
    const d = hav(prev, p), dt = Math.max(1, (now - prev[2]) / 1000);
    const speed = loc.speed != null && loc.speed >= 0 ? loc.speed : d / dt;
    // Moves smaller than the fix's own accuracy are jitter, and jumps faster than 250 km/h are GPS errors.
    if (d / dt > 70) return;
    if (d < Math.max(8, p[3] * 0.8) && speed < 0.6) {
      // Standing: remember since when, so a stop (bus stop, red light) can be counted when moving resumes.
      if (!live.stillSince) live.stillSince = now;
      changed(false); return;
    }
    // A pause of 8–150 s between moving stretches is a stop; also counted when GPS went quiet for that long.
    const paused = (now - (live.stillSince || prev[2])) / 1000;
    if (paused >= 8 && paused <= 150 && (live.stillSince || d / dt < 3)) live.stops = (live.stops || 0) + 1;
    live.stillSince = 0;
    live.lastMove = now;
    // Without a recent reading from the activity model, sustained speed decides: over 25 km/h is a vehicle, under 8 km/h on foot.
    if (!(ar && Date.now() - ar.at < 60000)) { if (speed > 7) consider('vehicle', now); else if (speed < 2.2) consider('walk', now); }
    live.points.push(p); live.distanceM += d; live.end = now;
    live.maxSpeed = Math.max(live.maxSpeed, Math.min(speed, 70));
    if (live.points.length > 6000) live.points.splice(1, 1);
    // The type shown while moving is re-judged from the whole trip so far, at most every 20 s.
    if (!live.locked && now - (live.judged || 0) > 20000) { live.judged = now; live.mode = typeOf(live); }
  } else {
    // A trip starts only after leaving the resting spot by more than the GPS error, or at a trusted speed.
    // The resting spot stays put while you walk away from it; it only moves once you've settled somewhere new.
    if (S.anchor && (now - S.anchor[2] > STILL_END || now < S.anchor[2])) S.anchor = p; // stale, or the clock jumped back
    const moved = S.anchor ? hav(S.anchor, p) : 0;
    const arMoving = ar && Date.now() - ar.at < 60000 && ar.type !== 'still' && ar.conf >= 60;
    if (S.anchor && (moved > Math.max(60, 2 * p[3]) || ((loc.speed || 0) > 1.5 && p[3] < 25) || (arMoving && moved > Math.max(30, p[3])))) {
      const guess = arMoving ? (ar.type === 'vehicle' ? 'drive' : ar.type) : (loc.speed || 0) > 8 ? 'drive' : 'walk';
      startLive(guess, [S.anchor[0], S.anchor[1], Math.max(S.anchor[2], now - 60000), S.anchor[3]]); live.points.push(p); live.end = now; live.distanceM = moved; live.lastMove = now;
      S.anchor = null;
    } else if (!S.anchor) S.anchor = p;
  }
  changed(false);
}
function startLive(mode, first) {
  live = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: first[2], end: first[2], mode, distanceM: 0, steps: 0, maxSpeed: 0, points: [first], lastMove: first[2], ar: {} };
  S.live = live;
}
// Ends a trip that went quiet even if no more GPS updates come, and keeps the live trip saved across restarts.
setInterval(() => {
  if (live && Date.now() - live.lastMove > STILL_END) closeLive(live.lastMove);
  if (live) { S.live = live; flush(); }
}, 30000);
if (live && Date.now() - live.lastMove > STILL_END) setTimeout(() => closeLive(live.lastMove), 0);
function onSteps(total) {
  if (total == null) return;
  const now = Date.now();
  if (lastStepTotal != null && total >= lastStepTotal) {
    const delta = total - lastStepTotal;
    const day = new Date().toDateString();
    S.stepsDay = S.stepsDay && S.stepsDay.day === day ? S.stepsDay : { day, steps: 0 };
    S.stepsDay.steps += delta;
    if (live) live.steps += delta;
  }
  lastStepTotal = total;
  changed(false);
}

let stepSub = null;
export async function startTracking() {
  if (!native || watcherId) return { ok: !!watcherId };
  try {
    if (S.settings.countSteps !== false) {
      try { await Sensors.requestStepPermission(); } catch { /* no step sensor */ }
      stepSub = await Sensors.addListener('steps', (e) => onSteps(e.steps)).catch(() => null);
      const st = await Sensors.getSteps().catch(() => ({}));
      onSteps(st.steps);
    }
    // Same permission as steps; without it, trips are typed from speed and steps alone.
    arSub = await Sensors.addListener('activity', onActivity).catch(() => null);
    await Sensors.startActivity().catch(() => {});
    watcherId = await BG.addWatcher({ backgroundTitle: 'Motio is tracking your moves', backgroundMessage: 'Tap to open. Turn off in Settings › Tracking.', requestPermissions: true, stale: false, distanceFilter: 10 },
      (loc, err) => { if (err) { S.trackError = err.code === 'NOT_AUTHORIZED' ? 'denied' : 'error'; stopTracking(); changed(false); return; } S.trackError = null; onLocation(loc); });
    S.tracking = true; changed();
    return { ok: true };
  } catch (e) { S.trackError = 'error'; changed(false); return { ok: false }; }
}
export function stopTracking() {
  closeLive(Date.now());
  if (watcherId) { BG.removeWatcher({ id: watcherId }).catch(() => {}); watcherId = null; }
  if (stepSub) { stepSub.remove(); stepSub = null; }
  if (arSub) { arSub.remove(); arSub = null; Sensors.stopActivity().catch(() => {}); }
  S.tracking = false; changed();
}
export const tracking = () => ({ on: !!watcherId, live: !!live, error: S.trackError || null, mode: live ? live.mode : null });
export const openLocationSettings = () => BG.openSettings().catch(() => {});

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
export const weekStart = (t = Date.now()) => dayStart(t) - new Date(t).getDay() * DAY;
export const monthStart = (t = Date.now()) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };

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
    if (!S.demo && S.stepsDay && from <= dayStart() && to > dayStart() && to - from <= DAY) steps = Math.max(steps, S.stepsDay.day === new Date().toDateString() ? S.stepsDay.steps : 0);
    const peak = hourly.indexOf(Math.max(...hourly));
    const modes = ORDER.map((k) => ({ key: k, ...MODES[k], ...per[k], pct: ms ? Math.round(per[k].ms / ms * 100) : 0 })).filter((x) => x.ms > 0).sort((a, b) => b.ms - a.ms);
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

export const status = () => ({ signedIn: !!S.token, user: S.user, demo: !!S.demo, syncError: S.syncError || null, pending: Object.keys(S.dirty).length, version, tracking: tracking(), api: API });
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Resume tracking after a restart when the user had it on.
if (S.token && S.settings.autoTrack) setTimeout(() => startTracking(), 1500);
if (S.token) setTimeout(scheduleAlert, 4000);
if (S.token) setTimeout(() => pushLockCard(true), 4500);
if (S.token) setTimeout(prune, 5000);
if (S.token) setTimeout(sync, 2500);

const Motio = { MODES, storyImage: renderStory, openPage, cardImage, health, strava, captureScreen, shareImage, sendFeedback, pinWidget, widgetStatus, widgetPreview, shareCard, saveFile, scheduleAlert, deleteTrip, prune, addZoneHere, removeZone, auth, updateProfile, setSetting, settings, sync, saveTrip, retypeTrip, deleteHistory, exportData, startTracking, stopTracking, tracking, openLocationSettings, setDemo, isDemo, summarize, today, range, days, records, personality, route, status, subscribe, fmtMin, fmtDist, fmtSpeed, fmtNum, fmtHour, dayStart, weekStart, monthStart, DAY, HOUR, MIN };
// Test hook: feed simulated GPS fixes and activity results (used from the dev tools, not by screens).
Motio._feed = { location: onLocation, activity: onActivity, live: () => live };
window.Motio = Motio;
export default Motio;
