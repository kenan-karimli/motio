import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../src/moments.js';

const DAY = 86400000, day = Date.UTC(2026, 10, 25);
const snap = (o) => ({ day, total: 0, today: [], lastBefore: 0, goalMin: 60, todayMin: 0, streak: 0, best: 0, badges: [], ...o });
const trip = { id: 't1', mode: 'walk', start: day + 8 * 3600000, end: day + 8 * 3600000 + 20 * 60000, from: 'Home', to: 'Port Baku Mall' };

test('first run only remembers', () => {
  const r = detect(null, snap({ total: 40, todayMin: 90, badges: [{ id: 'k100', title: '100 km club', desc: 'Cover 100 km in total' }] }));
  assert.deepEqual(r.out, []);
  assert.equal(detect(r.st, snap({ total: 40, todayMin: 90, badges: [{ id: 'k100', title: '100 km club', desc: 'Cover 100 km in total' }] })).out.length, 0);
});

test('first trip, once, without its badge', () => {
  const { st } = detect(null, snap({}));
  const r = detect(st, snap({ total: 1, today: [trip], badges: [{ id: 'first', title: 'First steps', desc: 'Record your first trip' }] }));
  assert.deepEqual(r.out, [{ kind: 'first', trip: 't1', color: '#2FB457', route: 'Home → Port Baku Mall', how: '20 minutes on foot' }]);
  assert.deepEqual(detect(r.st, snap({ total: 2, today: [trip], badges: [{ id: 'first', title: 'First steps', desc: 'x' }] })).out, []);
});

test('goal done, or the streak from three days, once a day', () => {
  const { st } = detect(null, snap({ total: 5 }));
  const a = detect(st, snap({ total: 5, todayMin: 61 }));
  assert.deepEqual(a.out, [{ kind: 'goal', goal: '1 hour' }]);
  assert.deepEqual(detect(a.st, snap({ total: 5, todayMin: 80 })).out, []);
  const b = detect(st, snap({ total: 5, todayMin: 61, streak: 13, best: 13 }));
  assert.deepEqual(b.out, [{ kind: 'streak', days: 13, longest: true }]);
});

test('back after a break and new badges', () => {
  const { st } = detect(null, snap({ total: 5 }));
  const r = detect(st, snap({ total: 6, today: [trip], lastBefore: day - 9 * DAY, badges: [{ id: 'transit10', title: 'Bus regular', desc: 'Take 10 bus or train trips' }] }));
  assert.deepEqual(r.out, [{ kind: 'back', days: 9 }, { kind: 'badge', title: 'Bus regular', desc: 'take 10 bus or train trips', icon: 'bus' }]);
  assert.deepEqual(detect(st, snap({ total: 6, today: [trip], lastBefore: day - 2 * DAY })).out, []);
});
