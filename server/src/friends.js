// Friends: add each other with a short invite code, then compare weekly totals (active time, distance, trips).
// Only those totals are shared — never routes, places or single trips.
import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, so codes are easy to read out
const MAX_FRIENDS = 50;
const DAY = 86400000, WEEK = 7 * DAY;
const KINDS = { km: 'km', min: 'min', runs: 'runs' }; // challenge goals: distance, active minutes, number of runs

export async function friendRoutes({ db, now, authUser, HttpError, bad }) {
  await db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS invite TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS users_invite ON users(invite);
    CREATE TABLE IF NOT EXISTS friends (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, friend_id)
    );
    CREATE TABLE IF NOT EXISTS friend_requests (
      from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (from_id, to_id)
    );
    CREATE TABLE IF NOT EXISTS cheers (
      id SERIAL PRIMARY KEY,
      from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cheers_to ON cheers(to_id, at);
    CREATE TABLE IF NOT EXISTS challenges (
      id SERIAL PRIMARY KEY,
      creator INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      target DOUBLE PRECISION NOT NULL,
      start BIGINT NOT NULL,
      "end" BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS challenge_members (
      challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (challenge_id, user_id)
    );
    ALTER TABLE challenge_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'joined';
  `);
  const q = {
    setInvite: db.prepare('UPDATE users SET invite = ? WHERE id = ? AND invite IS NULL'),
    getInvite: db.prepare('SELECT invite FROM users WHERE id = ?'),
    byInvite: db.prepare('SELECT id, name FROM users WHERE invite = ? AND verified = 1'),
    list: db.prepare('SELECT u.id, u.name, u.avatar, u.settings FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY f.created_at'),
    incoming: db.prepare('SELECT u.id, u.name, u.avatar, r.created_at AS at FROM friend_requests r JOIN users u ON u.id = r.from_id WHERE r.to_id = ? ORDER BY r.created_at DESC'),
    outgoing: db.prepare('SELECT u.id, u.name, u.avatar, r.created_at AS at FROM friend_requests r JOIN users u ON u.id = r.to_id WHERE r.from_id = ? ORDER BY r.created_at DESC'),
    request: db.prepare('INSERT INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'),
    hasRequest: db.prepare('SELECT 1 AS ok FROM friend_requests WHERE from_id = ? AND to_id = ?'),
    dropRequests: db.prepare('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)'),
    search: db.prepare("SELECT id, name, avatar, settings FROM users WHERE verified = 1 AND name ILIKE ? ESCAPE '\\' AND id <> ? ORDER BY LENGTH(name), name LIMIT 20"),
    modesIn: db.prepare(`SELECT mode, SUM("end" - start)::float8 AS ms FROM trips WHERE user_id = ? AND deleted = 0 AND start >= ? AND start < ? GROUP BY mode`),
    allTime: db.prepare(`SELECT COALESCE(SUM(distance_m), 0)::float8 AS m, COUNT(*)::int AS n, COALESCE(MAX(distance_m), 0)::float8 AS best
      FROM trips WHERE user_id = ? AND deleted = 0 AND mode IN ('walk', 'run', 'bike')`),
    activeDays: db.prepare(`SELECT DISTINCT FLOOR((start - ?) / 86400000.0)::int AS d FROM trips
      WHERE user_id = ? AND deleted = 0 AND mode IN ('walk', 'run', 'bike') AND start >= ?`),
    together: db.prepare(`SELECT c.* FROM challenges c
      JOIN challenge_members a ON a.challenge_id = c.id AND a.user_id = ? AND a.status = 'joined'
      JOIN challenge_members b ON b.challenge_id = c.id AND b.user_id = ? AND b.status = 'joined'
      WHERE c."end" <= ? ORDER BY c."end" DESC LIMIT 20`),
    mutual: db.prepare(`SELECT u.id, u.name, u.avatar FROM friends a JOIN friends b ON b.friend_id = a.friend_id JOIN users u ON u.id = a.friend_id
      WHERE a.user_id = ? AND b.user_id = ? ORDER BY u.name LIMIT 50`),
    byId: db.prepare('SELECT id, name FROM users WHERE id = ? AND verified = 1'),
    userById: db.prepare('SELECT id, name, bio, avatar, settings, created_at FROM users WHERE id = ?'),
    since: db.prepare('SELECT created_at FROM friends WHERE user_id = ? AND friend_id = ?'),
    setStatus: db.prepare('UPDATE challenge_members SET status = ? WHERE challenge_id = ? AND user_id = ?'),

    count: db.prepare('SELECT COUNT(*)::int AS n FROM friends WHERE user_id = ?'),
    unlink: db.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'),
    totals: db.prepare(`SELECT user_id,
        SUM(CASE WHEN mode IN ('walk', 'run', 'bike') THEN "end" - start ELSE 0 END)::float8 AS active_ms,
        SUM(distance_m)::float8 AS m, COUNT(*)::int AS trips
      FROM trips WHERE deleted = 0 AND start >= ? AND start < ? AND user_id = ANY(?) GROUP BY user_id`),
    perDay: db.prepare(`SELECT user_id, FLOOR((start - ?) / 86400000.0)::int AS d,
        SUM(CASE WHEN mode IN ('walk', 'run', 'bike') THEN "end" - start ELSE 0 END)::float8 AS active_ms
      FROM trips WHERE deleted = 0 AND start >= ? AND start < ? AND user_id = ANY(?) GROUP BY user_id, d`),
    isFriend: db.prepare('SELECT 1 AS ok FROM friends WHERE user_id = ? AND friend_id = ?'),
    lastCheer: db.prepare('SELECT at FROM cheers WHERE from_id = ? AND to_id = ? ORDER BY at DESC LIMIT 1'),
    cheer: db.prepare('INSERT INTO cheers (from_id, to_id, at) VALUES (?, ?, ?)'),
    cheersFor: db.prepare('SELECT c.at, u.id, u.name FROM cheers c JOIN users u ON u.id = c.from_id WHERE c.to_id = ? AND c.at > ? ORDER BY c.at DESC LIMIT 20'),
    myChallenges: db.prepare(`SELECT c.* FROM challenges c JOIN challenge_members m ON m.challenge_id = c.id
      WHERE m.user_id = ? AND m.status <> 'declined' AND c."end" > ? ORDER BY c."end"`),
    members: db.prepare('SELECT u.id, u.name, m.status FROM challenge_members m JOIN users u ON u.id = m.user_id WHERE m.challenge_id = ? AND m.status <> \'declined\''),
    progress: db.prepare(`SELECT user_id,
        SUM(CASE WHEN mode IN ('walk', 'run', 'bike') THEN distance_m ELSE 0 END)::float8 AS m,
        SUM(CASE WHEN mode IN ('walk', 'run', 'bike') THEN "end" - start ELSE 0 END)::float8 AS active_ms,
        SUM(CASE WHEN mode = 'run' THEN 1 ELSE 0 END)::int AS runs
      FROM trips WHERE deleted = 0 AND start >= ? AND start < ? AND user_id = ANY(?) GROUP BY user_id`),
    activeCount: db.prepare(`SELECT COUNT(*)::int AS n FROM challenges c JOIN challenge_members m ON m.challenge_id = c.id WHERE m.user_id = ? AND c."end" > ?`),
    leave: db.prepare('DELETE FROM challenge_members WHERE challenge_id = ? AND user_id = ?')
  };

  // Each member's progress in a challenge, from walks, runs and rides inside its window (driving never counts).
  async function challengeOut(c, me) {
    const members = await q.members.all(c.id);
    const sums = new Map((await q.progress.all(c.start, c.end, members.filter((m) => m.status === 'joined').map((m) => m.id))).map((r) => [r.user_id, r]));
    const value = (s) => (c.kind === 'km' ? Math.round((s.m || 0) / 100) / 10 : c.kind === 'min' ? Math.round((s.active_ms || 0) / 60000) : s.runs || 0);
    const mine = members.find((m) => m.id === me);
    return { id: c.id, kind: c.kind, target: c.target, start: c.start, end: c.end, mine: c.creator === me, done: c.end <= now(), invited: !!mine && mine.status === 'invited',
      creator: (members.find((m) => m.id === c.creator) || {}).name || '',
      members: members.map((m) => ({ id: m.id, name: m.name, me: m.id === me, joined: m.status === 'joined', value: value(sums.get(m.id) || {}) })).sort((a, b) => b.joined - a.joined || b.value - a.value) };
  }

  async function link(a, b) {
    await db.tx(async (t) => {
      await t.prepare('INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(a, b, now());
      await t.prepare('INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(b, a, now());
      await t.prepare('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').run(a, b, b, a);
    });
  }

  async function relation(me, id) {
    if (me === id) return 'me';
    if (await q.isFriend.get(me, id)) return 'friend';
    if (await q.hasRequest.get(me, id)) return 'requested';
    if (await q.hasRequest.get(id, me)) return 'incoming';
    return 'none';
  }

  // One person's week, in the same shape as a row on the friends board.
  async function weekOf(id, url) {
    const t = now(), asked = Number(url.searchParams.get('from'));
    const from = Number.isFinite(asked) && asked > t - 8 * WEEK && asked <= t ? asked : t - WEEK;
    const s = (await q.totals.all(from, from + WEEK, [id]))[0] || {}, l = (await q.totals.all(from - WEEK, from, [id]))[0] || {};
    const days = [0, 0, 0, 0, 0, 0, 0];
    for (const r of await q.perDay.all(from, from, from + WEEK, [id])) if (r.d >= 0 && r.d < 7) days[r.d] = Math.round(r.active_ms / 60000);
    return { activeMin: Math.round((s.active_ms || 0) / 60000), km: Math.round((s.m || 0) / 100) / 10, trips: s.trips || 0, lastMin: Math.round((l.active_ms || 0) / 60000), days, activeDays: days.filter((m) => m > 0).length };
  }

  // The profile page's highlights: this week's time per mode, all-time totals, longest outing and the
  // active-day streak (days counted from the phone's own midnight, `from`).
  async function highlightsOf(id, url) {
    const t = now(), asked = Number(url.searchParams.get('from'));
    const from = Number.isFinite(asked) && asked > t - 8 * WEEK && asked <= t ? asked : t - WEEK;
    const modes = { walk: 0, run: 0, bike: 0, drive: 0, transit: 0 };
    for (const r of await q.modesIn.all(id, from, from + WEEK)) if (r.mode in modes) modes[r.mode] = Math.round(r.ms / 60000);
    const all = await q.allTime.get(id);
    const days = new Set((await q.activeDays.all(from, id, t - 400 * DAY)).map((r) => r.d));
    const today = Math.floor((t - from) / DAY);
    let streak = 0;
    for (let d = days.has(today) ? today : today - 1; days.has(d); d--) streak++;
    return { modes, allKm: Math.round(all.m / 100) / 10, allTrips: all.n, longestKm: Math.round(all.best / 100) / 10, streak };
  }

  async function inviteOf(id) {
    const row = await q.getInvite.get(id);
    if (row && row.invite) return row.invite;
    for (let tries = 0; tries < 5; tries++) {
      const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join('');
      try { await q.setInvite.run(code, id); } catch { continue; } // taken by someone else: draw again
      const again = await q.getInvite.get(id);
      if (again && again.invite) return again.invite;
    }
    throw new HttpError(500, 'invite_failed', 'Couldn’t make an invite code. Try again.');
  }

  return {
    // Your code, plus you and your friends with this week's totals. `from` is the start of the week on the phone.
    'GET /v1/friends': async ({ req, url }) => {
      const { user } = await authUser(req);
      const t = now(), asked = Number(url.searchParams.get('from'));
      const from = Number.isFinite(asked) && asked > t - 8 * WEEK && asked <= t ? asked : t - WEEK;
      const people = [{ id: user.id, name: user.name, avatar: user.avatar, me: true }, ...(await q.list.all(user.id))];
      const sums = new Map((await q.totals.all(from, from + WEEK, people.map((p) => p.id))).map((r) => [r.user_id, r]));
      const prev = new Map((await q.totals.all(from - WEEK, from, people.map((p) => p.id))).map((r) => [r.user_id, r]));
      const days = new Map(people.map((p) => [p.id, [0, 0, 0, 0, 0, 0, 0]]));
      for (const r of await q.perDay.all(from, from, from + WEEK, people.map((p) => p.id))) if (r.d >= 0 && r.d < 7) days.get(r.user_id)[r.d] = Math.round(r.active_ms / 60000);
      const out = people.map((p) => {
        const s = sums.get(p.id) || {}, l = prev.get(p.id) || {};
        // Someone who hid their activity shows up by name only.
        if (!p.me && JSON.parse(p.settings || '{}').hideActivity) return { id: p.id, name: p.name, me: false, hidden: true, avatar: p.avatar && p.avatar.length < 200000 ? p.avatar : '', activeMin: 0, km: 0, trips: 0, lastMin: 0, days: [0, 0, 0, 0, 0, 0, 0], activeDays: 0 };
        return { id: p.id, name: p.name, me: !!p.me, avatar: p.avatar && p.avatar.length < 200000 ? p.avatar : '',
          activeMin: Math.round((s.active_ms || 0) / 60000), km: Math.round((s.m || 0) / 100) / 10, trips: s.trips || 0, lastMin: Math.round((l.active_ms || 0) / 60000),
          days: days.get(p.id), activeDays: days.get(p.id).filter((m) => m > 0).length };
      });
      const small = (r) => ({ id: r.id, name: r.name, avatar: r.avatar && r.avatar.length < 200000 ? r.avatar : '', at: r.at });
      return { code: await inviteOf(user.id), from, people: out, incoming: (await q.incoming.all(user.id)).map(small), outgoing: (await q.outgoing.all(user.id)).map(small) };
    },

    'POST /v1/friends/add': async ({ req, body }) => {
      const { user } = await authUser(req);
      let other;
      // From a profile (found by search) or by invite code.
      if (body.id !== undefined) {
        other = Number.isInteger(Number(body.id)) && (await q.byId.get(Number(body.id)));
        if (!other) throw new HttpError(404, 'not_found', 'This person left Motio.');
      } else {
        const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (code.length !== 6) throw bad('code_invalid', 'Invite codes have 6 letters and numbers.');
        other = await q.byInvite.get(code);
        if (!other) throw new HttpError(404, 'code_unknown', 'No one has that code. Check it and try again.');
      }
      if (other.id === user.id) throw bad('code_self', body.id !== undefined ? 'That’s you.' : 'That’s your own code. Send it to a friend instead.');
      if (await q.isFriend.get(user.id, other.id)) return { friend: { id: other.id, name: other.name }, already: true };
      if ((await q.count.get(user.id)).n >= MAX_FRIENDS) throw bad('too_many', 'You can have up to ' + MAX_FRIENDS + ' friends.');
      // They already asked you: adding their code accepts it. Otherwise it's a request they accept or decline.
      if (await q.hasRequest.get(other.id, user.id)) { await link(user.id, other.id); return { friend: { id: other.id, name: other.name } }; }
      await q.request.run(user.id, other.id, now());
      return { requested: { id: other.id, name: other.name } };
    },

    'POST /v1/friends/respond': async ({ req, body }) => {
      const { user } = await authUser(req);
      const id = Number(body.id);
      if (!Number.isInteger(id) || !(await q.hasRequest.get(id, user.id))) throw bad('no_request', 'That request is gone.');
      if (body.accept) { await link(user.id, id); return { ok: true, accepted: true }; }
      await q.dropRequests.run(id, user.id, user.id, id);
      return { ok: true, accepted: false };
    },

    'POST /v1/friends/cancel': async ({ req, body }) => {
      const { user } = await authUser(req);
      await q.dropRequests.run(user.id, Number(body.id) || 0, user.id, Number(body.id) || 0);
      return { ok: true };
    },

    // A friend's profile: photo, name, bio and this week's totals (just name and photo if they keep activity private).
    'GET /v1/profile': async ({ req, url }) => {
      const { user } = await authUser(req);
      const id = Number(url.searchParams.get('id'));
      const u = Number.isInteger(id) && (await q.userById.get(id));
      if (!u) throw new HttpError(404, 'not_found', 'This person left Motio.');
      const rel = await relation(user.id, id);
      const cfg = JSON.parse(u.settings || '{}');
      const base = { id: u.id, name: u.name, avatar: u.avatar, joined: u.created_at, relation: rel, friends: (await q.count.get(id)).n };
      // Private profiles show only name and photo to people who aren't friends.
      if (rel !== 'me' && rel !== 'friend' && cfg.privateProfile) return { profile: { ...base, private: true } };
      const since = rel === 'friend' ? (await q.since.get(user.id, id)).created_at : null;
      const hidden = rel !== 'me' && !!cfg.hideActivity;
      const out = { ...base, bio: u.bio, friendsSince: since, hidden, week: hidden ? null : await weekOf(id, url), highlights: hidden ? null : await highlightsOf(id, url) };
      if (rel !== 'me') {
        const m = await q.mutual.all(user.id, id);
        out.mutual = { count: m.length, people: m.slice(0, 4).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar && p.avatar.length < 200000 ? p.avatar : '' })) };
      }
      // Head to head: finished challenges you both raced in, won by whoever got further.
      if (rel === 'friend') {
        let won = 0, lost = 0;
        for (const c of await q.together.all(user.id, id, now())) {
          const ms = (await challengeOut(c, user.id)).members, a = ms.find((x) => x.id === user.id), b = ms.find((x) => x.id === id);
          if (a && b && a.value > b.value) won++; else if (a && b && b.value > a.value) lost++;
        }
        out.duel = { won, lost };
      }
      return { profile: out };
    },

    // Find people by name. Private profiles are listed too (name and photo only), like other social apps.
    'GET /v1/people': async ({ req, url }) => {
      const { user } = await authUser(req);
      const text = String(url.searchParams.get('q') || '').trim().slice(0, 40);
      if (text.length < 2) return { people: [] };
      const rows = await q.search.all('%' + text.replace(/[\\%_]/g, (c) => '\\' + c) + '%', user.id);
      const out = [];
      for (const r of rows) out.push({ id: r.id, name: r.name, avatar: r.avatar && r.avatar.length < 200000 ? r.avatar : '', private: !!JSON.parse(r.settings || '{}').privateProfile, relation: await relation(user.id, r.id) });
      return { people: out };
    },

    // A cheer: a small "well done" to a friend; at most one per friend every 10 minutes.
    'POST /v1/friends/cheer': async ({ req, body }) => {
      const { user } = await authUser(req);
      const id = Number(body.id);
      if (!Number.isInteger(id) || !(await q.isFriend.get(user.id, id))) throw bad('not_friend', 'You can only cheer your friends.');
      const last = await q.lastCheer.get(user.id, id);
      if (!last || now() - last.at > 10 * 60000) await q.cheer.run(user.id, id, now());
      return { ok: true };
    },

    // Moments: cheers you got and challenges friends started with you, newest first.
    'GET /v1/moments': async ({ req }) => {
      const { user } = await authUser(req);
      const out = (await q.cheersFor.all(user.id, now() - 14 * DAY)).map((c) => ({ kind: 'cheer', at: c.at, who: { id: c.id, name: c.name } }));
      for (const r of await q.incoming.all(user.id)) out.push({ kind: 'request', at: r.at, who: { id: r.id, name: r.name } });
      for (const c of await q.myChallenges.all(user.id, now() - 3 * DAY)) {
        const ch = await challengeOut(c, user.id);
        const cr = await q.userById.get(c.creator);
        if (c.creator !== user.id && cr) out.push({ kind: 'challenge', at: c.created_at, who: { id: cr.id, name: cr.name }, challenge: ch });
        if (ch.done && ch.members[0] && ch.members[0].value > 0) out.push({ kind: 'won', at: c.end, who: { id: ch.members[0].id, name: ch.members[0].name }, challenge: ch });
      }
      return { moments: out.sort((a, b) => b.at - a.at).slice(0, 20) };
    },

    // Invite link: with Motio installed Android opens the app straight away (App Links); otherwise this page helps.
    'GET /i': async ({ url }) => {
      const code = url.pathname.slice(3).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      return { type: 'text/html', raw: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Join me on Motio</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#1F1D47;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}main{padding:32px 24px;max-width:360px}h1{font-size:28px;margin:0 0 8px}p{color:#C9C5EC;line-height:1.5}.code{font-size:34px;font-weight:700;letter-spacing:6px;background:#2D2A6E;border-radius:16px;padding:14px;margin:20px 0}a{display:block;margin:10px 0;padding:14px;border-radius:26px;background:#F6C343;color:#1F1D47;font-weight:700;text-decoration:none}</style>
<main><h1>Join me on Motio</h1><p>Compare weeks and start challenges together.</p><div class="code">${code}</div>
<a href="intent://add/${code}#Intent;scheme=motio;package=com.motio.app;end">Open in Motio</a>
<p>No app yet? Get Motio for Android, then open this link again (or enter the code in Social › Friends).</p>
<a href="https://github.com/kenan-karimli/motio/releases/latest/download/motio.apk" style="background:#FFFFFF">Download Motio for Android</a></main></html>` };
    },
    'GET /.well-known/assetlinks.json': async () => ({ type: 'application/json', raw: JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'com.motio.app', sha256_cert_fingerprints: ['3D:74:F5:0F:36:88:10:38:DE:13:6C:FD:B0:D4:A6:36:23:13:66:34:7E:03:4B:83:24:7A:99:3B:85:17:18:A7'] } }]) }),

    'GET /v1/challenges': async ({ req }) => {
      const { user } = await authUser(req);
      const list = await q.myChallenges.all(user.id, now() - 3 * DAY);
      return { challenges: await Promise.all(list.map((c) => challengeOut(c, user.id))) };
    },

    // Start a challenge with friends: a distance, active minutes or number of runs, over 1–14 days from now.
    'POST /v1/challenges': async ({ req, body }) => {
      const { user } = await authUser(req);
      const kind = KINDS[body.kind], target = Number(body.target), days = Math.round(Number(body.days) || 7);
      if (!kind) throw bad('bad_kind', 'Pick distance, minutes or runs.');
      if (!(target > 0 && target <= 10000)) throw bad('bad_target', 'Set a target above zero.');
      if (days < 1 || days > 14) throw bad('bad_days', 'Challenges last 1 to 14 days.');
      const ids = [...new Set((Array.isArray(body.friendIds) ? body.friendIds : []).map(Number))].filter(Number.isInteger).slice(0, 10);
      if (!ids.length) throw bad('no_friends', 'Pick at least one friend.');
      for (const id of ids) if (!(await q.isFriend.get(user.id, id))) throw bad('not_friend', 'You can only challenge your friends.');
      if ((await q.activeCount.get(user.id, now())).n >= 5) throw bad('too_many', 'You have 5 challenges running. Finish one first.');
      const t = now();
      const id = await db.tx(async (tx) => {
        const row = await tx.prepare('INSERT INTO challenges (creator, kind, target, start, "end", created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id').get(user.id, kind, target, t, t + days * DAY, t);
        await tx.prepare('INSERT INTO challenge_members (challenge_id, user_id, status) VALUES (?, ?, ?)').run(row.id, user.id, 'joined');
        for (const m of ids) await tx.prepare('INSERT INTO challenge_members (challenge_id, user_id, status) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(row.id, m, 'invited');
        return row.id;
      });
      const c = (await q.myChallenges.all(user.id, t)).find((x) => x.id === id);
      return { challenge: await challengeOut(c, user.id) };
    },

    // Accept or reject a challenge a friend sent you; only accepted members race.
    'POST /v1/challenges/respond': async ({ req, body }) => {
      const { user } = await authUser(req);
      await q.setStatus.run(body.accept ? 'joined' : 'declined', Number(body.id) || 0, user.id);
      return { ok: true };
    },

    'POST /v1/challenges/leave': async ({ req, body }) => {
      const { user } = await authUser(req);
      await q.leave.run(Number(body.id) || 0, user.id);
      return { ok: true };
    },

    'POST /v1/friends/remove': async ({ req, body }) => {
      const { user } = await authUser(req);
      const id = Number(body.id);
      if (!Number.isInteger(id)) throw bad('bad_id', 'Unknown friend.');
      await q.unlink.run(user.id, id, id, user.id);
      return { ok: true };
    }
  };
}
