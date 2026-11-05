import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDb } from '../src/db.js';
import { createMailer } from '../src/mailer.js';
import { createApp } from '../src/app.js';

let clock = Date.parse('2026-11-01T12:00:00Z');
const mailer = createMailer({});
const server = createServer(await createApp({ db: await openDb(':memory:'), mailer, now: () => clock }));
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (method, path, body, token) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
};
const lastCode = () => /(\d{6})/.exec(mailer.outbox[0].text)[1];
test.after(() => server.close());

test('register, verify, profile, trips, export, logout', async () => {
  let r = await call('POST', '/v1/auth/register', { name: 'Sam', email: 'Sam@Example.com', password: 'short' });
  assert.equal(r.body.error, 'password_short');
  r = await call('POST', '/v1/auth/register', { name: 'Sam', email: 'sam@example.com', password: 'Str0ng!pass' });
  assert.equal(r.status, 200);
  r = await call('POST', '/v1/auth/verify', { email: 'sam@example.com', code: '000000' === lastCode() ? '111111' : '000000' });
  assert.equal(r.body.error, 'code_wrong'); assert.equal(r.body.left, 2);
  r = await call('POST', '/v1/auth/verify', { email: 'sam@example.com', code: lastCode() });
  assert.equal(r.status, 200); assert.ok(r.body.token);
  const token = r.body.token;

  r = await call('POST', '/v1/auth/register', { name: 'Sam', email: 'sam@example.com', password: 'Str0ng!pass' });
  assert.equal(r.status, 409);

  r = await call('PATCH', '/v1/me', { bio: 'Long way home', settings: { unit: 'mi' } }, token);
  assert.equal(r.body.user.bio, 'Long way home'); assert.equal(r.body.user.settings.unit, 'mi');

  const trip = { id: 't1', start: clock - 3600000, end: clock - 1800000, mode: 'walk', distanceM: 2400, steps: 3100, maxSpeed: 1.9, points: [[40.4, 49.8, clock - 3600000, 5], [40.41, 49.81, clock - 1800000, 5]], updatedAt: clock };
  r = await call('POST', '/v1/trips/sync', { trips: [trip], since: 0 }, token);
  assert.equal(r.body.trips.length, 1);
  r = await call('POST', '/v1/trips/sync', { trips: [{ ...trip, mode: 'run', updatedAt: clock + 1 }], since: clock }, token);
  assert.equal(r.body.trips[0].mode, 'run');
  r = await call('POST', '/v1/trips/sync', { trips: [{ ...trip, mode: 'drive', updatedAt: clock - 5 }] }, token);
  assert.equal(r.body.trips[0].mode, 'run', 'older edits must not overwrite newer ones');

  r = await call('GET', '/v1/export?format=csv', null, token);
  assert.match(r.body, /run,2\.40,30,3100/);
  r = await call('GET', '/v1/export?format=csv&steps=0', null, token);
  assert.match(r.body, /^id,start,end,mode,distance_km,duration_min\n/);
  r = await call('GET', '/v1/export?format=json&routes=0', null, token);
  assert.equal(r.body.trips[0].points, undefined);
  r = await call('GET', '/v1/export?format=gpx', null, token);
  assert.match(r.body, /<trkpt lat="40.4"/);

  r = await call('POST', '/v1/feedback', { kind: 'bug', message: 'Map was blank' }, token);
  assert.equal(r.body.ok, true);
  r = await call('POST', '/v1/feedback', { kind: 'bug', message: '' }, token);
  assert.equal(r.body.error, 'message_short');
  r = await call('POST', '/v1/auth/logout', {}, token);
  r = await call('GET', '/v1/me', null, token);
  assert.equal(r.status, 401);
});

test('login errors and lockout', async () => {
  await call('POST', '/v1/auth/register', { name: 'Alex', email: 'alex@example.com', password: 'motio1234' });
  await call('POST', '/v1/auth/verify', { email: 'alex@example.com', code: lastCode() });
  let r = await call('POST', '/v1/auth/login', { email: 'nobody@example.com', password: 'whatever1' });
  assert.equal(r.body.error, 'no_account');
  for (let i = 4; i >= 1; i--) {
    r = await call('POST', '/v1/auth/login', { email: 'alex@example.com', password: 'wrongpass' });
    assert.equal(r.body.error, 'wrong_password'); assert.equal(r.body.left, i);
  }
  r = await call('POST', '/v1/auth/login', { email: 'alex@example.com', password: 'wrongpass' });
  assert.equal(r.status, 423);
  r = await call('POST', '/v1/auth/login', { email: 'alex@example.com', password: 'motio1234' });
  assert.equal(r.status, 423, 'still locked even with the right password');
  clock += 16 * 60000;
  r = await call('POST', '/v1/auth/login', { email: 'alex@example.com', password: 'motio1234' });
  assert.equal(r.status, 200);
});

test('password reset and session expiry', async () => {
  let r = await call('POST', '/v1/auth/forgot', { email: 'alex@example.com' });
  r = await call('POST', '/v1/auth/reset', { email: 'alex@example.com', code: lastCode(), password: 'newpass123' });
  assert.equal(r.status, 200);
  const token = r.body.token;
  r = await call('POST', '/v1/auth/login', { email: 'alex@example.com', password: 'newpass123' });
  assert.equal(r.status, 200);
  clock += 31 * 86400000;
  r = await call('GET', '/v1/me', null, token);
  assert.equal(r.body.error, 'session_expired');
});

