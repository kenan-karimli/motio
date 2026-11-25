// What a spot is called: OpenStreetMap's Nominatim, asked about a ~100 m square (never the exact fix),
// cached for good so each square is asked once, and one request a second at most (Nominatim's rule).
// shortcut: one server asks at a time from memory; with many users, move the queue to a table or self-host.
const URL_BASE = 'https://nominatim.openstreetmap.org/reverse';
const UA = 'Motio/5 (+https://motio-api.onrender.com)';

// A shop, school or park beats a street; a street with its number beats a district; a district beats a city.
export function nameFrom(r) {
  const a = (r && r.address) || {};
  const poi = r && r.name && r.addresstype !== 'road' ? r.name : '';
  if (poi) return String(poi).slice(0, 40);
  const road = a.road || a.pedestrian || a.footway || a.path || '';
  if (road) return String(a.house_number ? road + ' ' + a.house_number : road).slice(0, 40);
  return String(a.neighbourhood || a.suburb || a.quarter || a.city_district || a.village || a.town || a.city || '').slice(0, 40);
}
const key = (lat, lng) => lat.toFixed(3) + ',' + lng.toFixed(3);

export async function placeRoutes({ db, authUser, bad, fetchImpl, now }) {
  const get = db.prepare('SELECT name FROM place_names WHERE key = ?'), put = db.prepare('INSERT INTO place_names (key, name, at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET name = excluded.name, at = excluded.at');
  let last = 0, queue = Promise.resolve();
  const ask = (lat, lng) => (queue = queue.then(async () => {
    const wait = last + 1100 - now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = now();
    const r = await fetchImpl(`${URL_BASE}?format=jsonv2&zoom=18&addressdetails=1&accept-language=en,az&lat=${lat}&lon=${lng}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('nominatim ' + r.status);
    return nameFrom(await r.json());
  }));
  return {
    'GET /v1/place-name': async ({ req, url }) => {
      await authUser(req);
      const lat = +url.searchParams.get('lat'), lng = +url.searchParams.get('lng');
      if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180) || url.searchParams.get('lat') === null) throw bad('bad_spot', 'Need lat and lng.');
      const k = key(lat, lng), hit = await get.get(k);
      if (hit) return { name: hit.name };
      let name = '';
      try { name = await ask(+k.split(',')[0], +k.split(',')[1]); } catch { return { name: '', unavailable: true }; }
      if (name) await put.run(k, name, now());
      return { name };
    }
  };
}
