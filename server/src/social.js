// Social extras: the all-users weekly leaderboard, each user's daily step totals (the same numbers the app shows,
// e.g. from Samsung Health), and sharing with friends by permission: trip routes, a places summary and live location.
// Everything is off by default, granted per friend and per kind, and checked here, on the server.
const DAY = 86400000, WEEK = 7 * DAY;
const ACTIVE = "('walk', 'run', 'bike')";
const KINDS = new Set(['routes', 'places', 'live']);
const LIVE_FRESH = 10 * 60000; // a live position older than this is not shown

export async function socialRoutes({ db, now, authUser, HttpError, bad, latest = async () => null }) {
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
    CREATE TABLE IF NOT EXISTS share_cards (
      code TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trip_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS posts_user ON posts(user_id, created_at);
    CREATE TABLE IF NOT EXISTS post_cheers (
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      at BIGINT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS post_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS monthly_joins (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      joined_at BIGINT NOT NULL,
      done_at BIGINT,
      PRIMARY KEY (user_id, key)
    );
    CREATE TABLE IF NOT EXISTS clubs (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      owner INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS club_members (
      club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at BIGINT NOT NULL,
      PRIMARY KEY (club_id, user_id)
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
    settingsOf: db.prepare('SELECT settings FROM users WHERE id = ?'),
    tripOf: db.prepare('SELECT id, start, "end", mode, distance_m, steps, max_speed, points FROM trips WHERE user_id = ? AND id = ? AND deleted = 0'),
    putPost: db.prepare('INSERT INTO posts (user_id, trip_id, payload, caption, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id'),
    postById: db.prepare('SELECT * FROM posts WHERE id = ?'),
    delPost: db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?'),
    feed: db.prepare('SELECT p.*, u.name, u.avatar FROM posts p JOIN users u ON u.id = p.user_id WHERE p.user_id = ? OR p.user_id IN (SELECT friend_id FROM friends WHERE user_id = ?) ORDER BY p.created_at DESC LIMIT 50'),
    cheersOf: db.prepare('SELECT c.user_id, u.name FROM post_cheers c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.at'),
    cheer: db.prepare('INSERT INTO post_cheers (post_id, user_id, at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'),
    uncheer: db.prepare('DELETE FROM post_cheers WHERE post_id = ? AND user_id = ?'),
    commentsOf: db.prepare('SELECT c.id, c.text, c.at, c.user_id, u.name FROM post_comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.at'),
    putComment: db.prepare('INSERT INTO post_comments (post_id, user_id, text, at) VALUES (?, ?, ?, ?)'),
    delComment: db.prepare('DELETE FROM post_comments WHERE id = ? AND (user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?))'),
    inPostCheers: db.prepare('SELECT c.post_id, c.at, u.id AS uid, u.name FROM post_cheers c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.user_id WHERE p.user_id = ? AND c.user_id <> ? AND c.at > ?'),
    inComments: db.prepare('SELECT c.id, c.post_id, c.text, c.at, u.id AS uid, u.name FROM post_comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.user_id WHERE p.user_id = ? AND c.user_id <> ? AND c.at > ?'),
    joinMonthly: db.prepare('INSERT INTO monthly_joins (user_id, key, joined_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'),
    leaveMonthly: db.prepare('DELETE FROM monthly_joins WHERE user_id = ? AND key = ? AND done_at IS NULL'),
    myMonthly: db.prepare('SELECT key, joined_at, done_at FROM monthly_joins WHERE user_id = ?'),
    doneMonthly: db.prepare('UPDATE monthly_joins SET done_at = ? WHERE user_id = ? AND key = ? AND done_at IS NULL'),
    joinedCount: db.prepare('SELECT key, COUNT(*)::int AS n FROM monthly_joins WHERE key LIKE ? GROUP BY key'),
    monthTrips: db.prepare('SELECT start, "end", mode, distance_m FROM trips WHERE user_id = ? AND deleted = 0 AND start >= ? AND start < ?'),
    monthSteps: db.prepare('SELECT COALESCE(SUM(steps), 0)::float8 AS n FROM daily_steps WHERE user_id = ? AND day >= ? AND day < ?'),
    monthSum: db.prepare('SELECT mode, SUM(distance_m)::float8 AS m, SUM("end" - start)::float8 AS ms FROM trips WHERE user_id = ? AND deleted = 0 AND start >= ? AND start < ? GROUP BY mode'),
    newClub: db.prepare('INSERT INTO clubs (name, code, owner, created_at) VALUES (?, ?, ?, ?) RETURNING id'),
    clubByCode: db.prepare('SELECT * FROM clubs WHERE code = ?'),
    clubById: db.prepare('SELECT * FROM clubs WHERE id = ?'),
    joinClub: db.prepare('INSERT INTO club_members (club_id, user_id, joined_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'),
    leaveClub: db.prepare('DELETE FROM club_members WHERE club_id = ? AND user_id = ?'),
    isMember: db.prepare('SELECT 1 AS ok FROM club_members WHERE club_id = ? AND user_id = ?'),
    myClubs: db.prepare('SELECT c.id, c.name, c.code, (SELECT COUNT(*)::int FROM club_members m2 WHERE m2.club_id = c.id) AS members FROM clubs c JOIN club_members m ON m.club_id = c.id WHERE m.user_id = ? ORDER BY m.joined_at'),
    clubPeople: db.prepare('SELECT u.id, u.name, u.avatar FROM club_members m JOIN users u ON u.id = m.user_id WHERE m.club_id = ?'),
    clubWeek: db.prepare(`SELECT t.user_id, SUM(t."end" - t.start)::float8 AS ms, SUM(t.distance_m)::float8 AS m FROM trips t JOIN club_members m ON m.user_id = t.user_id AND m.club_id = ? WHERE t.deleted = 0 AND t.mode IN ${ACTIVE} AND t.start >= ? AND t.start < ? GROUP BY t.user_id`),
    clubPosts: db.prepare('SELECT p.*, u.name, u.avatar FROM posts p JOIN users u ON u.id = p.user_id JOIN club_members m ON m.user_id = p.user_id AND m.club_id = ? ORDER BY p.created_at DESC LIMIT 20'),
    putCard: db.prepare('INSERT INTO share_cards (code, user_id, payload, created_at) VALUES (?, ?, ?, ?)'),
    getCard: db.prepare('SELECT c.code, c.payload, c.created_at, u.id AS uid, u.name, u.avatar FROM share_cards c JOIN users u ON u.id = c.user_id WHERE c.code = ?'),
    // The notification inbox: everything that happened to you lately, newest first.
    inCheers: db.prepare('SELECT c.id, c.at, u.id AS uid, u.name FROM cheers c JOIN users u ON u.id = c.from_id WHERE c.to_id = ? AND c.at > ? ORDER BY c.at DESC LIMIT 30'),
    inRequests: db.prepare('SELECT r.created_at AS at, u.id AS uid, u.name FROM friend_requests r JOIN users u ON u.id = r.from_id WHERE r.to_id = ? AND r.created_at > ?'),
    inFriends: db.prepare('SELECT f.created_at AS at, u.id AS uid, u.name FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND f.created_at > ?'),
    inChallenges: db.prepare('SELECT c.id, c.kind, c.target, c."end", c.created_at AS at, u.id AS uid, u.name FROM challenge_members m JOIN challenges c ON c.id = m.challenge_id JOIN users u ON u.id = c.creator WHERE m.user_id = ? AND c.creator <> ? AND c.created_at > ?'),
    inShares: db.prepare('SELECT s.kind, s.until, s.created_at AS at, u.id AS uid, u.name FROM shares s JOIN users u ON u.id = s.owner WHERE s.viewer = ? AND s.created_at > ?')
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

  // Shared images get a short link (/s/CODE): a page anyone can open, and the app opens it when installed.
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const str = (v, n) => String(v ?? '').slice(0, n);
  const codeOf = () => Array.from({ length: 8 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
  function cleanCard(b) {
    const routes = (Array.isArray(b.routes) ? b.routes : []).slice(0, 8).map((r) => ({ color: /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#F6C343',
      points: (Array.isArray(r.points) ? r.points : []).filter((p, i, a) => i % Math.max(1, Math.ceil(a.length / 120)) === 0).slice(0, 120).map((p) => [+(+p[0]).toFixed(5), +(+p[1]).toFixed(5)]).filter((p) => Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180) }))
      .filter((r) => r.points.length > 1);
    return { kind: str(b.kind, 20), title: str(b.title, 60), lead: str(b.lead, 60), big: str(b.big, 24), line: str(b.line, 140), period: str(b.period, 40),
      stats: (Array.isArray(b.stats) ? b.stats : []).slice(0, 4).map((s) => ({ v: str(s.v, 20), k: str(s.k, 24) })), routes };
  }
  // The routes as one SVG, the same way the app draws them.
  function routeSVG(routes, w, h) {
    const pts = routes.flatMap((r) => r.points);
    if (pts.length < 2) return '';
    const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length, k = Math.cos((lat0 * Math.PI) / 180);
    const xs = pts.map((p) => p[1] * k), ys = pts.map((p) => -p[0]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), pad = 16;
    const s = Math.min((w - pad * 2) / Math.max(1e-9, maxX - minX), (h - pad * 2) / Math.max(1e-9, maxY - minY));
    const ox = (w - (maxX - minX) * s) / 2, oy = (h - (maxY - minY) * s) / 2;
    const d = (r) => r.points.map((p, i) => (i ? 'L' : 'M') + ((p[1] * k - minX) * s + ox).toFixed(1) + ' ' + ((-p[0] - minY) * s + oy).toFixed(1)).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${routes.map((r) => `<path d="${d(r)}" fill="none" stroke="${r.color}" stroke-opacity=".3" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="${d(r)}" fill="none" stroke="${r.color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
  }

  // The feed: trips people chose to post, seen by their friends, with cheers and comments.
  const canSee = async (viewer, owner) => viewer === owner || !!(await q.isFriend.get(viewer, owner));
  async function postOut(p, me) {
    const cheers = await q.cheersOf.all(p.id), comments = await q.commentsOf.all(p.id);
    return { id: p.id, user: { id: p.user_id, name: p.name, avatar: p.avatar && p.avatar.length < 200000 ? p.avatar : '' }, mine: p.user_id === me, at: Number(p.created_at), caption: p.caption,
      trip: JSON.parse(p.payload), cheers: cheers.length, cheered: cheers.some((c) => c.user_id === me), cheerNames: cheers.slice(-3).map((c) => String(c.name).split(' ')[0]),
      comments: comments.map((c) => ({ id: c.id, text: c.text, at: Number(c.at), user: { id: c.user_id, name: c.name }, mine: c.user_id === me })) };
  }
  async function postFor(req, body) {
    const { user } = await authUser(req);
    const p = await q.postById.get(Number(body.id));
    if (!p || !(await canSee(user.id, p.user_id))) throw new HttpError(404, 'not_found', 'This post is gone.');
    return { user, p };
  }

  // Monthly challenges: the same three every month, open to everyone; finishing one earns that month's badge.
  // A pool of challenges; each month shows six: the two classics and four that rotate. `of` gets the month's
  // per-mode totals (s), the trips with their local day and hour (T), and the month's steps.
  const ACT = new Set(['walk', 'run', 'bike']);
  const MONTHLY = [
    { id: 'walk100', title: 'Walk 100 km', unit: 'km', target: 100, of: (s) => (s.walk.m + s.run.m) / 1000 },
    { id: 'active30', title: '30 hours on the move', unit: 'h', target: 30, of: (s) => (s.walk.ms + s.run.ms + s.bike.ms) / 3600000 },
    { id: 'ride200', title: 'Ride 200 km', unit: 'km', target: 200, of: (s) => s.bike.m / 1000 },
    { id: 'run50', title: 'Run 50 km', unit: 'km', target: 50, of: (s) => s.run.m / 1000 },
    { id: 'steps300', title: '300,000 steps', unit: 'k steps', target: 300, of: (s, T, steps) => steps / 1000 },
    { id: 'carfree10', title: '10 car-free days', unit: 'days', target: 10, of: (s, T) => { const d = new Map(); for (const t of T) { const x = d.get(t.day) || { act: 0, car: false }; if (ACT.has(t.mode)) x.act += t.ms; if (t.mode === 'drive') x.car = true; d.set(t.day, x); } return [...d.values()].filter((x) => !x.car && x.act >= 10 * 60000).length; } },
    { id: 'days20', title: 'Move on 20 days', unit: 'days', target: 20, of: (s, T) => { const d = new Map(); for (const t of T) if (ACT.has(t.mode)) d.set(t.day, (d.get(t.day) || 0) + t.ms); return [...d.values()].filter((ms) => ms >= 15 * 60000).length; } },
    { id: 'early8', title: '8 early starts', unit: 'mornings', target: 8, of: (s, T) => new Set(T.filter((t) => ACT.has(t.mode) && t.hour < 8 && t.ms >= 10 * 60000).map((t) => t.day)).size },
    { id: 'weekend25', title: 'Weekend walker: 25 km', unit: 'km', target: 25, of: (s, T) => T.filter((t) => (t.mode === 'walk' || t.mode === 'run') && t.weekend).reduce((a, t) => a + t.m, 0) / 1000 },
    { id: 'bus15', title: 'Take the bus 15 times', unit: 'trips', target: 15, of: (s, T) => T.filter((t) => t.mode === 'transit').length }
  ];
  const ROTATE = MONTHLY.slice(2);
  const thisMonth = (key) => { const n = +key.slice(0, 4) * 12 + +key.slice(5, 7); return [MONTHLY[0], MONTHLY[1], ...[0, 1, 2, 3].map((i) => ROTATE[(n + i * 2) % ROTATE.length])].filter((c, i, a) => a.indexOf(c) === i); };
  const monthOf = (t, tz) => { const d = new Date(t + tz * 60000); return { key: d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'), from: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - tz * 60000, to: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - tz * 60000 }; };
  async function progress(userId, from, to) {
    const s = { walk: { m: 0, ms: 0 }, run: { m: 0, ms: 0 }, bike: { m: 0, ms: 0 }, drive: { m: 0, ms: 0 }, transit: { m: 0, ms: 0 } };
    for (const r of await q.monthSum.all(userId, from, to)) if (s[r.mode]) s[r.mode] = { m: r.m || 0, ms: r.ms || 0 };
    return s;
  }

  return {
    // Clubs: a name and a join code; members see a weekly board and the trips members posted.
    'GET /v1/clubs': async ({ req }) => { const { user } = await authUser(req); return { clubs: await q.myClubs.all(user.id) }; },
    'POST /v1/clubs': async ({ req, body }) => {
      const { user } = await authUser(req);
      const name = String(body.name || '').trim().slice(0, 40);
      if (name.length < 2) throw bad('name_short', 'Give the club a name.');
      let code = '';
      for (let i = 0; i < 5 && !code; i++) { const c = codeOf().slice(0, 6).toUpperCase(); if (!(await q.clubByCode.get(c))) code = c; }
      const r = await q.newClub.get(name, code, user.id, now());
      await q.joinClub.run(r.id, user.id, now());
      return { id: r.id, name, code };
    },
    'POST /v1/clubs/join': async ({ req, body }) => {
      const { user } = await authUser(req);
      const c = await q.clubByCode.get(String(body.code || '').trim().toUpperCase());
      if (!c) throw bad('no_club', 'No club with that code.');
      await q.joinClub.run(c.id, user.id, now());
      return { id: c.id, name: c.name };
    },
    'POST /v1/clubs/leave': async ({ req, body }) => { const { user } = await authUser(req); await q.leaveClub.run(Number(body.id), user.id); return { ok: true }; },
    'GET /v1/club': async ({ req, url }) => {
      const { user } = await authUser(req);
      const id = Number(url.searchParams.get('id')), c = await q.clubById.get(id);
      if (!c || !(await q.isMember.get(id, user.id))) throw new HttpError(404, 'not_found', 'You’re not in this club.');
      const from = weekFrom(url), wk = new Map((await q.clubWeek.all(id, from, from + WEEK)).map((r) => [r.user_id, r]));
      const people = (await q.clubPeople.all(id)).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar && p.avatar.length < 200000 ? p.avatar : '', me: p.id === user.id,
        activeMin: Math.round(((wk.get(p.id) || {}).ms || 0) / 60000), km: Math.round(((wk.get(p.id) || {}).m || 0) / 100) / 10 })).sort((a, b) => b.activeMin - a.activeMin);
      return { id, name: c.name, code: c.code, owner: c.owner === user.id, people, posts: await Promise.all((await q.clubPosts.all(id)).map((p) => postOut(p, user.id))) };
    },

    // This month's challenges with your progress, and every badge you've earned. tz: the phone's UTC offset in minutes.
    'GET /v1/monthly': async ({ req, url }) => {
      const { user } = await authUser(req);
      const tz = Math.max(-840, Math.min(840, Number(url.searchParams.get('tz')) || 0)), M = monthOf(now(), tz);
      const mine = new Map((await q.myMonthly.all(user.id)).map((r) => [r.key, r]));
      const counts = new Map((await q.joinedCount.all(M.key + ':%')).map((r) => [r.key, r.n]));
      const s = await progress(user.id, M.from, M.to);
      const T = (await q.monthTrips.all(user.id, M.from, M.to)).map((t) => { const d = new Date(Number(t.start) + tz * 60000);
        return { mode: t.mode, ms: Number(t.end) - Number(t.start), m: t.distance_m || 0, day: d.toISOString().slice(0, 10), hour: d.getUTCHours(), weekend: [0, 6].includes(d.getUTCDay()) }; });
      const steps = (await q.monthSteps.get(user.id, M.key + '-01', M.key + '-32')).n || 0;
      const list = [];
      for (const c of thisMonth(M.key)) {
        const key = M.key + ':' + c.id, j = mine.get(key), have = Math.round(c.of(s, T, steps) * 10) / 10;
        if (j && !j.done_at && have >= c.target) { await q.doneMonthly.run(now(), user.id, key); j.done_at = now(); }
        list.push({ key, id: c.id, title: c.title, unit: c.unit, target: c.target, have, joined: !!j, done: !!(j && j.done_at), people: (counts.get(key) || 0), ends: M.to });
      }
      const badges = [...mine.values()].filter((r) => r.done_at).map((r) => ({ key: r.key, id: r.key.split(':')[1], month: r.key.split(':')[0], at: Number(r.done_at) })).sort((a, b) => b.at - a.at);
      return { month: M.key, challenges: list, badges };
    },
    'POST /v1/monthly/join': async ({ req, body }) => {
      const { user } = await authUser(req);
      const key = String(body.key || '');
      if (!/^\d{4}-\d\d:[a-z0-9]+$/.test(key) || !MONTHLY.some((c) => key.endsWith(':' + c.id))) throw bad('bad_key', 'Unknown challenge.');
      if (body.on === false) await q.leaveMonthly.run(user.id, key); else await q.joinMonthly.run(user.id, key, now());
      return { ok: true };
    },

    // Post one of your trips (from the server copy, so the numbers can't be made up), with private zones cut out.
    'POST /v1/posts': async ({ req, body }) => {
      const { user } = await authUser(req);
      const t = await q.tripOf.get(user.id, String(body.tripId || ''));
      if (!t) throw bad('no_trip', 'That trip hasn’t synced yet. Try again in a moment.');
      const zones = cfgOf((await q.settingsOf.get(user.id) || {}).settings).zones || [];
      const pts = JSON.parse(t.points).filter(outside(zones));
      const step = Math.max(1, Math.ceil(pts.length / 300));
      const trip = { mode: t.mode, start: Number(t.start), end: Number(t.end), distanceM: t.distance_m, steps: t.steps, maxSpeed: t.max_speed, points: pts.filter((p, i) => i % step === 0).map((p) => [p[0], p[1]]) };
      const r = await q.putPost.get(user.id, t.id, JSON.stringify(trip), String(body.caption || '').trim().slice(0, 280), now());
      return { ok: true, id: r.id };
    },
    'GET /v1/feed': async ({ req }) => {
      const { user } = await authUser(req);
      return { posts: await Promise.all((await q.feed.all(user.id, user.id)).map((p) => postOut(p, user.id))) };
    },
    'POST /v1/posts/cheer': async ({ req, body }) => {
      const { user, p } = await postFor(req, body);
      if (body.on === false) await q.uncheer.run(p.id, user.id); else await q.cheer.run(p.id, user.id, now());
      return { ok: true };
    },
    'POST /v1/posts/comment': async ({ req, body }) => {
      const { user, p } = await postFor(req, body);
      const text = String(body.text || '').trim().slice(0, 500);
      if (!text) throw bad('empty', 'Write something first.');
      await q.putComment.run(p.id, user.id, text, now());
      return { ok: true };
    },
    'POST /v1/posts/uncomment': async ({ req, body }) => {
      const { user } = await authUser(req);
      await q.delComment.run(Number(body.commentId), user.id, user.id);
      return { ok: true };
    },
    'POST /v1/posts/delete': async ({ req, body }) => {
      const { user } = await authUser(req);
      await q.delPost.run(Number(body.id), user.id);
      return { ok: true };
    },

    'POST /v1/shares': async ({ req, body }) => {
      const { user } = await authUser(req);
      const card = cleanCard(body || {}), payload = JSON.stringify(card);
      if (payload.length > 60000) throw bad('too_big', 'That card is too big to share as a link.');
      const code = codeOf();
      await q.putCard.run(code, user.id, payload, now());
      return { code, url: '/s/' + code };
    },
    // What the app needs when someone opens a link: who shared it.
    'GET /v1/shares': async ({ url }) => {
      const c = await q.getCard.get(String(url.searchParams.get('code') || '').toLowerCase());
      if (!c) throw new HttpError(404, 'not_found', 'This link has expired.');
      return { code: c.code, user: { id: c.uid, name: c.name }, card: JSON.parse(c.payload) };
    },
    'GET /s': async ({ url }) => {
      const code = url.pathname.slice(3).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
      const c = await q.getCard.get(code);
      if (!c) return { status: 404, type: 'text/html', raw: '<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;background:#1F1D47;color:#fff;display:grid;place-items:center;min-height:90vh;text-align:center"><div><h1>This link has expired</h1><p><a style="color:#F6C343" href="/">Get Motio</a></p></div>' };
      const d = JSON.parse(c.payload), first = String(c.name || 'A friend').split(' ')[0];
      const title = first + ' on Motio' + (d.period ? ': ' + d.period : ''), desc = [d.big && (d.lead ? d.lead + ' ' : '') + d.big, ...d.stats.map((s) => s.v + ' ' + s.k)].filter(Boolean).join(' · ');
      const ini = String(c.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      return { type: 'text/html', raw: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:site_name" content="Motio"><meta name="theme-color" content="#0C0B1C">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Poppins,system-ui,sans-serif;color:#fff;background:radial-gradient(80% 50% at 50% 30%,rgba(91,79,224,.35),transparent 70%),linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px) 0 0/26px 26px,linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px) 0 0/26px 26px,#0C0B1C;display:flex;justify-content:center}
main{width:100%;max-width:420px;padding:28px 22px 36px;display:flex;flex-direction:column;gap:18px;animation:in .7s cubic-bezier(.22,1,.36,1)}@keyframes in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.top{display:flex;align-items:center;justify-content:space-between}.logo{display:flex;align-items:center;gap:7px;font-weight:600;font-size:15px}
.who{display:flex;align-items:center;gap:12px}.av{width:46px;height:46px;border-radius:23px;background:#F6C343;color:#1F1D47;display:grid;place-items:center;font-weight:700;overflow:hidden}.av img{width:100%;height:100%;object-fit:cover}
.who b{display:block;font-size:16px}.who span{font-size:13px;color:rgba(255,255,255,.65)}
.map{height:260px;border-radius:24px;background:rgba(255,255,255,.05);padding:6px}
.k{font-size:13px;color:rgba(255,255,255,.65)}.big{font-size:72px;font-weight:700;letter-spacing:-3px;line-height:.95}
.line{font-size:14px;line-height:1.5;color:rgba(255,255,255,.75)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px}.stats div{padding:12px;border-radius:16px;background:rgba(255,255,255,.08)}.stats b{display:block;font-size:18px}.stats span{font-size:12px;color:rgba(255,255,255,.6)}
a.btn{display:flex;align-items:center;justify-content:center;height:54px;border-radius:27px;font-weight:600;text-decoration:none;font-size:15px}.p{background:#F6C343;color:#1F1D47}.s{background:rgba(255,255,255,.1);color:#fff}
small{font-size:12px;line-height:1.5;color:rgba(255,255,255,.5);text-align:center}
</style></head><body><main>
<div class="top"><span class="logo"><svg width="20" height="20" viewBox="0 0 30 30"><path d="M3 22c5 0 5-14 12-14s5 14 12 14" fill="none" stroke="#F6C343" stroke-width="4.5" stroke-linecap="round"/></svg>motio</span><span class="k">${esc(d.period)}</span></div>
<div class="who"><span class="av">${c.avatar && c.avatar.length < 200000 ? `<img src="${esc(c.avatar)}" alt="">` : esc(ini)}</span><div><b>${esc(c.name || 'A Motio user')}</b><span>shared ${esc(d.title ? d.title.replace(/\n/g, ' ').toLowerCase() : 'their moves')}</span></div></div>
${d.routes.length ? `<div class="map">${routeSVG(d.routes, 400, 248)}</div>` : ''}
${d.big ? `<div><div class="k">${esc(d.lead || 'Covered')}</div><div class="big">${esc(d.big)}</div></div>` : ''}
${d.line ? `<div class="line">${esc(d.line)}</div>` : ''}
${d.stats.length ? `<div class="stats">${d.stats.map((s) => `<div><b>${esc(s.v)}</b><span>${esc(s.k)}</span></div>`).join('')}</div>` : ''}
<a class="btn p" href="intent://s/${esc(c.code)}#Intent;scheme=motio;package=com.motio.app;S.browser_fallback_url=${encodeURIComponent('https://github.com/kenan-karimli/motio/releases/latest/download/motio.apk')};end">Open in Motio</a>
<a class="btn s" href="/">What is Motio?</a>
<small>Motio tracks how you move, automatically: walks, runs, rides and every trip in between.</small>
</main></body></html>` };
    },

    // Notifications: cheers, friend requests, new friends, challenges, friends sharing with you, a new app version.
    // Each item has its text ready, so the phone's background service can show it as is.
    'GET /v1/inbox': async ({ req }) => {
      const { user } = await authUser(req);
      const since = now() - 14 * DAY, first = (n) => String(n || 'A friend').split(' ')[0];
      const CH = { distance: 'distance', active: 'active time', runs: 'runs' };
      const SH = { routes: 'their routes', places: 'their usual places', live: 'their live location' };
      const items = [
        ...(await q.inCheers.all(user.id, since)).map((r) => ({ id: 'cheer-' + r.id, kind: 'cheer', at: Number(r.at), who: r.uid, title: first(r.name) + ' cheered you on', body: 'Keep moving!' })),
        ...(await q.inRequests.all(user.id, since)).map((r) => ({ id: 'request-' + r.uid + '-' + r.at, kind: 'request', at: Number(r.at), who: r.uid, title: r.name + ' wants to be friends', body: 'Accept to compare your weeks.' })),
        ...(await q.inFriends.all(user.id, since)).map((r) => ({ id: 'friend-' + r.uid, kind: 'friend', at: Number(r.at), who: r.uid, title: 'You and ' + first(r.name) + ' are now friends', body: 'Your weeks now line up side by side.' })),
        ...(await q.inChallenges.all(user.id, user.id, since)).map((r) => ({ id: 'challenge-' + r.id, kind: 'challenge', at: Number(r.at), who: r.uid, target: r.id, title: first(r.name) + ' challenged you', body: 'A ' + (CH[r.kind] || r.kind) + ' race until ' + new Date(Number(r.end)).toLocaleDateString('en-GB', { weekday: 'long' }) + '.' })),
        ...(await q.inShares.all(user.id, since)).filter((r) => r.kind !== 'live' || r.until == null || Number(r.until) > now())
          .map((r) => ({ id: 'share-' + r.uid + '-' + r.kind + '-' + r.at, kind: 'shared', at: Number(r.at), who: r.uid, title: first(r.name) + ' shared ' + (SH[r.kind] || r.kind) + ' with you', body: 'Open their map to see it.' }))
      ];
      for (const r of await q.inPostCheers.all(user.id, user.id, since)) items.push({ id: 'pcheer-' + r.post_id + '-' + r.uid, kind: 'cheer', at: Number(r.at), who: r.uid, post: r.post_id, title: first(r.name) + ' cheered your trip', body: 'On your post in the feed.' });
      for (const r of await q.inComments.all(user.id, user.id, since)) items.push({ id: 'comment-' + r.id, kind: 'comment', at: Number(r.at), who: r.uid, post: r.post_id, title: first(r.name) + ' commented on your trip', body: String(r.text).slice(0, 90) });
      const rel = await latest();
      if (rel && rel.version) items.push({ id: 'update-' + rel.version, kind: 'update', at: Date.parse(rel.date) || now(), version: rel.version, title: 'Motio ' + rel.version + ' is out', body: (rel.notes && rel.notes[0]) || 'Update to get the newest features.' });
      return { items: items.sort((a, b) => b.at - a.at).slice(0, 50), serverTime: now() };
    },

    // The app reports its daily step totals (the numbers it shows), so leaderboards match the app.
    'POST /v1/me/steps': async ({ req, body }) => {
      const { user } = await authUser(req);
      const days = Array.isArray(body.days) ? body.days.slice(0, 14) : [];
      for (const d of days) {
        if (!/^\d{4}-\d\d-\d\d$/.test(String(d.day))) continue;
        const steps = Math.round(Number(d.steps));
        if (Number.isFinite(steps) && steps >= 0 && steps <= 100000) await q.putSteps.run(user.id, d.day, steps);
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
