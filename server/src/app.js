import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { stravaRoutes } from './strava.js';
import { legalRoutes } from './legal.js';

const DAY = 86400000;
const SESSION_TTL = 30 * DAY;
const CODE_TTL = 10 * 60000;
const LOCK_AFTER = 5;
const LOCK_FOR = 15 * 60000;
const MODES = new Set(['walk', 'run', 'bike', 'drive', 'transit']);

const sha = (s) => createHash('sha256').update(s).digest('hex');
const hashPw = (pw) => { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(pw, salt, 64).toString('hex'); };
const checkPw = (pw, stored) => {
  const [salt, hex] = stored.split(':');
  const a = Buffer.from(hex, 'hex'), b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
};
const validEmail = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const normEmail = (e) => String(e || '').trim().toLowerCase();

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra; }
}
const bad = (code, message, extra) => new HttpError(400, code, message, extra);

const UPSERT_TRIP = `INSERT INTO trips (user_id, id, start, "end", mode, distance_m, steps, max_speed, points, deleted, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, id) DO UPDATE SET start = excluded.start, "end" = excluded."end", mode = excluded.mode, distance_m = excluded.distance_m,
        steps = excluded.steps, max_speed = excluded.max_speed, points = excluded.points, deleted = excluded.deleted, updated_at = excluded.updated_at
      WHERE excluded.updated_at >= trips.updated_at`;

