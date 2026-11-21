import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, matchLine } from '../src/bus.js';

// Two lines: 65 runs east along a street, 14 runs north from the same corner.
const along = (a, b, n) => Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / (n - 1), a[1] + ((b[1] - a[1]) * i) / (n - 1)]);
const segs = (pts) => pts.slice(1).map((p, i) => [pts[i], p]);
const idx = buildIndex([{ ref: '65', name: 'Bus 65', segments: segs(along([40.40, 49.80], [40.40, 49.85], 30)) }, { ref: '14', name: 'Bus 14', segments: segs(along([40.40, 49.80], [40.45, 49.80], 30)) }]);

test('a bus trip along a line gets its number', () => {
  const trip = along([40.4002, 49.805], [40.3998, 49.845], 60); // ~20 m off the line, like GPS
  assert.equal(matchLine(idx, trip).line, '65');
  assert.equal(matchLine(idx, along([40.405, 49.8002], [40.44, 49.7999], 40)).line, '14');
});
test('a trip that only touches a line, or runs elsewhere, gets none', () => {
  assert.equal(matchLine(idx, along([40.41, 49.81], [40.43, 49.84], 50)), null);
  assert.equal(matchLine(idx, [...along([40.4, 49.80], [40.4, 49.805], 10), ...along([40.41, 49.81], [40.43, 49.84], 40)]), null);
});
