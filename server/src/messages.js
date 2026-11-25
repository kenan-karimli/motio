// Messages: one-to-one chats between friends. Text, or one of your own trips shared into the thread.
// Each person keeps their own view of a chat (pinned, muted, cleared, deleted, read up to), and the other side's
// view gives the ticks: ✓ sent, ✓✓ delivered (their phone fetched it), ✓✓ seen (they opened the chat).
const MAX_TEXT = 1000;
const SEND_WINDOW = 60000, SEND_MAX = 30; // at most 30 messages a minute per person
const LIVE_FRESH = 10 * 60000;

export async function messageRoutes({ db, now, authUser, HttpError, bad }) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL DEFAULT '',
      trip TEXT,
      at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_pair ON messages (LEAST(from_id, to_id), GREATEST(from_id, to_id), id);
    CREATE INDEX IF NOT EXISTS messages_to ON messages (to_id, id);
    CREATE TABLE IF NOT EXISTS chat_state (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pinned INTEGER NOT NULL DEFAULT 0,
      muted_until BIGINT NOT NULL DEFAULT 0,
      cleared_id INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      read_id INTEGER NOT NULL DEFAULT 0,
      read_at BIGINT NOT NULL DEFAULT 0,
      delivered_id INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, friend_id)
    );
    CREATE TABLE IF NOT EXISTS blocks (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      at BIGINT NOT NULL,
      PRIMARY KEY (user_id, blocked_id)
    );
  `);
  const PAIR = '((m.from_id = ? AND m.to_id = ?) OR (m.from_id = ? AND m.to_id = ?))';
  const q = {
    isFriend: db.prepare('SELECT 1 AS ok FROM friends WHERE user_id = ? AND friend_id = ?'),
    user: db.prepare('SELECT id, name, avatar FROM users WHERE id = ?'),
    ensure: db.prepare('INSERT INTO chat_state (user_id, friend_id) VALUES (?, ?) ON CONFLICT DO NOTHING'),
    state: db.prepare('SELECT * FROM chat_state WHERE user_id = ? AND friend_id = ?'),
    list: db.prepare(`SELECT u.id, u.name, u.avatar, COALESCE(s.pinned, 0) AS pinned, COALESCE(s.muted_until, 0) AS muted_until,
        COALESCE(s.cleared_id, 0) AS cleared_id, COALESCE(s.hidden, 0) AS hidden,
        COALESCE(o.read_id, 0) AS their_read, COALESCE(o.delivered_id, 0) AS their_delivered,
        m.id AS mid, m.from_id, m.text, m.trip, m.at,
        (SELECT COUNT(*)::int FROM messages x WHERE x.from_id = u.id AND x.to_id = f.user_id AND x.id > GREATEST(COALESCE(s.read_id, 0), COALESCE(s.cleared_id, 0))) AS unread
      FROM friends f JOIN users u ON u.id = f.friend_id
      LEFT JOIN chat_state s ON s.user_id = f.user_id AND s.friend_id = u.id
      LEFT JOIN chat_state o ON o.user_id = u.id AND o.friend_id = f.user_id
      LEFT JOIN LATERAL (SELECT * FROM messages x WHERE ((x.from_id = f.user_id AND x.to_id = u.id) OR (x.from_id = u.id AND x.to_id = f.user_id))
        AND x.id > COALESCE(s.cleared_id, 0) ORDER BY x.id DESC LIMIT 1) m ON true
      WHERE f.user_id = ?`),
    thread: db.prepare(`SELECT m.id, m.from_id, m.text, m.trip, m.at FROM messages m WHERE ${PAIR} AND m.id > ? ORDER BY m.id DESC LIMIT 300`),
    lastId: db.prepare(`SELECT COALESCE(MAX(m.id), 0) AS id FROM messages m WHERE ${PAIR}`),
    lastIn: db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM messages WHERE from_id = ? AND to_id = ?'),
    deliverAll: db.prepare(`INSERT INTO chat_state (user_id, friend_id, delivered_id) SELECT to_id, from_id, MAX(id) FROM messages WHERE to_id = ? GROUP BY to_id, from_id
      ON CONFLICT (user_id, friend_id) DO UPDATE SET delivered_id = GREATEST(chat_state.delivered_id, excluded.delivered_id)`),
    read: db.prepare('UPDATE chat_state SET read_id = GREATEST(read_id, ?), delivered_id = GREATEST(delivered_id, ?), read_at = CASE WHEN ? > read_id THEN ? ELSE read_at END WHERE user_id = ? AND friend_id = ?'),
    put: db.prepare('INSERT INTO messages (from_id, to_id, text, trip, at) VALUES (?, ?, ?, ?, ?) RETURNING id, from_id, text, trip, at'),
    unhide: db.prepare('UPDATE chat_state SET hidden = 0 WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'),
    pin: db.prepare('UPDATE chat_state SET pinned = ? WHERE user_id = ? AND friend_id = ?'),
    mute: db.prepare('UPDATE chat_state SET muted_until = ? WHERE user_id = ? AND friend_id = ?'),
    clear: db.prepare('UPDATE chat_state SET cleared_id = ?, hidden = ?, pinned = CASE WHEN ? = 1 THEN 0 ELSE pinned END WHERE user_id = ? AND friend_id = ?'),
    block: db.prepare('INSERT INTO blocks (user_id, blocked_id, at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'),
    blocked: db.prepare('SELECT 1 AS ok FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)'),
    unlink: db.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'),
    dropRequests: db.prepare('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)'),
    tripOf: db.prepare('SELECT id, start, "end", mode, distance_m, points FROM trips WHERE user_id = ? AND id = ? AND deleted = 0'),
    settingsOf: db.prepare('SELECT settings FROM users WHERE id = ?'),
    // Friends moving right now: only those sharing their live location with you, from a fresh position.
    moving: db.prepare(`SELECT l.user_id AS id, l.mode FROM live_fix l JOIN shares s ON s.owner = l.user_id AND s.viewer = ? AND s.kind = 'live' AND (s.until IS NULL OR s.until > ?)
      JOIN friends f ON f.user_id = ? AND f.friend_id = l.user_id WHERE l.at > ?`)
  };

  const small = (u) => ({ id: u.id, name: u.name, avatar: u.avatar && u.avatar.length < 200000 ? u.avatar : '' });
  const tick = (id, read, delivered) => (id <= read ? 'seen' : id <= delivered ? 'delivered' : 'sent');
  const msgOut = (m, me, st) => ({ id: m.id, mine: m.from_id === me, text: m.text, trip: m.trip ? JSON.parse(m.trip) : null, at: Number(m.at),
    ...(m.from_id === me ? { status: tick(m.id, st.read, st.delivered) } : {}) });
  const movingMap = async (me) => new Map((await q.moving.all(me, now(), me, now() - LIVE_FRESH)).map((r) => [r.id, r.mode || 'walk']));

  // The other person, who must be your friend (and not blocked either way).
  async function friendOf(me, raw) {
    const id = Number(raw);
    if (!Number.isInteger(id) || !(await q.isFriend.get(me, id))) throw new HttpError(403, 'not_friend', 'You can only message your friends.');
    await q.ensure.run(me, id);
    return id;
  }
  async function friendsOf(me, body) {
    const ids = [...new Set((Array.isArray(body.ids) ? body.ids : [body.id]).map(Number))].filter(Number.isInteger).slice(0, 50);
    const out = [];
    for (const id of ids) if (await q.isFriend.get(me, id)) { await q.ensure.run(me, id); out.push(id); }
    if (!out.length) throw new HttpError(403, 'not_friend', 'You can only message your friends.');
    return out;
  }
  const pair = (a, b) => [a, b, b, a];
  async function markRead(me, id) {
    const last = (await q.lastIn.get(id, me)).id;
    await q.read.run(last, last, last, now(), me, id);
  }

  // Private zones (home, work…) never leave the server, same as posts.
  const hav = (a, b, c, d) => { const R = 6371000, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  async function tripCard(me, tripId) {
    const t = await q.tripOf.get(me, String(tripId).slice(0, 64));
    if (!t) throw bad('no_trip', 'That trip hasn’t synced yet. Try again in a moment.');
    let zones = []; try { zones = JSON.parse((await q.settingsOf.get(me)).settings || '{}').zones || []; } catch { /* no zones */ }
    const pts = JSON.parse(t.points).filter((p) => !zones.some((z) => hav(p[0], p[1], z.lat, z.lng) < (z.r || 200)));
    const step = Math.max(1, Math.ceil(pts.length / 120));
    return { id: t.id, mode: t.mode, start: Number(t.start), end: Number(t.end), distanceM: t.distance_m, points: pts.filter((p, i) => i % step === 0).map((p) => [+(+p[0]).toFixed(5), +(+p[1]).toFixed(5)]) };
  }

  const sends = new Map();
  const tooFast = (me) => {
    const t = now(), w = (sends.get(me) || []).filter((x) => t - x < SEND_WINDOW);
    w.push(t); sends.set(me, w);
    return w.length > SEND_MAX;
  };

  return {
    // Your chats, newest first (pinned on top), with the last message, its ticks and how many you haven't read.
    // Fetching the list counts as delivery for everything sent to you.
    'GET /v1/chats': async ({ req }) => {
      const { user } = await authUser(req);
      await q.deliverAll.run(user.id);
      const moving = await movingMap(user.id), t = now();
      const rows = await q.list.all(user.id);
      const chats = rows.filter((r) => r.mid || (r.cleared_id > 0 && !r.hidden)).map((r) => ({
        friend: small(r), pinned: !!r.pinned, muted: Number(r.muted_until) > t, unread: r.unread, moving: moving.get(r.id) || null,
        last: r.mid ? msgOut({ id: r.mid, from_id: r.from_id, text: r.text, trip: r.trip, at: r.at }, user.id, { read: r.their_read, delivered: r.their_delivered }) : null
      })).sort((a, b) => b.pinned - a.pinned || ((b.last && b.last.at) || 0) - ((a.last && a.last.at) || 0));
      const people = new Map(rows.map((r) => [r.id, r]));
      return { chats, unread: chats.filter((c) => !c.muted).reduce((n, c) => n + c.unread, 0),
        moving: [...moving].filter(([id]) => people.has(id)).map(([id, mode]) => ({ ...small(people.get(id)), mode })) };
    },

    // One chat (the latest 300 messages, or only those after `after` while polling). Opening it marks it read.
    'GET /v1/chat': async ({ req, url }) => {
      const { user } = await authUser(req);
      const id = await friendOf(user.id, url.searchParams.get('id'));
      await markRead(user.id, id);
      const mine = await q.state.get(user.id, id), theirs = (await q.state.get(id, user.id)) || { read_id: 0, read_at: 0, delivered_id: 0 };
      const after = Math.max(Number(url.searchParams.get('after')) || 0, mine.cleared_id);
      const st = { read: theirs.read_id, delivered: theirs.delivered_id };
      const rows = (await q.thread.all(...pair(user.id, id), after)).reverse();
      return { friend: small(await q.user.get(id)), messages: rows.map((m) => msgOut(m, user.id, st)), pinned: !!mine.pinned, muted: Number(mine.muted_until) > now(),
        mutedUntil: Number(mine.muted_until) > now() ? Number(mine.muted_until) : null, theirRead: theirs.read_id, theirReadAt: Number(theirs.read_at) || null,
        theirDelivered: theirs.delivered_id, moving: (await movingMap(user.id)).get(id) || null };
    },

    'POST /v1/chat/send': async ({ req, body }) => {
      const { user } = await authUser(req);
      const id = await friendOf(user.id, body.id);
      if (await q.blocked.get(...pair(user.id, id))) throw new HttpError(403, 'blocked', 'You can’t message this person.');
      const text = String(body.text || '').trim();
      if (text.length > MAX_TEXT) throw bad('too_long', 'Messages can be up to ' + MAX_TEXT + ' characters.');
      const trip = body.tripId ? JSON.stringify(await tripCard(user.id, body.tripId)) : null;
      if (!text && !trip) throw bad('empty', 'Write something first.');
      if (tooFast(user.id)) throw new HttpError(429, 'slow_down', 'You’re sending a lot. Wait a minute.');
      await q.ensure.run(id, user.id);
      const m = await q.put.get(user.id, id, text, trip, now());
      await q.unhide.run(...pair(user.id, id));
      return { message: msgOut(m, user.id, { read: 0, delivered: 0 }) };
    },

    // From the list's select mode: Read, Pin, Mute and Delete work on several chats at once.
    'POST /v1/chats/read': async ({ req, body }) => {
      const { user } = await authUser(req);
      for (const id of await friendsOf(user.id, body)) await markRead(user.id, id);
      return { ok: true };
    },
    'POST /v1/chats/pin': async ({ req, body }) => {
      const { user } = await authUser(req);
      for (const id of await friendsOf(user.id, body)) await q.pin.run(body.on === false ? 0 : 1, user.id, id);
      return { ok: true };
    },
    // Mute for `hours` (default 8, up to a year); 0 unmutes.
    'POST /v1/chats/mute': async ({ req, body }) => {
      const { user } = await authUser(req);
      const h = body.hours === undefined ? 8 : Math.max(0, Math.min(Number(body.hours) || 0, 24 * 365));
      const until = h ? now() + h * 3600000 : 0;
      for (const id of await friendsOf(user.id, body)) await q.mute.run(until, user.id, id);
      return { ok: true, until: until || null };
    },
    // Clear empties the chat for you only; it stays in your list. Delete also takes it off the list until a new message.
    'POST /v1/chats/clear': async ({ req, body }) => {
      const { user } = await authUser(req);
      for (const id of await friendsOf(user.id, body)) { await q.clear.run(Math.max(1, (await q.lastId.get(...pair(user.id, id))).id), 0, 0, user.id, id); await markRead(user.id, id); }
      return { ok: true };
    },
    'POST /v1/chats/delete': async ({ req, body }) => {
      const { user } = await authUser(req);
      for (const id of await friendsOf(user.id, body)) { await q.clear.run(Math.max(1, (await q.lastId.get(...pair(user.id, id))).id), 1, 1, user.id, id); await markRead(user.id, id); }
      return { ok: true };
    },
    // Block: ends the friendship, deletes the chat on your side, and stops messages and friend requests both ways.
    'POST /v1/chats/block': async ({ req, body }) => {
      const { user } = await authUser(req);
      const id = await friendOf(user.id, body.id);
      await q.clear.run(Math.max(1, (await q.lastId.get(...pair(user.id, id))).id), 1, 1, user.id, id);
      await q.block.run(user.id, id, now());
      await q.unlink.run(...pair(user.id, id));
      await q.dropRequests.run(...pair(user.id, id));
      return { ok: true };
    }
  };
}
