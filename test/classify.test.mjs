import { test } from 'node:test';
import assert from 'node:assert/strict';
import { features, rules, classifyTrip, vector } from '../src/classify.js';

// A straight trip heading east: speeds in m/s per segment, 10 s apart.
function trip(speeds, { steps = 0, ar = {} } = {}) {
  const pts = [[40.4, 49.8, 0, 5]];
  let lng = 49.8, t = 0, dist = 0;
  for (const v of speeds) { t += 10000; const dLng = (v * 10) / (111320 * Math.cos((40.4 * Math.PI) / 180)); lng += dLng; dist += v * 10; pts.push([40.4, lng, t, 5]); }
  return { points: pts, start: 0, end: t, distanceM: dist, steps, ar };
}
const rep = (v, n) => Array(n).fill(v);

test('walking with GPS speed spikes stays a walk (was showing as bike)', () => {
  const t = trip([...rep(1.4, 20), 3.5, 1.3, 4, ...rep(1.4, 20)], { steps: 1100, ar: { walk: 400000 } });
  assert.equal(rules(features(t)), 'walk');
  const noModel = trip([...rep(1.4, 20), 3.5, 1.3, 4, ...rep(1.4, 20)], { steps: 1100 });
  assert.equal(rules(features(noModel)), 'walk', 'steps alone keep it a walk');
});

test('a bus with stops is transit, not walk; smooth driving is a car', () => {
  const bus = [];
  for (let i = 0; i < 8; i++) bus.push(...rep(9, 6), ...rep(0.2, 3)); // ~540 m between stops, 30 s dwell
  assert.equal(rules(features(trip(bus, { ar: { vehicle: 600000 } }))), 'transit');
  assert.equal(rules(features(trip(rep(14, 60), { ar: { vehicle: 600000 } }))), 'drive');
});

test('cycling, running, and vehicle without the model', () => {
  assert.equal(rules(features(trip(rep(5, 40), { ar: { bike: 300000 } }))), 'bike');
  assert.equal(rules(features(trip(rep(3.2, 40), { steps: 1100, ar: { run: 300000 } }))), 'run');
  assert.equal(rules(features(trip(rep(13, 40)))), 'drive');
  assert.equal(rules(features(trip(rep(4.5, 40)))), 'bike');
});

test('corrections teach it: similar trips follow your label', () => {
  // The rules call this smooth vehicle trip a car; the user said it was the bus three times.
  const f = features(trip(rep(11, 60), { ar: { vehicle: 600000 } }));
  assert.equal(classifyTrip(f, []), 'drive');
  const learned = [1, 2, 3].map(() => ({ v: vector(f), m: 'transit' }));
  assert.equal(classifyTrip(f, learned), 'transit');
  // A clearly different trip (a walk) is not pulled along.
  assert.equal(classifyTrip(features(trip(rep(1.4, 40), { steps: 900, ar: { walk: 400000 } })), learned), 'walk');
});

test('sitting still with one stray "in vehicle" guess is not a drive', () => {
  // Indoors: the position wanders, Google mostly says still, and once briefly guesses vehicle.
  const t = trip([...rep(0.3, 10), 9, 0.2, ...rep(0.3, 10)], { ar: { still: 500000, vehicle: 9000 } });
  const f = features(t);
  assert.equal(f.arSeen, false, 'nine seconds of a vehicle guess is not enough to trust');
  assert.notEqual(rules(f), 'drive');
});

test('a walk with GPS jumps and steps is a walk even if Google once said vehicle', () => {
  const t = trip([...rep(1.4, 30), 12, 11, ...rep(1.4, 30)], { steps: 1500, ar: { walk: 200000, vehicle: 120000 } });
  assert.equal(rules(features(t)), 'walk');
});
