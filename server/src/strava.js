// Strava: connect an account with Strava's own login (OAuth), then upload walks, runs and rides as activities (GPX).
// Needs STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET from https://www.strava.com/settings/api, and PUBLIC_URL (this
// server's address as the phone sees it) whose host is set as the app's "Authorization Callback Domain" there.
import { randomBytes } from 'node:crypto';

const TYPES = { walk: 'walk', run: 'run', bike: 'ride' };

export async function stravaRoutes({ db, now, env, fetchImpl, authUser, HttpError, bad, tripOut }) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS strava (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      athlete TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, expires_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS strava_uploads (
      user_id INTEGER NOT NULL, trip_id TEXT NOT NULL, upload_id TEXT, at BIGINT NOT NULL, PRIMARY KEY (user_id, trip_id)
    );
  `);
  const q = {
    get: db.prepare('SELECT * FROM strava WHERE user_id = ?'),
    put: db.prepare('INSERT INTO strava (user_id, athlete, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET athlete = excluded.athlete, access_token = excluded.access_token, refresh_token = excluded.refresh_token, expires_at = excluded.expires_at'),
    del: db.prepare('DELETE FROM strava WHERE user_id = ?'),
    uploaded: db.prepare('SELECT trip_id FROM strava_uploads WHERE user_id = ?'),
    mark: db.prepare('INSERT INTO strava_uploads (user_id, trip_id, upload_id, at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, trip_id) DO UPDATE SET upload_id = excluded.upload_id, at = excluded.at'),
    trips: db.prepare("SELECT * FROM trips WHERE user_id = ? AND deleted = 0 AND mode IN ('walk', 'run', 'bike') AND start >= ? ORDER BY start")
  };
  const states = new Map(); // one-time OAuth state → user id, 10 minutes
  const configured = () => !!(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET);
  const base = () => (env.PUBLIC_URL || 'http://localhost:' + (env.PORT || 8787)).replace(/\/$/, '');

  async function token(form) {
    const res = await fetchImpl('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...form }) });
    if (!res.ok) throw new HttpError(502, 'strava_error', 'Strava didn’t accept the request. Try connecting again.');
    return res.json();
  }
  // A valid access token for the user, refreshed when it's about to expire.
  async function access(userId) {
    const row = await q.get.get(userId);
    if (!row) throw new HttpError(409, 'strava_not_connected', 'Connect Strava first.');
    if (row.expires_at * 1000 > now() + 60000) return row.access_token;
    const t = await token({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
    await q.put.run(userId, row.athlete, t.access_token, t.refresh_token, t.expires_at);
    return t.access_token;
  }
  const gpx = (t) => `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Motio" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Motio ${TYPES[t.mode]}</name><trkseg>${t.points.map((p) => `<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(p[2]).toISOString()}</time></trkpt>`).join('')}</trkseg></trk></gpx>\n`;
  const page = (title, text) => ({ raw: `<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;background:#4B3FD8;color:#fff;padding:32px 24px;margin:0"><h2>${title}</h2><p style="opacity:.85;line-height:1.5">${text}</p></body>`, type: 'text/html' });

  return {
    'GET /v1/strava': async ({ req }) => {
      const { user } = await authUser(req);
      const row = await q.get.get(user.id);
      return { configured: configured(), connected: !!row, athlete: row ? row.athlete : null, uploaded: (await q.uploaded.all(user.id)).length };
    },
    'POST /v1/strava/start': async ({ req }) => {
      const { user } = await authUser(req);
      if (!configured()) throw new HttpError(503, 'strava_not_configured', 'Strava isn’t set up on this server yet.');
      const state = randomBytes(16).toString('hex');
      states.set(state, { userId: user.id, until: now() + 600000 });
      const u = new URL('https://www.strava.com/oauth/mobile/authorize');
      u.search = new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, redirect_uri: base() + '/v1/strava/callback', response_type: 'code', approval_prompt: 'auto', scope: 'activity:write,read', state }).toString();
      return { url: u.toString() };
    },
    'GET /v1/strava/callback': async ({ url }) => {
      const st = states.get(url.searchParams.get('state') || '');
      states.delete(url.searchParams.get('state') || '');
      if (!st || st.until < now()) return page('Link expired', 'Go back to Motio and tap Connect again.');
      if (url.searchParams.get('error') || !url.searchParams.get('code')) return page('Not connected', 'Strava wasn’t connected. You can try again from Motio any time.');
      if (!/activity:write/.test(url.searchParams.get('scope') || '')) return page('Uploads not allowed', 'Motio needs permission to upload activities. Connect again and keep that box ticked.');
      const t = await token({ code: url.searchParams.get('code'), grant_type: 'authorization_code' });
      const name = t.athlete ? [t.athlete.firstname, t.athlete.lastname].filter(Boolean).join(' ') : 'Strava athlete';
      await q.put.run(st.userId, name, t.access_token, t.refresh_token, t.expires_at);
      return page('Strava connected', 'You can close this and go back to Motio.');
    },
    // Uploads walks, runs and rides not sent yet (from `since`, default 30 days back), oldest first, at most 20 per call.
    'POST /v1/strava/upload': async ({ req, body }) => {
      const { user } = await authUser(req);
      const tokenNow = await access(user.id);
      const done = new Set((await q.uploaded.all(user.id)).map((r) => r.trip_id));
      const since = Number(body.since) || now() - 30 * 86400000;
      const todo = (await q.trips.all(user.id, since)).map(tripOut).filter((t) => !done.has(t.id) && t.points.length > 1).slice(0, 20);
      let sent = 0;
      for (const t of todo) {
        const form = new FormData();
        form.append('file', new Blob([gpx(t)], { type: 'application/gpx+xml' }), `motio-${t.id}.gpx`);
        form.append('data_type', 'gpx');
        form.append('activity_type', TYPES[t.mode]);
        form.append('external_id', 'motio-' + t.id);
        form.append('name', { walk: 'Walk', run: 'Run', bike: 'Ride' }[t.mode] + ' · Motio');
        const res = await fetchImpl('https://www.strava.com/api/v3/uploads', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenNow }, body: form });
        if (res.status === 401) { await q.del.run(user.id); throw new HttpError(409, 'strava_not_connected', 'Strava access was removed. Connect again.'); }
        if (!res.ok && res.status !== 409) continue; // 409 = Strava already has it
        const out = res.ok ? await res.json() : {};
        await q.mark.run(user.id, t.id, String(out.id || ''), now());
        sent++;
      }
      return { sent, left: Math.max(0, (await q.trips.all(user.id, since)).length - done.size - sent) };
    },
    'DELETE /v1/strava': async ({ req }) => {
      const { user } = await authUser(req);
      const row = await q.get.get(user.id);
      if (row) await fetchImpl('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: 'Bearer ' + row.access_token } }).catch(() => {});
      await q.del.run(user.id);
      return { ok: true };
    }
  };
}