export async function createApp({ db, mailer, now = () => Date.now(), env = process.env, fetchImpl = fetch }) {
  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (email, name, pw_hash, created_at) VALUES (?, ?, ?, ?)'),
    replaceUnverified: db.prepare('UPDATE users SET name = ?, pw_hash = ? WHERE id = ? AND verified = 0'),
    setVerified: db.prepare('UPDATE users SET verified = 1 WHERE id = ?'),
    setFails: db.prepare('UPDATE users SET fails = ?, locked_until = ? WHERE id = ?'),
    setPw: db.prepare('UPDATE users SET pw_hash = ?, fails = 0, locked_until = 0 WHERE id = ?'),
    upsertCode: db.prepare('INSERT INTO codes (email, purpose, code_hash, expires, attempts) VALUES (?, ?, ?, ?, 0) ON CONFLICT(email, purpose) DO UPDATE SET code_hash = excluded.code_hash, expires = excluded.expires, attempts = 0'),
    getCode: db.prepare('SELECT * FROM codes WHERE email = ? AND purpose = ?'),
    bumpCode: db.prepare('UPDATE codes SET attempts = attempts + 1 WHERE email = ? AND purpose = ?'),
    delCode: db.prepare('DELETE FROM codes WHERE email = ? AND purpose = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires, created_at) VALUES (?, ?, ?, ?)'),
    getSession: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
    delSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    delUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    updateProfile: db.prepare('UPDATE users SET name = ?, bio = ?, avatar = ?, settings = ? WHERE id = ?'),
    upsertTrip: db.prepare(UPSERT_TRIP),
    tripsSince: db.prepare('SELECT * FROM trips WHERE user_id = ? AND updated_at > ? ORDER BY start'),
    tripsRange: db.prepare('SELECT * FROM trips WHERE user_id = ? AND deleted = 0 AND start >= ? AND start < ? ORDER BY start'),
    wipeTrips: db.prepare('DELETE FROM trips WHERE user_id = ?'),
    delUser: db.prepare('DELETE FROM users WHERE id = ?')
  };

  const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, bio: u.bio, avatar: u.avatar, settings: JSON.parse(u.settings || '{}'), createdAt: u.created_at });

  async function issueCode(email, purpose, name) {
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    await q.upsertCode.run(email, purpose, sha(code), now() + CODE_TTL);
    try { await mailer.sendCode(email, purpose, code, name); }
    catch (e) { console.error('[mail] send failed:', e.message); throw new HttpError(502, 'mail_failed', 'We couldn’t send the email right now. Try again in a minute.'); }
    // Local testing without SMTP: hand the code back so the app can show it. Never in production.
    return mailer.mode === 'dev' && process.env.MOTIO_DEV === '1' ? { devCode: code } : {};
  }

  // Wrong codes count; on the third miss the code is replaced and a new one is sent.
  async function useCode(email, purpose, code, name) {
    const row = await q.getCode.get(email, purpose);
    if (!row) throw bad('code_missing', 'Ask for a new code.');
    if (row.expires < now()) { await q.delCode.run(email, purpose); throw bad('code_expired', 'That code has expired. We sent a new one.', await issueCode(email, purpose, name)); }
    if (row.code_hash !== sha(String(code || '').trim())) {
      await q.bumpCode.run(email, purpose);
      const left = 3 - (row.attempts + 1);
      if (left <= 0) { const dev = await issueCode(email, purpose, name); throw bad('code_reset', 'Too many wrong codes. We sent you a new one.', { left: 3, ...dev }); }
      throw bad('code_wrong', 'That code doesn’t match.', { left });
    }
    await q.delCode.run(email, purpose);
  }

  async function startSession(userId) {
    const token = randomBytes(32).toString('base64url');
    await q.insertSession.run(sha(token), userId, now() + SESSION_TTL, now());
    return token;
  }

  async function authUser(req) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) throw new HttpError(401, 'unauthorized', 'Please log in.');
    const s = await q.getSession.get(sha(m[1]));
    if (!s || s.expires < now()) { if (s) await q.delSession.run(s.token_hash); throw new HttpError(401, 'session_expired', 'Your session timed out. Please log in again.'); }
    const u = await q.userById.get(s.user_id);
    if (!u) throw new HttpError(401, 'unauthorized', 'Please log in.');
    return { user: u, tokenHash: s.token_hash };
  }

  const cleanTrip = (t) => {
    if (!t || typeof t.id !== 'string' || t.id.length > 64) throw bad('bad_trip', 'Trip needs an id.');
    const start = Number(t.start), end = Number(t.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw bad('bad_trip', 'Trip times are invalid.');
    if (!MODES.has(t.mode)) throw bad('bad_trip', 'Unknown movement type.');
    const points = Array.isArray(t.points) ? t.points.slice(0, 20000).map((p) => [+p[0], +p[1], +p[2], +(p[3] || 0)]).filter((p) => p.every(Number.isFinite)) : [];
    return { id: t.id, start, end, mode: t.mode, distance_m: Math.max(0, +t.distanceM || 0), steps: Math.max(0, Math.round(+t.steps || 0)),
      max_speed: Math.max(0, +t.maxSpeed || 0), points: JSON.stringify(points), deleted: t.deleted ? 1 : 0, updated_at: Number(t.updatedAt) || now() };
  };
  const tripOut = (r) => ({ id: r.id, start: r.start, end: r.end, mode: r.mode, distanceM: r.distance_m, steps: r.steps, maxSpeed: r.max_speed,
    points: JSON.parse(r.points), deleted: !!r.deleted, updatedAt: r.updated_at });

  const routes = {
    'GET /v1/health': async () => ({ ok: true, mail: mailer.mode, time: now() }),

    'POST /v1/auth/register': async ({ body }) => {
      const email = normEmail(body.email), name = String(body.name || '').trim().slice(0, 60), pw = String(body.password || '');
      if (!name) throw bad('name_required', 'Tell us your name.');
      if (!validEmail(email)) throw bad('email_invalid', 'Enter a valid email address.');
      if (pw.length < 8) throw bad('password_short', 'Password needs at least 8 characters.');
      const existing = await q.userByEmail.get(email);
      if (existing && existing.verified) throw new HttpError(409, 'email_taken', 'An account with this email already exists.');
      if (existing) await q.replaceUnverified.run(name, hashPw(pw), existing.id);
      else await q.insertUser.run(email, name, hashPw(pw), now());
      const dev = await issueCode(email, 'verify', name);
      return { sent: true, email, ...dev };
    },

    'POST /v1/auth/resend': async ({ body }) => {
      const email = normEmail(body.email), purpose = body.purpose === 'reset' ? 'reset' : 'verify';
      const u = await q.userByEmail.get(email);
      const dev = u && (purpose === 'reset' || !u.verified) ? await issueCode(email, purpose, u.name) : {};
      return { sent: true, ...dev };
    },

    'POST /v1/auth/verify': async ({ body }) => {
      const email = normEmail(body.email);
      const u = await q.userByEmail.get(email);
      if (!u) throw bad('code_missing', 'Ask for a new code.');
      await useCode(email, 'verify', body.code, u.name);
      await q.setVerified.run(u.id);
      return { token: await startSession(u.id), user: publicUser(await q.userById.get(u.id)) };
    },

    'POST /v1/auth/login': async ({ body }) => {
      const email = normEmail(body.email), pw = String(body.password || '');
      const u = await q.userByEmail.get(email);
      if (!u) throw new HttpError(404, 'no_account', 'No account with that email.');
      if (u.locked_until > now()) throw new HttpError(423, 'locked', 'Too many tries.', { retryAfter: Math.ceil((u.locked_until - now()) / 1000) });
      if (!checkPw(pw, u.pw_hash)) {
        const fails = u.fails + 1;
        if (fails >= LOCK_AFTER) { await q.setFails.run(0, now() + LOCK_FOR, u.id); throw new HttpError(423, 'locked', 'Too many tries.', { retryAfter: LOCK_FOR / 1000 }); }
        await q.setFails.run(fails, 0, u.id);
        throw new HttpError(401, 'wrong_password', 'That password isn’t right.', { left: LOCK_AFTER - fails });
      }
      await q.setFails.run(0, 0, u.id);
      if (!u.verified) { await issueCode(email, 'verify', u.name); throw new HttpError(403, 'not_verified', 'Confirm your email first. We sent you a new code.'); }
      return { token: await startSession(u.id), user: publicUser(u) };
    },

    'POST /v1/auth/forgot': async ({ body }) => {
      const email = normEmail(body.email);
      const u = await q.userByEmail.get(email);
      const dev = u ? await issueCode(email, 'reset', u.name) : {};
      return { sent: true, ...dev };
    },

    'POST /v1/auth/reset': async ({ body }) => {
      const email = normEmail(body.email), pw = String(body.password || '');
      const u = await q.userByEmail.get(email);
      if (!u) throw bad('code_missing', 'Ask for a new code.');
      if (pw.length < 8) throw bad('password_short', 'Password needs at least 8 characters.');
      await useCode(email, 'reset', body.code, u.name);
      await q.setPw.run(hashPw(pw), u.id);
      await q.delUserSessions.run(u.id);
      await q.setVerified.run(u.id);
      return { token: await startSession(u.id), user: publicUser(await q.userById.get(u.id)) };
    },

    'POST /v1/auth/logout': async ({ req }) => { const { tokenHash } = await authUser(req); await q.delSession.run(tokenHash); return { ok: true }; },

    'GET /v1/me': async ({ req }) => ({ user: publicUser((await authUser(req)).user) }),

    'PATCH /v1/me': async ({ req, body }) => {
      const { user } = await authUser(req);
      const name = body.name !== undefined ? String(body.name).trim().slice(0, 60) : user.name;
      if (!name) throw bad('name_required', 'Name can’t be empty.');
      const bio = body.bio !== undefined ? String(body.bio).slice(0, 160) : user.bio;
      const avatar = body.avatar !== undefined ? String(body.avatar) : user.avatar;
      if (avatar.length > 400000) throw bad('avatar_large', 'That photo is too large.');
      const settings = body.settings !== undefined ? JSON.stringify({ ...JSON.parse(user.settings || '{}'), ...body.settings }) : user.settings;
      if (body.settings !== undefined && (typeof body.settings !== 'object' || Array.isArray(body.settings) || settings.length > 20000)) throw bad('settings_invalid', 'Those settings don’t look right.');
      await q.updateProfile.run(name, bio, avatar, settings, user.id);
      return { user: publicUser(await q.userById.get(user.id)) };
    },

    // Deleting the account needs the password again, so a phone left unlocked can't wipe someone's history.
    'POST /v1/me/delete': async ({ req, body }) => {
      const { user } = await authUser(req);
      if (!checkPw(String(body.password || ''), user.pw_hash)) throw new HttpError(401, 'wrong_password', 'That password isn’t right.', { left: null });
      await db.tx(async (t) => {
        await t.prepare('DELETE FROM codes WHERE email = ?').run(user.email);
        await t.prepare('UPDATE feedback SET user_id = NULL WHERE user_id = ?').run(user.id);
        await t.prepare('DELETE FROM strava_uploads WHERE user_id = ?').run(user.id);
        await t.prepare('DELETE FROM users WHERE id = ?').run(user.id); // sessions, trips and Strava tokens go with it
      });
      return { ok: true };
    },

    'POST /v1/trips/sync': async ({ req, body }) => {
      const { user } = await authUser(req);
      const incoming = Array.isArray(body.trips) ? body.trips : [];
      if (incoming.length > 500) throw bad('too_many', 'Send at most 500 trips at a time.');
      const clean = incoming.map(cleanTrip);
      await db.tx(async (x) => {
        const up = x.prepare(UPSERT_TRIP);
        for (const t of clean) await up.run(user.id, t.id, t.start, t.end, t.mode, t.distance_m, t.steps, t.max_speed, t.points, t.deleted, t.updated_at);
      });
      const since = Number(body.since) || 0;
      return { trips: (await q.tripsSince.all(user.id, since)).map(tripOut), serverTime: now() };
    },

    // Help › Send feedback. Stored for the team; the inbox address (FEEDBACK_TO) gets a copy when mail is set up.
    'POST /v1/feedback': async ({ req, body }) => {
      const { user } = await authUser(req);
      const kind = ['idea', 'bug', 'love'].includes(body.kind) ? body.kind : 'idea';
      const message = String(body.message || '').trim().slice(0, 4000);
      if (message.length < 3) throw bad('message_short', 'Write a few words first.');
      await db.prepare('INSERT INTO feedback (user_id, kind, message, created_at) VALUES (?, ?, ?, ?)').run(user.id, kind, message, now());
      if (process.env.FEEDBACK_TO) mailer.sendText(process.env.FEEDBACK_TO, `Motio feedback (${kind}) from ${user.email}`, message).catch(() => {});
      return { ok: true };
    },

    'DELETE /v1/trips': async ({ req }) => { const { user } = await authUser(req); await q.wipeTrips.run(user.id); return { ok: true }; },

    'GET /v1/export': async ({ req, url }) => {
      const { user } = await authUser(req);
      const from = Number(url.searchParams.get('from')) || 0, to = Number(url.searchParams.get('to')) || 8.64e15;
      const fmt = url.searchParams.get('format') || 'json';
      const rows = (await q.tripsRange.all(user.id, from, to)).map(tripOut);
      // Optional parts, switched off with routes=0, steps=0 or types=0.
      const want = (k) => url.searchParams.get(k) !== '0';
      if (fmt === 'csv') {
        const cols = [['id', (t) => t.id], ['start', (t) => new Date(t.start).toISOString()], ['end', (t) => new Date(t.end).toISOString()],
          ...(want('types') ? [['mode', (t) => t.mode]] : []),
          ['distance_km', (t) => (t.distanceM / 1000).toFixed(2)], ['duration_min', (t) => Math.round((t.end - t.start) / 60000)],
          ...(want('steps') ? [['steps', (t) => t.steps], ['max_speed_kmh', (t) => (t.maxSpeed * 3.6).toFixed(1)]] : [])];
        const lines = [cols.map((c) => c[0]).join(',')];
        for (const t of rows) lines.push(cols.map((c) => c[1](t)).join(','));
        return { raw: lines.join('\n') + '\n', type: 'text/csv', name: 'motio-export.csv' };
      }
      if (fmt === 'gpx') {
        const label = (t) => (want('types') ? t.mode + ' ' : '') + new Date(t.start).toISOString();
        const seg = (t) => `<trk><name>${label(t)}</name>${want('types') ? `<type>${t.mode}</type>` : ''}<trkseg>${t.points.map((p) => `<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(p[2]).toISOString()}</time></trkpt>`).join('')}</trkseg></trk>`;
        return { raw: `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Motio" xmlns="http://www.topografix.com/GPX/1/1">${rows.map(seg).join('')}</gpx>\n`, type: 'application/gpx+xml', name: 'motio-export.gpx' };
      }
      for (const t of rows) {
        if (!want('routes')) delete t.points;
        if (!want('steps')) { delete t.steps; delete t.maxSpeed; }
        if (!want('types')) delete t.mode;
      }
      return { raw: JSON.stringify({ user: publicUser(user), trips: rows }, null, 1), type: 'application/json', name: 'motio-export.json' };
    },

    ...(await stravaRoutes({ db, now, env, fetchImpl, authUser, HttpError, bad, tripOut })),
    ...legalRoutes(env),

    'GET /dev/outbox': async () => {
      if (mailer.mode !== 'dev') throw new HttpError(404, 'not_found', 'Not found');
      const items = mailer.outbox.map((m) => `<div style="background:#fff;border-radius:16px;padding:16px;margin:12px 0"><b>${m.subject}</b><div style="color:#666;font-size:12px">${m.to} · ${m.at}</div><pre style="white-space:pre-wrap;font-family:inherit">${m.text.replace(/</g, '&lt;')}</pre></div>`).join('');
      return { raw: `<!doctype html><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="5"><body style="font-family:system-ui;background:#4B3FD8;padding:16px;margin:0"><h2 style="color:#fff">Motio dev outbox</h2>${items || '<p style="color:#fff">No emails yet.</p>'}</body>`, type: 'text/html' };
    }
  };

  // Simple per-IP limit on auth calls: 30 a minute.
  const hits = new Map();
  const limited = (ip, key) => {
    if (!key.includes('/auth/')) return false;
    const t = now(), w = hits.get(ip) || [];
    const recent = w.filter((x) => t - x < 60000);
    recent.push(t); hits.set(ip, recent);
    return recent.length > 30;
  };

  return async function handle(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const key = `${req.method} ${url.pathname}`;
    const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    try {
      const route = routes[key];
      if (!route) throw new HttpError(404, 'not_found', 'Not found');
      if (limited(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim(), key)) throw new HttpError(429, 'slow_down', 'Too many requests. Wait a minute.');
      let body = {};
      if (req.method === 'POST' || req.method === 'PATCH') {
        const chunks = []; let size = 0;
        for await (const c of req) { size += c.length; if (size > 8e6) throw new HttpError(413, 'too_large', 'Request too large.'); chunks.push(c); }
        try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch { throw bad('bad_json', 'Invalid JSON.'); }
      }
      const out = await route({ req, body, url });
      if (out && out.raw !== undefined) {
        const h = { 'Content-Type': out.type + '; charset=utf-8' };
        if (out.name) h['Content-Disposition'] = `attachment; filename="${out.name}"`;
        res.writeHead(200, h); res.end(out.raw); return;
      }
      send(200, out);
    } catch (e) {
      if (e instanceof HttpError) send(e.status, { error: e.code, message: e.message, ...e.extra });
      else { console.error(e); send(500, { error: 'server_error', message: 'Something went wrong on our side.' }); }
    }
  };
}