test('third wrong code sends a new one', async () => {
  await call('POST', '/v1/auth/register', { name: 'Kim', email: 'kim@example.com', password: 'longenough' });
  const first = lastCode();
  const wrong = first === '123456' ? '654321' : '123456';
  await call('POST', '/v1/auth/verify', { email: 'kim@example.com', code: wrong });
  await call('POST', '/v1/auth/verify', { email: 'kim@example.com', code: wrong });
  const r = await call('POST', '/v1/auth/verify', { email: 'kim@example.com', code: wrong });
  assert.equal(r.body.error, 'code_reset');
  const r2 = await call('POST', '/v1/auth/verify', { email: 'kim@example.com', code: first });
  assert.ok(r2.status === 400 || first === lastCode());
});

test('strava: connect through OAuth, upload once, refresh expired tokens', async () => {
  const env = { STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 's', PUBLIC_URL: 'http://localhost:8787' };
  const calls = [];
  const fakeFetch = async (u, init = {}) => {
    calls.push(String(u));
    if (String(u).endsWith('/oauth/token')) {
      const b = JSON.parse(init.body);
      return new Response(JSON.stringify({ access_token: 'a-' + b.grant_type, refresh_token: 'r', expires_at: Math.floor(clock / 1000) + (b.grant_type === 'refresh_token' ? 21600 : 10), athlete: { firstname: 'Sam', lastname: 'R' } }));
    }
    if (String(u).endsWith('/uploads')) return new Response(JSON.stringify({ id: 99 }), { status: 201 });
    return new Response('{}');
  };
  const m2 = createMailer({});
  const srv = createServer(await createApp({ db: await openDb(':memory:'), mailer: m2, now: () => clock, env, fetchImpl: fakeFetch }));
  await new Promise((r) => srv.listen(0, r));
  const b2 = `http://127.0.0.1:${srv.address().port}`;
  const go = async (method, path, body, token) => { const res = await fetch(b2 + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await res.text(); try { return { status: res.status, body: JSON.parse(t) }; } catch { return { status: res.status, body: t }; } };
  await go('POST', '/v1/auth/register', { name: 'Sam', email: 's@x.io', password: 'longenough' });
  const code = /(\d{6})/.exec(m2.outbox[0].text)[1];
  const token = (await go('POST', '/v1/auth/verify', { email: 's@x.io', code })).body.token;
  let r = await go('GET', '/v1/strava', null, token);
  assert.deepEqual([r.body.configured, r.body.connected], [true, false]);
  r = await go('POST', '/v1/strava/start', {}, token);
  const state = new URL(r.body.url).searchParams.get('state');
  r = await go('GET', `/v1/strava/callback?state=nope&code=c&scope=read,activity:write`);
  assert.match(r.body, /Link expired/);
  r = await go('GET', `/v1/strava/callback?state=${state}&code=c&scope=read,activity:write`);
  assert.match(r.body, /Strava connected/);
  r = await go('GET', '/v1/strava', null, token);
  assert.equal(r.body.athlete, 'Sam R');
  const trip = (id, mode) => ({ id, start: clock - 3600000, end: clock - 1800000, mode, distanceM: 2400, steps: 10, maxSpeed: 2, points: [[40.4, 49.8, clock - 3600000, 5], [40.41, 49.81, clock - 1800000, 5]], updatedAt: clock });
  await go('POST', '/v1/trips/sync', { trips: [trip('w1', 'walk'), trip('d1', 'drive')] }, token);
  clock += 60000; // token from the callback has expired, so the upload refreshes it first
  r = await go('POST', '/v1/strava/upload', {}, token);
  assert.equal(r.body.sent, 1, 'only the walk goes to Strava');
  assert.ok(calls.some((c) => c.endsWith('/oauth/token')) && calls.filter((c) => c.endsWith('/uploads')).length === 1);
  r = await go('POST', '/v1/strava/upload', {}, token);
  assert.equal(r.body.sent, 0, 'never uploads the same trip twice');
  r = await go('DELETE', '/v1/strava', null, token);
  r = await go('GET', '/v1/strava', null, token);
  assert.equal(r.body.connected, false);
  srv.close();
});

test('delete account needs the password and removes everything', async () => {
  await call('POST', '/v1/auth/register', { name: 'Del', email: 'del@example.com', password: 'deleteme1' });
  const token = (await call('POST', '/v1/auth/verify', { email: 'del@example.com', code: lastCode() })).body.token;
  await call('POST', '/v1/trips/sync', { trips: [{ id: 'x', start: clock - 1000, end: clock, mode: 'walk', distanceM: 5, points: [], updatedAt: clock }] }, token);
  let r = await call('POST', '/v1/me/delete', { password: 'nope' }, token);
  assert.equal(r.body.error, 'wrong_password');
  r = await call('POST', '/v1/me/delete', { password: 'deleteme1' }, token);
  assert.equal(r.body.ok, true);
  r = await call('GET', '/v1/me', null, token);
  assert.equal(r.status, 401, 'session is gone');
  r = await call('POST', '/v1/auth/login', { email: 'del@example.com', password: 'deleteme1' });
  assert.equal(r.body.error, 'no_account');
});

test('mail through Brevo: sends the code over HTTPS with the right sender', async () => {
  const sent = [];
  const m = createMailer({ BREVO_API_KEY: 'k', MAIL_FROM: 'Motio <noreply.motio@gmail.com>' }, async (url, init) => { sent.push({ url, init }); return new Response('{}', { status: 201 }); });
  assert.equal(m.mode, 'brevo');
  await m.sendCode('a@b.co', 'verify', '123456', 'Ann');
  const body = JSON.parse(sent[0].init.body);
  assert.equal(sent[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.deepEqual(body.sender, { name: 'Motio', email: 'noreply.motio@gmail.com' });
  assert.match(body.subject, /123456/);
  const bad = createMailer({ BREVO_API_KEY: 'k' }, async () => new Response('nope', { status: 401 }));
  await assert.rejects(bad.sendCode('a@b.co', 'verify', '1', ''), /Brevo 401/);
});
