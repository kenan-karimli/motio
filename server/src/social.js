// Social extras: the all-users weekly leaderboard, each user's daily step totals (the same numbers the app shows,
// e.g. from Samsung Health), and sharing with friends by permission: trip routes, a places summary and live location.
// Everything is off by default, granted per friend and per kind, and checked here, on the server.
const DAY = 86400000, WEEK = 7 * DAY;
const ACTIVE = "('walk', 'run', 'bike')";
const KINDS = new Set(['routes', 'places', 'live']);
const LIVE_FRESH = 10 * 60000; // a live position older than this is not shown

export async function socialRoutes({ db, now, authUser, HttpError, bad }) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS daily_steps (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      steps INTEGER NOT NULL,
      PRIMARY KEY (user_id, day)
    );
    CREATE TABLE IF NOT EXISTS shares (
      owner INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viewer INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      until BIGINT,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (owner, viewer, kind)
    );
    CREATE TABLE IF NOT EXISTS live_fix (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL, at BIGINT NOT NULL, mode TEXT
    );
  `);
  const q = {
    putSteps: db.prepare('INSERT INTO daily_steps (user_id, day, steps) VALUES (?, ?, ?) ON CONFLICT (user_id, day) DO UPDATE SET steps = excluded.steps'),
    publicUsers: db.prepare('SELECT id, name, avatar, settings FROM users WHERE verified = 1'),
    active: db.prepare(`SELECT user_id, SUM("end" - start)::float8 AS v FROM trips WHERE deleted = 0 AND mode IN ${ACTIVE} AND start >= ? AND start < ? GROUP BY user_id`),
    distance: db.prepare(`SELECT user_id, SUM(distance_m)::float8 AS v FROM trips WHERE deleted = 0 AND mode IN ${ACTIVE} AND start >= ? AND start < ? GROUP BY user_id`),
    steps: db.prepare('SELECT user_id, SUM(steps)::float8 AS v FROM daily_steps WHERE day >= ? AND day < ? GROUP BY user_id'),
    isFriend: db.prepare('SELECT 1 AS ok FROM friends WHERE user_id = ? AND friend_id = ?'),
    share: db.prepare('SELECT until FROM shares WHERE owner = ? AND viewer = ? AND kind = ?'),
    grant: db.prepare('INSERT INTO shares (owner, viewer, kind, until, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (owner, viewer, kind) DO UPDATE SET until = excluded.until'),
    revoke: db.prepare('DELETE FROM shares WHERE owner = ? AND viewer = ? AND kind = ?'),
    mine: db.prepare('SELECT s.viewer AS id, s.kind, s.until, u.name FROM shares s JOIN users u ON u.id = s.viewer WHERE s.owner = ?'),
    toMe: db.prepare('SELECT s.owner AS id, s.kind, s.until, u.name FROM shares s JOIN users u ON u.id = s.owner WHERE s.viewer = ?'),
    liveOn: db.prepare("SELECT 1 AS ok FROM shares WHERE owner = ? AND kind = 'live' AND (until IS NULL OR until > ?) LIMIT 1"),
    putFix: db.prepare('INSERT INTO live_fix (user_id, lat, lng, at, mode) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, at = excluded.at, mode = excluded.mode'),
    getFix: db.prepare('SELECT lat, lng, at, mode FROM live_fix WHERE user_id = ?'),
    dropFix: db.prepare('DELETE FROM live_fix WHERE user_id = ?'),
    trips: db.prepare('SELECT id, start, "end", mode, distance_m, points FROM trips WHERE user_id = ? AND deleted = 0 AND start >= ? AND start < ? ORDER BY start'),
    ends: db.prepare('SELECT points FROM trips WHERE user_id = ? AND deleted = 0 AND start >= ?'),
    settingsOf: db.prepare('SELECT settings FROM users WHERE id = ?')
  };
  const cfgOf = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
  const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
  const weekFrom = (url) => { const t = now(), a = Number(url.searchParams.get('from')); return Number.isFinite(a) && a > t - 8 * WEEK && a <= t ? a : t - WEEK; };
  // Points inside the owner's private zones (home, work…) never leave the server.
  const hav = (a, b, c, d) => { const R = 6371000, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const outside = (zones) => (p) => !zones.some((z) => hav(p[0], p[1], z.lat, z.lng) < (z.r || 200));
  async function allowed(owner, viewer, kind) {
    if (!(await q.isFriend.get(viewer, owner))) return false;
    const s = await q.share.get(owner, viewer, kind);
    return !!s && (s.until == null || Number(s.until) > now());
  }
  async function need(req, url, kind) {
    const { user } = await authUser(req);
    const id = Number(url.searchParams.get('id'));
    if (!Number.isInteger(id) || !(await allowed(id, user.id, kind))) throw new HttpError(403, 'not_shared', 'This friend isn’t sharing that with you.');
    return { user, id, zones: cfgOf((await q.settingsOf.get(id) || {}).settings).zones || [] };
  }

  return {
    // The app reports its daily step totals (the numbers it shows), so leaderboards match the app.
    'POST /v1/me/steps': async ({ req, body }) => {
      const { user } = await authUser(req);
      const days = Array.isArray(body.days) ? body.days.slice(0, 14) : [];
      for (const d of days) {
        if (!/^\d{4}-\d\d-\d\d$/.test(String(d.day))) continue;
        const steps = Math.round(Number(d.steps));
        if (Number.isFinite(steps) && steps >= 0 && steps < 200000) await q.putSteps.run(user.id, d.day, steps);
      }
      return { ok: true };
    },

    // Everyone with a public profile who shares their activity, ranked for one week.
    'GET /v1/leaderboard': async ({ req, url }) => {
      const { user } = await authUser(req);
      const metric = ['active', 'distance', 'steps'].includes(url.searchParams.get('metric')) ? url.searchParams.get('metric') : 'active';
      const from = weekFrom(url), to = from + WEEK;
      // Steps are stored per calendar day of the phone; the app says which day its week starts on.
      const d0 = /^\d{4}-\d\d-\d\d$/.test(url.searchParams.get('day') || '') ? url.searchParams.get('day') : dayKey(from);
      const rows = metric === 'steps' ? await q.steps.all(d0, dayKey(Date.parse(d0) + WEEK)) : await q[metric].all(from, to);
      const val = new Map(rows.map((r) => [r.user_id, r.v]));
      const shown = (await q.publicUsers.all()).filter((u) => { const c = cfgOf(u.settings); return !c.privateProfile && !c.hideActivity; });
      const fmt = (v) => (metric === 'active' ? Math.round(v / 60000) : metric === 'distance' ? Math.round(v / 100) / 10 : Math.round(v));
      const ranked = shown.map((u) => ({ id: u.id, name: u.name, avatar: u.avatar && u.avatar.length < 200000 ? u.avatar : '', value: fmt(val.get(u.id) || 0), me: u.id === user.id }))
        .filter((r) => r.value > 0 || r.me).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
        .map((r, i) => ({ ...r, rank: i + 1 }));
      const me = ranked.find((r) => r.me) || null;
      return { metric, from, unit: metric === 'active' ? 'min' : metric === 'distance' ? 'km' : 'steps', people: ranked.slice(0, 100), me, total: ranked.length,
        hiddenMe: !shown.some((u) => u.id === user.id) };
    },

    // Who you share with, and who shares with you.
    'GET /v1/sharing': async ({ req }) => {
      const { user } = await authUser(req);
      const live = (r) => r.kind !== 'live' || r.until == null || Number(r.until) > now();
      const pack = (rows) => {
        const by = {};
        for (const r of rows.filter(live)) (by[r.id] = by[r.id] || { id: r.id, name: r.name, kinds: {} }).kinds[r.kind] = r.until == null ? true : Number(r.until);
        return Object.values(by);
      };
      return { mine: pack(await q.mine.all(user.id)), toMe: pack(await q.toMe.all(user.id)) };
    },
    // Turn one kind of sharing with one friend on or off. Live location takes minutes (empty = until stopped).
    'POST /v1/sharing': async ({ req, body }) => {
      const { user } = await authUser(req);
      const id = Number(body.friendId), kind = String(body.kind || '');
      if (!KINDS.has(kind)) throw bad('bad_kind', 'Choose routes, places or live location.');
      if (!Number.isInteger(id) || !(await q.isFriend.get(user.id, id))) throw bad('not_friend', 'You can only share with friends.');
      if (!body.on) {
        await q.revoke.run(user.id, id, kind);
        if (kind === 'live' && !(await q.liveOn.get(user.id, now()))) await q.dropFix.run(user.id);
        return { ok: true, on: false };
      }
      const minutes = Number(body.minutes);
      const until = kind === 'live' && Number.isFinite(minutes) && minutes > 0 ? now() + Math.min(minutes, 24 * 60) * 60000 : null;
      await q.grant.run(user.id, id, kind, until, now());
      return { ok: true, on: true, until };
    },

    // The phone sends its position during trips while anyone may see it live; otherwise it is ignored.
    'POST /v1/live': async ({ req, body }) => {
      const { user } = await authUser(req);
      if (!(await q.liveOn.get(user.id, now()))) { await q.dropFix.run(user.id); return { ok: true, sharing: false }; }
      const lat = Number(body.lat), lng = Number(body.lng), at = Number(body.at) || now();
      if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw bad('bad_fix', 'Invalid position.');
      const zones = cfgOf((await q.settingsOf.get(user.id) || {}).settings).zones || [];
      if (!outside(zones)([lat, lng])) { await q.dropFix.run(user.id); return { ok: true, sharing: true, hidden: true } }
      await q.putFix.run(user.id, lat, lng, Math.min(at, now()), typeof body.mode === 'string' ? body.mode.slice(0, 12) : null);
      return { ok: true, sharing: true };
    },
    'GET /v1/friend/live': async ({ req, url }) => {
      const { id } = await need(req, url, 'live');
      const f = await q.getFix.get(id);
      if (!f || now() - Number(f.at) > LIVE_FRESH) return { live: null };
      return { live: { lat: f.lat, lng: f.lng, at: Number(f.at), mode: f.mode } };
    },
    // A friend's routes for a time range (at most two weeks), with their private zones cut out.
    'GET /v1/friend/routes': async ({ req, url }) => {
      const { id, zones } = await need(req, url, 'routes');
      const to = Math.min(Number(url.searchParams.get('to')) || now(), now()), from = Math.max(Number(url.searchParams.get('from')) || to - WEEK, to - 14 * DAY);
      const keep = outside(zones);
      return { trips: (await q.trips.all(id, from, to)).map((t) => ({ id: t.id, start: Number(t.start), end: Number(t.end), mode: t.mode, distanceM: t.distance_m,
        points: JSON.parse(t.points).filter(keep).map((p) => [p[0], p[1]]) })).filter((t) => t.points.length > 1) };
    },
    // Where a friend spends time: trip end points of the last 30 days, grouped to about 100 m, private zones left out.
    'GET /v1/friend/places': async ({ req, url }) => {
      const { id, zones } = await need(req, url, 'places');
      const names = cfgOf((await q.settingsOf.get(id) || {}).settings).placeNames || {};
      const keep = outside(zones), count = new Map();
      for (const r of await q.ends.all(id, now() - 30 * DAY)) {
        const pts = JSON.parse(r.points); const p = pts[pts.length - 1];
        if (!p || !keep(p)) continue;
        const k = p[0].toFixed(3) + ',' + p[1].toFixed(3);
        count.set(k, (count.get(k) || 0) + 1);
      }
      const places = [...count].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => { const [lat, lng] = k.split(',').map(Number); return { lat, lng, visits: n, name: names[k] || null }; });
      return { places, areas: count.size };
    }
  };
}
