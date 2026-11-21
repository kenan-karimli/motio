// Decides how a whole trip was made: walk, run, bike, drive (car) or transit (bus/train).
// Inputs per trip: GPS points [lat, lng, time, accuracy], step count, and how long Google's Activity
// Recognition model (on the phone) reported each activity during the trip (`ar`, in ms weighted by confidence).

const hav = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const x = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const pct = (arr, q) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export function features(t) {
  const pts = t.points || [];
  const speeds = [], legs = [];
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i][2] - pts[i - 1][2]) / 1000;
    if (dt <= 0) continue;
    const v = hav(pts[i - 1], pts[i]) / dt;
    if (v > 70) continue; // over 250 km/h: a GPS jump, not movement
    legs.push({ v, dt });
    if (dt < 120) speeds.push(v);
  }
  // Stops: slow stretches of 8–150 s between moving stretches (bus stops, lights). Long pauses don't count.
  let stops = 0, slow = 0;
  for (const l of legs) {
    if (l.v < 0.8) slow += l.dt;
    else { if (slow >= 8 && slow <= 150) stops++; slow = 0; }
  }
  const km = Math.max(0.05, (t.distanceM || 0) / 1000);
  if (t.stops != null) stops = Math.max(stops, t.stops); // counted live by the tracker (stationary GPS updates aren't kept)
  const mins = Math.max(0.5, ((t.end || 0) - (t.start || 0)) / 60000);
  // Google's readings, weighted by time × confidence. Shares are of the moving readings; "still" is kept apart,
  // and the model only counts once it has seen about a minute of movement (one stray guess decides nothing).
  const ar = t.ar || {};
  const arTotal = Object.values(ar).reduce((a, b) => a + b, 0), moving = arTotal - (ar.still || 0);
  const share = (k) => (moving ? (ar[k] || 0) / moving : 0);
  return {
    med: pct(speeds, 0.5), p85: pct(speeds, 0.85), cadence: (t.steps || 0) / mins, stopsPerKm: stops / km, km,
    vehicle: share('vehicle'), bike: share('bike'), foot: share('walk') + share('run'), run: share('run'), arSeen: moving >= 45000, stepsOn: !!t.stepsOn,
    still: arTotal ? (ar.still || 0) / arTotal : 0
  };
}

// Rules, in order of how sure each signal is. Speeds in m/s.
export function rules(f) {
  const moving = f.p85 || f.med;
  // Steps at walking pace are the surest sign of all: phones don't count steps in a car.
  if (f.cadence > 140 && f.med > 2.2 && f.med < 6.5) return 'run';
  if (f.cadence > 60 && f.med < 2.6) return 'walk';
  if (f.arSeen) {
    if (f.vehicle >= 0.5) return vehicleKind(f);
    if (f.bike >= 0.45) return 'bike';
    if (f.run >= 0.4 || (f.foot >= 0.45 && f.cadence > 140 && f.med > 2.2)) return 'run';
    if (f.foot >= 0.45) return 'walk';
  }
  // The step counter was on and saw almost nothing: not on foot, whatever the speed. Slow means traffic.
  if (f.stepsOn && f.cadence < 12 && f.km > 0.3 && f.foot < 0.45) return f.med >= 2.4 && f.med < 6.5 && f.stopsPerKm < 1 && f.vehicle < 0.3 ? 'bike' : vehicleKind(f);
  // No clear answer from the model: fall back to speed and steps.
  if (f.cadence > 140 && f.med > 2.2 && f.med < 6.5) return 'run';
  if (f.cadence > 45 && f.med < 2.6) return 'walk';
  if (moving > 8.5 || f.med > 6.5) return vehicleKind(f);
  if (f.med >= 2.4 && f.cadence < 30) return 'bike';
  return 'walk';
}
// Car or bus/train: buses stop often (about one stop every 400–800 m) and rarely go fast between them.
function vehicleKind(f) {
  return f.stopsPerKm >= 1.2 && f.p85 < 16 ? 'transit' : 'drive';
}

// Your corrections teach it: nearest neighbours on scaled features, used once a few examples exist.
const VEC = (f) => [f.med / 10, f.p85 / 15, Math.min(f.cadence, 200) / 100, Math.min(f.stopsPerKm, 6) / 3, f.vehicle, f.bike, f.foot, f.run];
export const vector = (f) => VEC(f).map((x) => Math.round(x * 100) / 100);
export function classifyTrip(f, learned = []) {
  if (learned.length >= 2) {
    const v = VEC(f);
    const near = learned.map((e) => ({ m: e.m, d: Math.hypot(...e.v.map((x, i) => x - v[i])) })).sort((a, b) => a.d - b.d).slice(0, 5).filter((n) => n.d < 0.4);
    const votes = {};
    for (const n of near) votes[n.m] = (votes[n.m] || 0) + 1 / (0.05 + n.d);
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    if (best && near.filter((n) => n.m === best[0]).length >= Math.min(2, near.length)) return best[0];
  }
  return rules(f);
}
