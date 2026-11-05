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
  `);
  const q = {
    setInvite: db.prepare('UPDATE users SET invite = ? WHERE id = ? AND invite IS NULL'),
    getInvite: db.prepare('SELECT invite FROM users WHERE id = ?'),
    byInvite: db.prepare('SELECT id, name FROM users WHERE invite = ? AND verified = 1'),
    list: db.prepare('SELECT u.id, u.name, u.avatar FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY f.created_at'),
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
      WHERE m.user_id = ? AND c."end" > ? ORDER BY c."end"`),
    members: db.prepare('SELECT u.id, u.name FROM challenge_members m JOIN users u ON u.id = m.user_id WHERE m.challenge_id = ?'),
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
    const sums = new Map((await q.progress.all(c.start, c.end, members.map((m) => m.id))).map((r) => [r.user_id, r]));
    const value = (s) => (c.kind === 'km' ? Math.round((s.m || 0) / 100) / 10 : c.kind === 'min' ? Math.round((s.active_ms || 0) / 60000) : s.runs || 0);
    return { id: c.id, kind: c.kind, target: c.target, start: c.start, end: c.end, mine: c.creator === me, done: c.end <= now(),
      members: members.map((m) => ({ id: m.id, name: m.name, me: m.id === me, value: value(sums.get(m.id) || {}) })).sort((a, b) => b.value - a.value) };
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
        return { id: p.id, name: p.name, me: !!p.me, avatar: p.avatar && p.avatar.length < 200000 ? p.avatar : '',
          activeMin: Math.round((s.active_ms || 0) / 60000), km: Math.round((s.m || 0) / 100) / 10, trips: s.trips || 0, lastMin: Math.round((l.active_ms || 0) / 60000),
          days: days.get(p.id), activeDays: days.get(p.id).filter((m) => m > 0).length };
      });
      return { code: await inviteOf(user.id), from, people: out };
    },

    'POST /v1/friends/add': async ({ req, body }) => {
      const { user } = await authUser(req);
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 6) throw bad('code_invalid', 'Invite codes have 6 letters and numbers.');
      const other = await q.byInvite.get(code);
      if (!other) throw new HttpError(404, 'code_unknown', 'No one has that code. Check it and try again.');
      if (other.id === user.id) throw bad('code_self', 'That’s your own code. Send it to a friend instead.');
      if ((await q.count.get(user.id)).n >= MAX_FRIENDS) throw bad('too_many', 'You can have up to ' + MAX_FRIENDS + ' friends.');
      await db.tx(async (t) => {
        await t.prepare('INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(user.id, other.id, now());
        await t.prepare('INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(other.id, user.id, now());
      });
      return { friend: { id: other.id, name: other.name } };
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
      for (const c of await q.myChallenges.all(user.id, now() - 3 * DAY)) {
        const ch = await challengeOut(c, user.id);
        const creator = ch.members.find((m) => m.id === c.creator);
        if (c.creator !== user.id && creator) out.push({ kind: 'challenge', at: c.created_at, who: { id: creator.id, name: creator.name }, challenge: ch });
        if (ch.done && ch.members[0] && ch.members[0].value > 0) out.push({ kind: 'won', at: c.end, who: { id: ch.members[0].id, name: ch.members[0].name }, challenge: ch });
      }
      return { moments: out.sort((a, b) => b.at - a.at).slice(0, 20) };
    },

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
        for (const m of [user.id, ...ids]) await tx.prepare('INSERT INTO challenge_members (challenge_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(row.id, m);
        return row.id;
      });
      const c = (await q.myChallenges.all(user.id, t)).find((x) => x.id === id);
      return { challenge: await challengeOut(c, user.id) };
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
