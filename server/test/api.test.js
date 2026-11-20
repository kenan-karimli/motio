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

test('friends: invite code, weekly board with totals only, remove', async () => {
  const join = async (name, email) => {
    await call('POST', '/v1/auth/register', { name, email, password: 'Str0ng!pass' });
    return (await call('POST', '/v1/auth/verify', { email, code: lastCode() })).body.token;
  };
  const a = await join('Ada', 'ada@example.com'), b = await join('Ben', 'ben@example.com');
  const week = clock - 2 * 86400000;
  let r = await call('GET', '/v1/friends?from=' + week, null, a);
  assert.equal(r.status, 200); assert.match(r.body.code, /^[A-Z2-9]{6}$/); assert.equal(r.body.people.length, 1);
  const codeA = r.body.code;
  assert.equal((await call('GET', '/v1/friends', null, a)).body.code, codeA, 'code stays the same');
  assert.equal((await call('POST', '/v1/friends/add', { code: codeA }, a)).body.error, 'code_self');
  assert.equal((await call('POST', '/v1/friends/add', { code: 'ZZZZZZ' }, b)).status, 404);
  r = await call('POST', '/v1/friends/add', { code: codeA.toLowerCase().slice(0, 3) + '-' + codeA.slice(3) }, b);
  assert.equal(r.body.requested.name, 'Ada');
  await call('POST', '/v1/friends/respond', { id: (await call('GET', '/v1/friends', null, a)).body.incoming[0].id, accept: true }, a);
  const run = { id: 'r1', start: clock - 3600000, end: clock - 1800000, mode: 'run', distanceM: 5000, points: [[40.4, 49.8, clock - 3600000]] };
  await call('POST', '/v1/trips/sync', { trips: [run, { ...run, id: 'd1', mode: 'drive', distanceM: 20000 }], since: 0 }, b);
  r = await call('GET', '/v1/friends?from=' + week, null, a);
  const ben = r.body.people.find((p) => p.name === 'Ben');
  assert.equal(ben.activeMin, 30); assert.equal(ben.km, 25); assert.equal(ben.trips, 2);
  assert.equal(JSON.stringify(r.body).includes('49.8'), false, 'no routes leak');
  await call('POST', '/v1/friends/remove', { id: ben.id }, a);
  assert.equal((await call('GET', '/v1/friends', null, b)).body.people.length, 1, 'removed for both');
});

