// Which Baku bus line a transit trip took: the trip's points are compared with bus routes from
// OpenStreetMap (route=bus relations around Baku, fetched once and kept for a week). A line counts when
// most of the trip runs along it. shortcut: only the lines mapped in OSM (16 in 2026); people teach
// Motio the rest on their own phone (see busLine in src/motio.js).
const BBOX = '40.25,49.6,40.65,50.25';
const QUERY = `[out:json][timeout:90];relation["route"="bus"](${BBOX});out geom;`;
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const CELL = 0.004; // ~400 m grid cells for the lookup

const hav = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const x = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
// Distance from p to the segment a–b in metres (flat-earth is fine at this scale).
function segDist(p, a, b) {
  const k = Math.cos((p[0] * Math.PI) / 180), ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0];
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return hav(p, [ay + t * dy, (ax + t * dx) / k]);
}
const cellOf = (lat, lng) => Math.floor(lat / CELL) + ':' + Math.floor(lng / CELL);

// lines: [{ ref, name, segments: [[[lat, lng], [lat, lng]], ...] }] → a grid of which segments pass each cell.
export function buildIndex(lines) {
  const grid = new Map();
  lines.forEach((l, li) => l.segments.forEach((s, si) => {
    const cells = new Set([cellOf(s[0][0], s[0][1]), cellOf(s[1][0], s[1][1]), cellOf((s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2)]);
    for (const c of cells) { if (!grid.has(c)) grid.set(c, []); grid.get(c).push([li, si]); }
  }));
  return { lines, grid };
}
// The line most of the trip ran along (≥ 60% of its points within 45 m), or null.
export function matchLine(index, points) {
  const step = Math.max(1, Math.floor(points.length / 80)), sample = points.filter((_, i) => i % step === 0);
  if (sample.length < 4) return null;
  const hits = new Map();
  for (const p of sample) {
    const near = new Set();
    const [ci, cj] = [Math.floor(p[0] / CELL), Math.floor(p[1] / CELL)];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const [li, si] of index.grid.get(ci + di + ':' + (cj + dj)) || []) {
      if (near.has(li)) continue;
      const s = index.lines[li].segments[si];
      if (segDist(p, s[0], s[1]) < 45) near.add(li);
    }
    for (const li of near) hits.set(li, (hits.get(li) || 0) + 1);
  }
  let best = null;
  for (const [li, n] of hits) if (!best || n > best.n) best = { li, n };
  if (!best || best.n / sample.length < 0.6) return null;
  const l = index.lines[best.li];
  return { line: l.ref, name: l.name, share: Math.round((best.n / sample.length) * 100) / 100 };
}

export async function busRoutes({ authUser, bad, fetchImpl, now }) {
  let index = null, at = 0, loading = null;
  async function load() {
    if (index && now() - at < 7 * 86400000) return index;
    if (loading) return loading;
    loading = (async () => {
      for (const url of MIRRORS) {
        try {
          const r = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'motio-server' }, body: 'data=' + encodeURIComponent(QUERY) });
          if (!r.ok) continue;
          const d = await r.json();
          const lines = d.elements.filter((e) => e.tags && e.tags.ref).map((e) => ({ ref: String(e.tags.ref), name: e.tags.name || '',
            segments: (e.members || []).filter((m) => m.type === 'way' && m.geometry).flatMap((m) => m.geometry.slice(1).map((g, i) => [[m.geometry[i].lat, m.geometry[i].lon], [g.lat, g.lon]])) }))
            .filter((l) => l.segments.length);
          if (lines.length) { index = buildIndex(lines); at = now(); return index; }
        } catch { /* try the next mirror */ }
      }
      return index; // keep the old one (or none) when OSM can't be reached
    })().finally(() => { loading = null; });
    return loading;
  }
  return {
    // Body: { points: [[lat, lng], ...] } of a bus trip. Answers { line, name } or { line: null }.
    'POST /v1/bus/match': async ({ req, body }) => {
      await authUser(req);
      const pts = (Array.isArray(body.points) ? body.points : []).slice(0, 2000).map((p) => [+p[0], +p[1]]).filter((p) => Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180);
      if (pts.length < 2) throw bad('no_points', 'Need the trip’s route.');
      const idx = await load();
      return idx ? matchLine(idx, pts) || { line: null } : { line: null, unavailable: true };
    }
  };
}
