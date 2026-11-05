// Real map for the Map screen: routes coloured by movement type and a marker that follows a time slider.
import L from 'leaflet';

function interpolate(routes, t) {
  for (const r of routes) {
    if (t < r.start || t > r.end) continue;
    const pts = r.points;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][2] >= t) {
        const a = pts[i - 1], b = pts[i], k = b[2] === a[2] ? 0 : (t - a[2]) / (b[2] - a[2]);
        return { lat: a[0] + (b[0] - a[0]) * k, lng: a[1] + (b[1] - a[1]) * k, route: r, moving: true };
      }
    }
    const last = pts[pts.length - 1];
    return { lat: last[0], lng: last[1], route: r, moving: true };
  }
  // Between trips: stay where the last trip ended.
  let prev = null;
  for (const r of routes) if (r.end <= t) prev = r;
  if (prev) { const p = prev.points[prev.points.length - 1]; return { lat: p[0], lng: p[1], route: null, moving: false }; }
  if (routes.length) { const p = routes[0].points[0]; return { lat: p[0], lng: p[1], route: null, moving: false }; }
  return null;
}

window.MotioMap = {
  mount(el, routes) {
    const map = L.map(el, { zoomControl: false, attributionControl: true, preferCanvas: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap contributors', className: 'motio-tiles'
    }).addTo(map);
    const layers = L.layerGroup().addTo(map);
    const dim = L.layerGroup().addTo(map);
    const dot = L.circleMarker([0, 0], { radius: 9, color: '#FFFFFF', weight: 4, fillColor: '#1F1D47', fillOpacity: 1 });
    let current = [];
    let lines = [];
    let dead = false;

    function draw(rs) {
      current = rs;
      layers.clearLayers(); dim.clearLayers(); lines = [];
      const all = [];
      for (const r of rs) {
        const ll = r.points.map((p) => [p[0], p[1]]);
        all.push(...ll);
        L.polyline(ll, { color: '#1F1D47', weight: 9, opacity: 0.18, lineCap: 'round', lineJoin: 'round' }).addTo(dim);
        const line = L.polyline(ll, { color: r.color, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(layers);
        lines.push({ r, line });
        L.circleMarker(ll[0], { radius: 4, color: r.color, weight: 2, fillColor: '#FFFFFF', fillOpacity: 1 }).addTo(layers);
      }
      if (all.length) map.fitBounds(L.latLngBounds(all).pad(0.18), { animate: false });
      else map.setView([40.4093, 49.8671], 12);
    }
    draw(routes);
    // Page slide-ins and the phone's scaling can change the box after mount; keep tiles covering it.
    const ro = new ResizeObserver(() => { if (!dead) map.invalidateSize(); });
    ro.observe(el);
    [300, 700, 1500].forEach((ms) => setTimeout(() => { if (!dead) map.invalidateSize(); }, ms));

    return {
      update(rs) { draw(rs); },
      setTime(t, follow) {
        if (dead) return null;
        const p = interpolate(current, t);
        if (!p) { dot.remove(); return null; }
        dot.setLatLng([p.lat, p.lng]).addTo(map);
        dot.setStyle({ fillColor: p.route ? p.route.color : '#1F1D47' });
        // Fade every route except the one you're on.
        for (const { r, line } of lines) line.setStyle({ opacity: !p.route || r.id === p.route.id ? 1 : 0.35 });
        if (follow) map.panTo([p.lat, p.lng], { animate: true, duration: 0.25 });
        return p;
      },
      focus(id) {
        const hit = lines.find((x) => x.r.id === id);
        if (hit) map.fitBounds(hit.line.getBounds().pad(0.25), { animate: true });
      },
      invalidate() { if (!dead) map.invalidateSize(); },
      destroy() { dead = true; ro.disconnect(); map.remove(); }
    };
  },
  // Places: a dot per place (home and work in their own colours), framed to fit; fly() eases to one.
  mountPlaces(el, list) {
    const map = L.map(el, { zoomControl: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors', className: 'motio-tiles' }).addTo(map);
    const color = (k) => (k === 'home' ? '#F2766B' : k === 'work' ? '#5B4FE0' : '#3DBF5C');
    const pts = list.map((p) => {
      L.circle([p.lat, p.lng], { radius: 150, color: color(p.kind), weight: 1, fillOpacity: 0.12 }).addTo(map);
      L.circleMarker([p.lat, p.lng], { radius: 8, color: '#FFFFFF', weight: 3, fillColor: color(p.kind), fillOpacity: 1 }).addTo(map).bindTooltip(p.name, { permanent: list.length <= 6, direction: 'top', offset: [0, -8] });
      return [p.lat, p.lng];
    });
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.35), { animate: false, maxZoom: 15 }); else map.setView([40.4093, 49.8671], 12);
    let dead = false;
    [300, 700].forEach((ms) => setTimeout(() => { if (!dead) map.invalidateSize(); }, ms));
    return {
      fly(lat, lng) { if (!dead) map.flyTo([lat, lng], 16, { duration: 0.8 }); },
      destroy() { dead = true; map.remove(); }
    };
  }
};