test('friends: per-day board, cheers, challenges and moments', async () => {
  const join = async (name, email) => {
    await call('POST', '/v1/auth/register', { name, email, password: 'Str0ng!pass' });
    return (await call('POST', '/v1/auth/verify', { email, code: lastCode() })).body.token;
  };
  const a = await join('Cara', 'cara@example.com'), b = await join('Dan', 'dan@example.com');
  const codeA = (await call('GET', '/v1/friends', null, a)).body.code;
  await call('POST', '/v1/friends/add', { code: codeA }, b);
  await call('POST', '/v1/friends/respond', { id: (await call('GET', '/v1/friends', null, a)).body.incoming[0].id, accept: true }, a);
  const danId = (await call('GET', '/v1/friends', null, a)).body.people.find((p) => !p.me).id;
  const caraId = (await call('GET', '/v1/friends', null, b)).body.people.find((p) => !p.me).id;

  let r = await call('POST', '/v1/challenges', { kind: 'km', target: 20, days: 2, friendIds: [danId] }, a);
  assert.equal(r.status, 200); assert.equal(r.body.challenge.members.length, 2);
  assert.equal((await call('POST', '/v1/challenges', { kind: 'km', target: 20, days: 2, friendIds: [9999] }, a)).body.error, 'not_friend');
  assert.equal((await call('POST', '/v1/challenges', { kind: 'swim', target: 5, friendIds: [danId] }, a)).body.error, 'bad_kind');

  r = await call('GET', '/v1/challenges', null, b);
  assert.equal(r.body.challenges[0].invited, true, 'Dan has to accept first');
  await call('POST', '/v1/challenges/respond', { id: r.body.challenges[0].id, accept: true }, b);
  const run = { id: 'c1', start: clock + 60000, end: clock + 1860000, mode: 'run', distanceM: 6000, points: [] };
  await call('POST', '/v1/trips/sync', { trips: [run, { ...run, id: 'c2', mode: 'drive', distanceM: 30000 }], since: 0 }, b);
  r = await call('GET', '/v1/challenges', null, a);
  const dan = r.body.challenges[0].members[0];
  assert.equal(dan.name, 'Dan'); assert.equal(dan.value, 6, 'only the run counts, not the drive');

  r = await call('GET', '/v1/friends?from=' + (clock - 86400000), null, a);
  const danRow = r.body.people.find((p) => !p.me);
  assert.equal(danRow.days[1], 30); assert.equal(danRow.activeDays, 1);

  assert.equal((await call('POST', '/v1/friends/cheer', { id: 9999 }, b)).body.error, 'not_friend');
  await call('POST', '/v1/friends/cheer', { id: caraId }, b);
  await call('POST', '/v1/friends/cheer', { id: caraId }, b); // second within 10 min is ignored
  r = await call('GET', '/v1/moments', null, a);
  assert.equal(r.body.moments.filter((m) => m.kind === 'cheer').length, 1);
  r = await call('GET', '/v1/moments', null, b);
  assert.equal(r.body.moments[0].kind, 'challenge'); assert.equal(r.body.moments[0].who.name, 'Cara');
  // Rejecting removes you from the race.
  const second = (await call('POST', '/v1/challenges', { kind: 'runs', target: 3, days: 7, friendIds: [danId] }, a)).body.challenge.id;
  await call('POST', '/v1/challenges/respond', { id: second, accept: false }, b);
  assert.equal((await call('GET', '/v1/challenges', null, b)).body.challenges.some((c) => c.id === second), false);
  assert.equal((await call('GET', '/v1/challenges', null, a)).body.challenges.find((c) => c.id === second).members.length, 1);
});

test('friend requests need accepting; invite link page; public and private profiles', async () => {
  const join = async (name, email) => {
    await call('POST', '/v1/auth/register', { name, email, password: 'Str0ng!pass' });
    return (await call('POST', '/v1/auth/verify', { email, code: lastCode() })).body.token;
  };
  const a = await join('Eve', 'eve@example.com'), b = await join('Finn', 'finn@example.com');
  const codeA = (await call('GET', '/v1/friends', null, a)).body.code;
  let r = await call('POST', '/v1/friends/add', { code: codeA }, b);
  assert.equal(r.body.requested.name, 'Eve');
  r = await call('GET', '/v1/friends', null, a);
  assert.equal(r.body.people.length, 1, 'not friends until accepted');
  assert.equal(r.body.incoming[0].name, 'Finn');
  const finnId = r.body.incoming[0].id;
  r = await call('GET', '/v1/profile?id=' + finnId, null, a);
  assert.equal(r.body.profile.relation, 'incoming'); assert.ok(r.body.profile.week, 'public by default');
  await call('PATCH', '/v1/me', { settings: { privateProfile: true } }, b);
  r = await call('GET', '/v1/profile?id=' + finnId, null, a);
  assert.equal(r.body.profile.private, true); assert.equal(r.body.profile.week, undefined); assert.equal(r.body.profile.bio, undefined);
  r = await call('GET', '/v1/people?q=fin', null, a);
  assert.deepEqual(r.body.people.map((p) => [p.name, p.private, p.relation]), [['Finn', true, 'incoming']]);
  assert.equal((await call('GET', '/v1/people?q=%25', null, a)).body.people.length, 0, 'wildcards are literal');
  await call('POST', '/v1/friends/respond', { id: finnId, accept: true }, a);
  r = await call('GET', '/v1/friends', null, b);
  assert.equal(r.body.people.length, 2); assert.equal(r.body.outgoing.length, 0);
  r = await call('GET', '/v1/profile?id=' + finnId, null, a);
  assert.equal(r.body.profile.name, 'Finn'); assert.equal(r.body.profile.relation, 'friend'); assert.ok(r.body.profile.week, 'friends see a private profile');
  await call('PATCH', '/v1/me', { settings: { hideActivity: true } }, b);
  r = await call('GET', '/v1/friends', null, a);
  assert.equal(r.body.people.find((p) => !p.me).hidden, true);
  const c = await join('Hana', 'hana@example.com');
  r = await call('POST', '/v1/friends/add', { id: finnId }, c);
  assert.equal(r.body.requested.name, 'Finn');
  const page = await fetch(base + '/i/' + codeA.toLowerCase());
  assert.equal(page.status, 200); const html = await page.text(); assert.match(html, new RegExp(codeA)); assert.match(html, /releases\/latest\/download\/motio\.apk/);
  assert.equal((await (await fetch(base + '/.well-known/assetlinks.json')).json())[0].target.package_name, 'com.motio.app');
});

