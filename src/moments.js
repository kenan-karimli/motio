// Full-screen moments (Motio 5.0 board 10): goal done, new streak, new record, badge earned, back after a break and
// first trip. Each shows once, when it happens, over whatever is open. The first run only remembers what's already
// there, so people updating from 4.x don't get a pile of old badges.
const DAY = 86400000, MIN = 60000;
const VIA = { walk: 'on foot', run: 'running', bike: 'by bike', transit: 'by bus', drive: 'by car' };
const COLOR = { walk: '#2FB457', run: '#E5604F', bike: '#4F7BF0', transit: '#8E6BE0', drive: '#E7A82A' };
const ICON = { walk5: 'walk', steps10k: 'steps', streak7: 'flame', streak30: 'flame', goal10: 'target', all5: 'layers', transit10: 'bus', carfree: 'walk', ride20: 'bike', early: 'sun', night: 'moon', k100: 'trophy', k1000: 'trophy' };
export const BREAK_DAYS = 5;

const mins = (m) => { m = Math.round(m); return m < 60 ? m + ' minutes' : m % 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m / 60 + (m === 60 ? ' hour' : ' hours'); };

// Pure: what's new since `st`, given a snapshot of the app. Returns the next state and the moments to show, in order.
//   snap = { day, total, today: [{ id, mode, start, end, from, to }], lastBefore, goalMin, todayMin, streak, best, badges: [{ id, title, desc }] }
export function detect(st, snap) {
  const s = { ...(st || {}) }, out = [];
  if (!s.seeded) {
    return { st: { seeded: 1, first: snap.total > 0 ? 1 : 0, goalDay: snap.todayMin >= snap.goalMin ? snap.day : 0, backDay: snap.today.length ? snap.day : 0, badges: snap.badges.map((b) => b.id) }, out };
  }
  // First trip ever.
  if (!s.first && snap.total > 0) {
    s.first = 1;
    const t = snap.today[0];
    if (t) out.push({ kind: 'first', trip: t.id, color: COLOR[t.mode], route: t.from && t.to ? t.from + ' → ' + t.to : t.to ? 'To ' + t.to : 'Your first route', how: mins((t.end - t.start) / MIN) + ' ' + (VIA[t.mode] || 'on the move') });
  } else if (s.backDay !== snap.day && snap.today.length) {
    // Back after a break: the first trip of a day that comes after BREAK_DAYS or more without one.
    s.backDay = snap.day;
    const gap = snap.lastBefore ? Math.floor((snap.day - snap.lastBefore) / DAY) : 0;
    if (gap >= BREAK_DAYS) out.push({ kind: 'back', days: gap });
  }
  // The daily goal: a streak of three or more days shows as the streak, otherwise as goal done.
  if (snap.todayMin >= snap.goalMin && s.goalDay !== snap.day) {
    s.goalDay = snap.day;
    out.push(snap.streak >= 3 ? { kind: 'streak', days: snap.streak, longest: snap.streak >= snap.best } : { kind: 'goal', goal: mins(snap.goalMin) });
  }
  // Badges (the first-trip badge is the first-trip moment).
  const seen = new Set(s.badges || []);
  for (const b of snap.badges) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    if (b.id !== 'first') out.push({ kind: 'badge', title: b.title, desc: b.desc.charAt(0).toLowerCase() + b.desc.slice(1), icon: ICON[b.id] || 'badge' });
  }
  s.badges = [...seen];
  return { st: s, out };
}

// Wiring: watch the app, keep the state in localStorage, show one moment at a time while Motio is in front.
export function startMoments(M, ready) {
  const KEY = 'motio.moments';
  const queue = [];
  let showing = false, t = 0;
  const load = () => { try { return JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const save = (v) => { try { window.localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const show = () => {
    if (showing || !queue.length || document.hidden || !window.__motioGo || !M.auth.isSignedIn()) return;
    showing = true;
    window.__motioMoment = queue.shift();
    window.__motioGo('moment');
  };
  window.addEventListener('motio:moment-done', () => { showing = false; setTimeout(show, 1600); });
  document.addEventListener('visibilitychange', () => setTimeout(show, 800));
  const snapshot = () => {
    const day = M.dayStart(), now = Date.now(), tl = M.timeline(day);
    const name = (i, d) => { const x = tl[i + d]; return x && x.kind === 'stay' && x.name !== 'A stop' ? x.name : null; };
    const today = tl.map((x, i) => (x.kind === 'trip' && !x.live ? { id: x.id, mode: x.mode, start: x.start, end: Math.min(x.end, now), from: name(i, -1), to: name(i, 1) } : null)).filter(Boolean);
    const before = M.summarize(0, day).trips.filter((x) => !x.live), last = before[before.length - 1];
    const g = M.goals();
    return { day, total: M.status().trips, today, lastBefore: last ? M.dayStart(last.end) : 0, goalMin: g.goal, todayMin: g.todayMin, streak: g.streak, best: g.best,
      badges: M.achievements().filter((a) => a.got).map((a) => ({ id: a.id, title: a.title, desc: a.desc })) };
  };
  const check = () => {
    t = 0;
    // Sample days and signed-out phones never celebrate; a new account starts from a fresh state.
    if (!M.auth.isSignedIn() || M.isDemo()) return;
    const uid = (M.auth.user() || {}).id, cur = load();
    const st = cur && cur.uid === uid ? cur : { uid };
    let r;
    try { r = detect(st, snapshot()); } catch (e) { console.warn('moments', e); return; }
    save({ ...r.st, uid });
    queue.push(...r.out.slice(0, 3));
    show();
  };
  ready.then(() => setTimeout(() => {
    check();
    M.subscribe(() => { if (!t) t = setTimeout(check, 2500); });
  }, 4000));
  // New records come from motio.js (checkRecords), which already decides when one is really new.
  window.addEventListener('motio:records', (e) => {
    if (M.isDemo()) return;
    const r = (e.detail || [])[0];
    if (r) { queue.push({ kind: 'record', title: r.title, value: M.fmtRecord(r), trip: r.trip || null }); show(); }
  });
}
