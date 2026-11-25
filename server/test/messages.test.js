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
  return { status: res.status, body: await res.json() };
};
const join = async (name, email) => {
  await call('POST', '/v1/auth/register', { name, email, password: 'Str0ng!pass' });
  const code = /(\d{6})/.exec(mailer.outbox[0].text)[1];
  return (await call('POST', '/v1/auth/verify', { email, code })).body.token;
};
test.after(() => server.close());

test('messages between friends: ticks, unread, pin, mute, clear, delete, block', async () => {
  const a = await join('Leyla', 'leyla@example.com'), b = await join('Murad', 'murad@example.com'), c = await join('Stranger', 'stranger@example.com');
  await call('POST', '/v1/friends/add', { code: (await call('GET', '/v1/friends', null, b)).body.code }, a);
  const aId = (await call('GET', '/v1/friends', null, b)).body.incoming[0].id;
  await call('POST', '/v1/friends/respond', { id: aId, accept: true }, b);
  const bId = (await call('GET', '/v1/friends', null, a)).body.people.find((p) => !p.me).id;
  const cId = (await call('GET', '/v1/friends', null, c)).body.people[0].id;

  // Auth and friends only.
  assert.equal((await call('GET', '/v1/chats')).status, 401);
  assert.equal((await call('POST', '/v1/chat/send', { id: cId, text: 'hi' }, a)).status, 403);
  assert.equal((await call('GET', `/v1/chat?id=${aId}`, null, c)).status, 403);
  assert.equal((await call('POST', '/v1/chat/send', { id: bId, text: '   ' }, a)).body.error, 'empty');
  assert.equal((await call('POST', '/v1/chat/send', { id: bId, text: 'x'.repeat(1001) }, a)).body.error, 'too_long');

  let r = await call('POST', '/v1/chat/send', { id: bId, text: '  Parachute Tower, 18:00?  ' }, a);
  assert.equal(r.body.message.text, 'Parachute Tower, 18:00?');
  assert.equal(r.body.message.status, 'sent');
  assert.equal((await call('GET', '/v1/chats', null, a)).body.chats[0].last.status, 'sent');

  // Murad's phone fetches the list: delivered. He has one unread.
  r = await call('GET', '/v1/chats', null, b);
  assert.equal(r.body.unread, 1);
  assert.deepEqual([r.body.chats[0].friend.name, r.body.chats[0].unread, r.body.chats[0].last.mine], ['Leyla', 1, false]);
  assert.equal((await call('GET', '/v1/chats', null, a)).body.chats[0].last.status, 'delivered');

  // He opens the chat: seen, with the time.
  clock += 60000;
  r = await call('GET', `/v1/chat?id=${aId}`, null, b);
  assert.equal(r.body.messages.length, 1);
  assert.equal((await call('GET', '/v1/chats', null, b)).body.unread, 0);
  r = await call('GET', `/v1/chat?id=${bId}`, null, a);
  assert.equal(r.body.messages[0].status, 'seen');
  assert.equal(r.body.theirReadAt, clock);

  // Polling with `after` returns only new messages.
  const last = r.body.messages[0].id;
  await call('POST', '/v1/chat/send', { id: aId, text: 'See you there' }, b);
  r = await call('GET', `/v1/chat?id=${bId}&after=${last}`, null, a);
  assert.deepEqual(r.body.messages.map((m) => m.text), ['See you there']);

  // A shared trip comes from the server copy, with private zones cut out.
  await call('PATCH', '/v1/me', { settings: { zones: [{ lat: 40.40, lng: 49.80, r: 200 }] } }, a);
  await call('POST', '/v1/trips/sync', { trips: [{ id: 't1', start: clock - 3600000, end: clock - 1800000, mode: 'bike', distanceM: 5200, steps: 0, maxSpeed: 6,
    points: [[40.40, 49.80, 1, 5], [40.41, 49.81, 2, 5], [40.42, 49.82, 3, 5]], updatedAt: clock }] }, a);
  assert.equal((await call('POST', '/v1/chat/send', { id: bId, tripId: 'nope' }, a)).body.error, 'no_trip');
  r = await call('POST', '/v1/chat/send', { id: bId, tripId: 't1', text: 'My ride' }, a);
  assert.equal(r.body.message.trip.mode, 'bike');
  assert.equal(r.body.message.trip.points.length, 2);

  // Pin, mute (muted chats don't count in the badge), read, clear, delete.
  await call('POST', '/v1/chats/pin', { ids: [aId] }, b);
  await call('POST', '/v1/chats/mute', { ids: [aId], hours: 8 }, b);
  r = await call('GET', '/v1/chats', null, b);
  assert.deepEqual([r.body.chats[0].pinned, r.body.chats[0].muted, r.body.chats[0].unread, r.body.unread], [true, true, 1, 0]);
  await call('POST', '/v1/chats/read', { ids: [aId] }, b);
  assert.equal((await call('GET', '/v1/chats', null, b)).body.chats[0].unread, 0);
  assert.equal((await call('POST', '/v1/chats/pin', { ids: [cId] }, b)).status, 403);

  await call('POST', '/v1/chats/clear', { id: aId }, b);
  r = await call('GET', '/v1/chats', null, b);
  assert.equal(r.body.chats.length, 1, 'a cleared chat stays in the list');
  assert.equal(r.body.chats[0].last, null);
  assert.equal((await call('GET', `/v1/chat?id=${aId}`, null, b)).body.messages.length, 0);
  assert.equal((await call('GET', `/v1/chat?id=${bId}`, null, a)).body.messages.length, 3, 'only cleared for Murad');

  await call('POST', '/v1/chats/delete', { ids: [aId] }, b);
  assert.equal((await call('GET', '/v1/chats', null, b)).body.chats.length, 0);
  await call('POST', '/v1/chat/send', { id: bId, text: 'Still on?' }, a);
  r = await call('GET', '/v1/chats', null, b);
  assert.equal(r.body.chats.length, 1, 'a new message brings a deleted chat back');
  assert.equal(r.body.chats[0].last.text, 'Still on?');

  // Block: no more chat, no more friendship, no new friend request.
  await call('POST', '/v1/chats/block', { id: aId }, b);
  assert.equal((await call('POST', '/v1/chat/send', { id: bId, text: 'hello?' }, a)).status, 403);
  assert.equal((await call('GET', '/v1/chats', null, a)).body.chats.length, 0);
  r = await call('POST', '/v1/friends/add', { code: (await call('GET', '/v1/friends', null, b)).body.code }, a);
  assert.equal(r.status, 404);
});

test('sending is rate limited', async () => {
  clock += 120000;
  const a = await join('Rate A', 'rate.a@example.com'), b = await join('Rate B', 'rate.b@example.com');
  await call('POST', '/v1/friends/add', { code: (await call('GET', '/v1/friends', null, b)).body.code }, a);
  const aId = (await call('GET', '/v1/friends', null, b)).body.incoming[0].id;
  await call('POST', '/v1/friends/respond', { id: aId, accept: true }, b);
  let r;
  for (let i = 0; i < 31; i++) r = await call('POST', '/v1/chat/send', { id: aId, text: 'm' + i }, b);
  assert.equal(r.status, 429);
  clock += 61000;
  assert.equal((await call('POST', '/v1/chat/send', { id: aId, text: 'later' }, b)).status, 200);
});