test('change password while signed in', async () => {
  await call('POST', '/v1/auth/register', { name: 'Gus', email: 'gus@example.com', password: 'Str0ng!pass' });
  const t = (await call('POST', '/v1/auth/verify', { email: 'gus@example.com', code: lastCode() })).body.token;
  assert.equal((await call('POST', '/v1/me/password', { current: 'nope-nope', next: 'Newer!pass1' }, t)).body.error, 'wrong_password');
  assert.equal((await call('POST', '/v1/me/password', { current: 'Str0ng!pass', next: 'short' }, t)).body.error, 'password_short');
  assert.equal((await call('POST', '/v1/me/password', { current: 'Str0ng!pass', next: 'Newer!pass1' }, t)).body.ok, true);
  assert.equal((await call('POST', '/v1/auth/login', { email: 'gus@example.com', password: 'Newer!pass1' })).status, 200);
});

test('sign in with Google: checks the token, creates or reuses the account', async () => {
  const seen = [];
  const fake = async (url) => {
    seen.push(url);
    const tok = decodeURIComponent(url.split('id_token=')[1]);
    const ok = { aud: 'web-id', iss: 'https://accounts.google.com', exp: String(Math.floor(clock / 1000) + 600), email: 'gina@example.com', email_verified: 'true', name: 'Gina G' };
    const body = tok.startsWith('good') ? ok : tok.startsWith('other-aud') ? { ...ok, aud: 'someone-else' } : null;
    return { ok: !!body, json: async () => body };
  };
  const app = createServer(await createApp({ db: await openDb(':memory:'), mailer: createMailer({}), now: () => clock, env: { GOOGLE_CLIENT_ID: 'web-id' }, fetchImpl: fake }));
  await new Promise((r) => app.listen(0, r));
  const url = `http://127.0.0.1:${app.address().port}`;
  const post = async (body) => { const r = await fetch(url + '/v1/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  assert.equal((await (await fetch(url + '/v1/auth/google')).json()).clientId, 'web-id');
  let r = await post({ idToken: 'good-token-123456789012' });
  assert.equal(r.status, 200); assert.equal(r.body.created, true); assert.equal(r.body.user.name, 'Gina G'); assert.ok(r.body.token);
  r = await post({ idToken: 'good-token-123456789012' });
  assert.equal(r.body.created, false, 'same email signs in again');
  const del = await fetch(url + '/v1/me/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.body.token }, body: JSON.stringify({ idToken: 'good-token-123456789012' }) });
  assert.equal(del.status, 200, 'Google accounts delete with a Google confirmation');
  assert.equal((await post({ idToken: 'good-token-123456789012' })).body.created, true, 'gone, so a new account');
  assert.equal((await post({ idToken: 'other-aud-token-123456789' })).status, 401);
  assert.equal((await post({ idToken: 'bad-token-12345678901234' })).status, 401);
  app.close();
  r = await call('POST', '/v1/auth/google', { idToken: 'good-token-123456789012' });
  assert.equal(r.status, 501, 'off without GOOGLE_CLIENT_ID');
});

test('profile highlights: modes, all-time totals, streak, mutual friends, head to head', async () => {
  const join = async (name, email) => {
    await call('POST', '/v1/auth/register', { name, email, password: 'Str0ng!pass' });
    return (await call('POST', '/v1/auth/verify', { email, code: lastCode() })).body.token;
  };
  const a = await join('Ivy', 'ivy@example.com'), b = await join('Jon', 'jon@example.com'), c = await join('Kim', 'kim@example.com');
  const befriend = async (x, y) => {
    const code = (await call('GET', '/v1/friends', null, y)).body.code;
    const id = (await call('POST', '/v1/friends/add', { code }, x)).body.requested.id;
    const me = (await call('GET', '/v1/friends', null, y)).body.incoming[0].id;
    await call('POST', '/v1/friends/respond', { id: me, accept: true }, y);
    return id;
  };
  const jonId = await befriend(a, b); await befriend(a, c); await befriend(b, c);
  // Jon walks today and yesterday (a 2-day streak) and rides once, 10 km.
  const day = 86400000, from = clock - 2 * day;
  const t = (id, start, mode, m) => ({ id, start, end: start + 1800000, mode, distanceM: m, steps: 0, maxSpeed: 2, points: [], updatedAt: clock });
  await call('POST', '/v1/trips/sync', { trips: [t('j1', clock - 3600000, 'walk', 2000), t('j2', clock - day - 3600000, 'walk', 3000), t('j3', clock - 2 * 3600000, 'bike', 10000)] }, b);
  const p = (await call('GET', `/v1/profile?id=${jonId}&from=${from}`, null, a)).body.profile;
  assert.equal(p.highlights.allKm, 15); assert.equal(p.highlights.longestKm, 10); assert.equal(p.highlights.allTrips, 3);
  assert.equal(p.highlights.streak, 2); assert.equal(p.highlights.modes.walk, 60); assert.equal(p.highlights.modes.bike, 30);
  assert.equal(p.mutual.count, 1); assert.equal(p.mutual.people[0].name, 'Kim');
  assert.deepEqual(p.duel, { won: 0, lost: 0 });
});

test('announce: admin token only, counts first, emails each verified user once', async () => {
  const db = await openDb(':memory:'), mail = createMailer({});
  const app = createServer(await createApp({ db, mailer: mail, now: () => clock, env: { ADMIN_TOKEN: 'x'.repeat(32) } }));
  await new Promise((r) => app.listen(0, r));
  const url = `http://127.0.0.1:${app.address().port}`;
  const post = async (path, body, token) => { const r = await fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  for (const [n, e] of [['Ann Lee', 'ann@example.com'], ['Bo', 'bo@example.com']]) {
    await post('/v1/auth/register', { name: n, email: e, password: 'Str0ng!pass' });
    await post('/v1/auth/verify', { email: e, code: /(\d{6})/.exec(mail.outbox[0].text)[1] });
  }
  await post('/v1/auth/register', { name: 'Unverified', email: 'un@example.com', password: 'Str0ng!pass' });
  const msg = { key: 'v3.6', subject: 'Motio 3.6', text: 'Hi {name}, update here.' };
  assert.equal((await post('/v1/admin/announce', msg, 'y'.repeat(32))).status, 401);
  assert.equal((await post('/v1/admin/announce', msg)).status, 401);
  assert.equal((await post('/v1/admin/announce', msg, 'x'.repeat(32))).body.wouldSend, 2, 'counts verified users only, sends nothing');
  const before = mail.outbox.length;
  let r = await post('/v1/admin/announce', { ...msg, send: true }, 'x'.repeat(32));
  assert.deepEqual(r.body, { sent: 2, failed: 0, remaining: 0 });
  assert.equal(mail.outbox.length, before + 2);
  assert.ok(mail.outbox.some((m) => m.to === 'ann@example.com' && m.text === 'Hi Ann, update here.'));
  r = await post('/v1/admin/announce', { ...msg, send: true }, 'x'.repeat(32));
  assert.equal(r.body.sent, 0, 'nobody gets it twice');
  app.close();
  assert.equal((await call('POST', '/v1/admin/announce', msg)).status, 404, 'no route without ADMIN_TOKEN');
});

test('website: release line, counted downloads, images, waitlist, problem reports, admin stats', async () => {
  const fake = async (url, opt = {}) => (opt.method === 'HEAD'
    ? { ok: true, headers: new Headers({ 'content-length': '6291456' }) }
    : { ok: true, text: async () => '<feed><updated>2026-11-21T11:00:00Z</updated><entry><updated>2026-11-21T10:00:00Z</updated><link href="https://github.com/kenan-karimli/motio/releases/tag/v3.9"/><title>Motio 3.9</title><content type="html">&lt;ul&gt;&lt;li&gt;New What&amp;#39;s new screen&lt;/li&gt;&lt;li&gt;Faster &amp;lt;b&amp;gt;tabs&lt;/li&gt;&lt;/ul&gt;</content></entry></feed>' });
  const mailer = createMailer({});
  const app = createServer(await createApp({ db: await openDb(':memory:'), mailer, now: () => clock, env: { ADMIN_TOKEN: 'z'.repeat(32) }, fetchImpl: fake }));
  await new Promise((r) => app.listen(0, r));
  const url = `http://127.0.0.1:${app.address().port}`;
  const ua = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14)' };
  const home = await fetch(url + '/', { headers: ua });
  assert.match(home.headers.get('content-type'), /text\/html/);
  const html = await home.text();
  assert.match(html, /data-version="3.9" data-mb="6.0" data-date="2026-11-21"/);
  assert.match(html, /<li>New What's new screen<\/li>/, 'entities decoded once');
  assert.match(html, /<li>Faster &lt;b&gt;tabs<\/li>/, 'tags in notes stay text');
  const dl = await fetch(url + '/download', { headers: ua, redirect: 'manual' });
  assert.equal(dl.status, 302); assert.match(dl.headers.get('location'), /latest\/download\/motio\.apk$/);
  await fetch(url + '/download', { headers: { 'User-Agent': 'WhatsApp/2.23' }, redirect: 'manual' }); // link preview: not counted
  const img = await fetch(url + '/site/today.jpg');
  assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal((await fetch(url + '/site/..%2Fsite.js')).status, 404);
  const join = (email, name) => fetch(url + '/v1/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, platform: 'ios' }) });
  assert.equal((await join('nope', 'Ann')).status, 400);
  assert.equal((await (await join('ann@example.com', '  ')).json()).error, 'name_missing');
  assert.equal((await join('ann@example.com', 'A'.repeat(61))).status, 400);
  assert.equal((await join('Ann@Example.com', 'Ann')).status, 200);
  assert.equal((await (await join('ann@example.com', 'Ann')).json()).waiting, 1, 'same email once');
  assert.equal(mailer.outbox[0].to, 'noreply.motio@gmail.com');
  assert.match(mailer.outbox[0].text, /Ann <ann@example\.com>/);
  // Report a problem: validated, stored, emailed to the Motio inbox.
  const report = (b) => fetch(url + '/v1/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal((await (await report({ name: 'Bo', email: 'bo@example.com', message: 'short' })).json()).error, 'message_short');
  assert.equal((await (await report({ name: 'Bo', email: 'bo@', message: 'The map stays empty.' })).json()).error, 'email_invalid');
  assert.equal((await report({ name: 'Bo', email: 'bo@example.com', message: 'x'.repeat(2001) })).status, 400);
  const sent = mailer.outbox.length;
  assert.equal((await report({ name: 'Bo\r\nBcc: x', email: 'Bo@Example.com', message: 'The map stays empty after a walk.' })).status, 200);
  assert.equal(mailer.outbox.length, sent + 1);
  assert.equal(mailer.outbox[0].to, 'noreply.motio@gmail.com');
  assert.equal(mailer.outbox[0].subject, 'Motio problem report from Bo Bcc: x', 'no line breaks in the subject');
  assert.match(mailer.outbox[0].text, /bo@example\.com>\n\nThe map stays empty after a walk\./);
  assert.equal((await fetch(url + '/v1/admin/stats')).status, 401);
  const st = await (await fetch(url + '/v1/admin/stats', { headers: { Authorization: 'Bearer ' + 'z'.repeat(32) } })).json();
  assert.deepEqual(Object.values(st.days)[0], { view: 1, download: 1 });
  assert.deepEqual(st.waitlist, { ios: 1 }, 'same email once');
  assert.equal((await fetch(url + '/v1/admin/waitlist')).status, 401);
  const wl = await (await fetch(url + '/v1/admin/waitlist', { headers: { Authorization: 'Bearer ' + 'z'.repeat(32) } })).json();
  assert.deepEqual(wl.people.map((p) => [p.name, p.email]), [['Ann', 'ann@example.com']]);
  app.close();
});

test('trips keep their extra fields through sync; deleting all needs confirmation', async () => {
  await call('POST', '/v1/auth/register', { name: 'Wes', email: 'wes@example.com', password: 'Str0ng!pass' });
  const t = (await call('POST', '/v1/auth/verify', { email: 'wes@example.com', code: lastCode() })).body.token;
  const trip = { id: 'w1', start: clock - 3600000, end: clock - 1800000, mode: 'run', distanceM: 5000, steps: 0, maxSpeed: 4, points: [], updatedAt: clock,
    locked: true, workout: { pausedMs: 120000 }, stops: 2, f: { avg: 2.8 }, _local: 'not sent' };
  let r = await call('POST', '/v1/trips/sync', { trips: [trip], since: 0 }, t);
  const back = r.body.trips.find((x) => x.id === 'w1');
  assert.equal(back.locked, true); assert.deepEqual(back.workout, { pausedMs: 120000 }); assert.equal(back.stops, 2); assert.deepEqual(back.f, { avg: 2.8 });
  assert.equal(back._local, undefined, 'underscore fields stay on the phone');
  assert.equal((await call('DELETE', '/v1/trips', null, t)).status, 400, 'no confirm, no wipe');
  assert.equal((await call('POST', '/v1/trips/sync', { trips: [], since: 0 }, t)).body.trips.length, 1, 'trips still there');
  assert.equal((await call('DELETE', '/v1/trips?confirm=delete-all', null, t)).status, 200);
  assert.equal((await call('POST', '/v1/trips/sync', { trips: [], since: 0 }, t)).body.trips.length, 0);
});

test('leaderboard (public only) and sharing with friends by permission', async () => {
  clock += 120000; // a fresh minute for the sign-up rate limit, which earlier tests used up
  const join = async (name, email) => {
    await call('POST', '/v1/auth/register', { name, email, password: 'Str0ng!pass' });
    return (await call('POST', '/v1/auth/verify', { email, code: lastCode() })).body.token;
  };
  const a = await join('Lia', 'lia.board@example.com'), b = await join('Max', 'max.board@example.com'), c = await join('Pri', 'pri.board@example.com');
  const code = (await call('GET', '/v1/friends', null, b)).body.code;
  await call('POST', '/v1/friends/add', { code }, a);
  const liaId = (await call('GET', '/v1/friends', null, b)).body.incoming[0].id;
  await call('POST', '/v1/friends/respond', { id: liaId, accept: true }, b);
  const maxId = (await call('GET', '/v1/friends', null, a)).body.people.find((p) => !p.me).id;
  const from = clock - 3 * 86400000;
  const t = (id, start, mode, m, pts) => ({ id, start, end: start + 1800000, mode, distanceM: m, steps: 0, maxSpeed: 2, points: pts || [], updatedAt: clock });
  // Lia's home is a private zone; one trip starts inside it.
  await call('PATCH', '/v1/me', { settings: { zones: [{ lat: 40.40, lng: 49.80, r: 200 }] } }, a);
  await call('POST', '/v1/trips/sync', { trips: [t('l1', clock - 7200000, 'walk', 3000, [[40.40, 49.80, 1, 5], [40.41, 49.81, 2, 5], [40.42, 49.82, 3, 5]])] }, a);
  await call('POST', '/v1/trips/sync', { trips: [t('m1', clock - 7200000, 'run', 8000)] }, b);
  await call('POST', '/v1/trips/sync', { trips: [t('p1', clock - 7200000, 'bike', 20000)] }, c);
  await call('PATCH', '/v1/me', { settings: { privateProfile: true } }, c);
  await call('POST', '/v1/me/steps', { days: [{ day: new Date(clock).toISOString().slice(0, 10), steps: 9000 }, { day: 'nope', steps: 5 }] }, a);

  let r = await call('GET', `/v1/leaderboard?metric=distance&from=${from}`, null, a);
  const mine3 = r.body.people.filter((p) => ['Lia', 'Max', 'Pri'].includes(p.name));
  assert.deepEqual(mine3.map((p) => [p.name, p.value]), [['Max', 8], ['Lia', 3]], 'private Pri left out');
  assert.ok(r.body.me.rank > r.body.people.find((p) => p.name === 'Max').rank);
  r = await call('GET', `/v1/leaderboard?metric=steps&from=${from}`, null, b);
  assert.equal(r.body.people.find((p) => p.name === 'Lia').value, 9000);
  assert.equal((await call('GET', `/v1/leaderboard?from=${from}`, null, c)).body.hiddenMe, true);

  // Nothing is shared until Lia allows it.
  assert.equal((await call('GET', `/v1/friend/routes?id=${liaId}`, null, b)).status, 403);
  assert.equal((await call('POST', '/v1/sharing', { friendId: (await call('GET', '/v1/friends', null, c)).body.people.find((p) => p.me).id, kind: 'routes', on: true }, a)).status, 400, 'only friends');
  await call('POST', '/v1/sharing', { friendId: maxId, kind: 'routes', on: true }, a);
  r = await call('GET', `/v1/friend/routes?id=${liaId}`, null, b);
  assert.deepEqual(r.body.trips[0].points, [[40.41, 49.81], [40.42, 49.82]], 'home point removed');
  assert.equal((await call('GET', `/v1/friend/routes?id=${maxId}`, null, a)).status, 403, 'one way only');

  // Live: positions are ignored unless shared; shared ones show while fresh; revoking ends it.
  assert.equal((await call('POST', '/v1/live', { lat: 40.5, lng: 49.9 }, a)).body.sharing, false);
  await call('POST', '/v1/sharing', { friendId: maxId, kind: 'live', on: true, minutes: 60 }, a);
  await call('POST', '/v1/live', { lat: 40.5, lng: 49.9, at: clock, mode: 'walk' }, a);
  r = await call('GET', `/v1/friend/live?id=${liaId}`, null, b);
  assert.deepEqual([r.body.live.lat, r.body.live.mode], [40.5, 'walk']);
  r = await call('GET', '/v1/sharing', null, b);
  assert.deepEqual(Object.keys(r.body.toMe[0].kinds).sort(), ['live', 'routes']);
  await call('POST', '/v1/sharing', { friendId: maxId, kind: 'live', on: false }, a);
  assert.equal((await call('GET', `/v1/friend/live?id=${liaId}`, null, b)).status, 403);
  // Places: needs its own permission.
  assert.equal((await call('GET', `/v1/friend/places?id=${liaId}`, null, b)).status, 403);
  await call('POST', '/v1/sharing', { friendId: maxId, kind: 'places', on: true }, a);
  r = await call('GET', `/v1/friend/places?id=${liaId}`, null, b);
  assert.equal(r.body.places[0].lat, 40.42);
});

test('crash reports are stored and only the admin can read them', async () => {
  clock += 120000;
  const r = await call('POST', '/v1/crash', { message: 'TypeError: x is undefined', stack: 'at render', version: '4.0', screen: 'tabs' });
  assert.equal(r.status, 200);
  assert.equal((await call('POST', '/v1/crash', {})).status, 400);
  assert.equal((await call('GET', '/v1/admin/crashes')).status, 401);
});
