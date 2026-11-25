// Real maps, in the 5.0 grey style: calm grey tiles, routes 5px in the mode colour over a 4px card-coloured casing,
// stays as white circles with an ink ring, and where you are as an ink dot.
import L from 'leaflet';

const dark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('m-dark-theme');
const ink = () => (dark() ? '#F2F2F0' : '#0F0F0F');
const card = () => (dark() ? '#1A1A1A' : '#FFFFFF');
// Trips still carry the 4.x mode colours; draw them in the 5.0 ones.
const NEW = { '#3DBF5C': '#2FB457', '#F2766B': '#E5604F', '#6E8CF7': '#4F7BF0', '#B57BE0': '#8E6BE0', '#F6C343': '#E7A82A' };
const MODE = { walk: '#2FB457', run: '#E5604F', bike: '#4F7BF0', transit: '#8E6BE0', drive: '#E7A82A' };
const col = (c) => NEW[String(c || '').toUpperCase()] || c || ink();
function tiles(map, el) {
  el.style.background = dark() ? '#1B1B1B' : '#EEEEEC';
  const t = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/' + (dark() ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base') + '/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, maxNativeZoom: 16, attribution: 'Esri, HERE, OpenStreetMap', className: 'motio-tiles' }).addTo(map);
  if (!dark()) map.getPane('tilePane').style.filter = 'saturate(0)';
  map.attributionControl && map.attributionControl.setPrefix(false);
  return t;
}
// A route: card-coloured casing under a mode-coloured line. Returns the coloured line.
const routeLine = (ll, c, layer, w = 5) => {
  L.polyline(ll, { color: card(), weight: w + 4, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layer);
  return L.polyline(ll, { color: col(c), weight: w, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
};
const stay = (p, layer) => L.circleMarker(p, { radius: 7, color: ink(), weight: 3, fillColor: card(), fillOpacity: 1 }).addTo(layer);
const inkDot = (p, layer, r = 6, c = ink()) => { L.circleMarker(p, { radius: r + 3, stroke: false, fillColor: card(), fillOpacity: 1, interactive: false }).addTo(layer); return L.circleMarker(p, { radius: r, stroke: false, fillColor: c, fillOpacity: 1 }).addTo(layer); };

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
    tiles(map, el);
    const layers = L.layerGroup().addTo(map);
    const dim = L.layerGroup().addTo(map);
    const dot = L.circleMarker([0, 0], { radius: 7, color: card(), weight: 3, fillColor: ink(), fillOpacity: 1 });
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
        lines.push({ r, line: routeLine(ll, r.color, layers) });
      }
      // Stays: where each trip started and where the day ended.
      const ends = [];
      rs.forEach((r) => { ends.push(r.points[0]); if (!r.live) ends.push(r.points[r.points.length - 1]); });
      ends.filter((p, i) => !ends.slice(0, i).some((q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) < 0.0012)).forEach((p) => stay([p[0], p[1]], dim));
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
        dot.bringToFront();
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
  // Places: a stay ring per place (home filled ink), framed to fit; fly() eases to one.
  mountPlaces(el, list) {
    const map = L.map(el, { zoomControl: false, attributionControl: true });
    tiles(map, el);
    // 5.0 map style: places are white stays with an ink ring (home filled ink), no colour.
    const pts = list.map((p) => {
      L.circle([p.lat, p.lng], { radius: 150, color: ink(), weight: 1, opacity: 0.25, fillOpacity: 0.06, interactive: false }).addTo(map);
      (p.kind === 'home' ? inkDot([p.lat, p.lng], map, 7) : stay([p.lat, p.lng], map)).bindTooltip(p.name, { permanent: list.length <= 6, direction: 'top', offset: [0, -8] });
      return [p.lat, p.lng];
    });
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.35), { animate: false, maxZoom: 15 }); else map.setView([40.4093, 49.8671], 12);
    let dead = false;
    [300, 700].forEach((ms) => setTimeout(() => { if (!dead) map.invalidateSize(); }, ms));
    return {
      fly(lat, lng) { if (!dead) map.flyTo([lat, lng], 16, { duration: 0.8 }); },
      destroy() { dead = true; map.remove(); }
    };
  },
  // The recap's backdrop: a dark, still map of the period's routes. Slides steer it: show everything, fly to one
  // trip, or fade it back. Routes are SVG so they can draw themselves in.
  mountRecap(el, routes) {
    const map = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.1, fadeAnimation: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, className: 'motio-tiles-night' }).addTo(map);
    const all = [], lines = [];
    for (const r of routes) {
      const ll = r.points.map((p) => [p[0], p[1]]);
      if (ll.length < 2) continue;
      all.push(...ll);
      L.polyline(ll, { color: r.color, weight: 10, opacity: 0.18, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
      lines.push({ r, line: L.polyline(ll, { color: r.color, weight: 3.5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map) });
    }
    const pad = { paddingTopLeft: [40, 200], paddingBottomRight: [40, 260] };
    let dead = false;
    const overview = (animate) => { if (dead) return; if (all.length) map.flyToBounds(L.latLngBounds(all), { ...pad, duration: animate ? 1.6 : 0, animate: !!animate, maxZoom: 15 }); else map.setView([40.4093, 49.8671], 12, { animate: false }); };
    overview(false);
    [200, 600].forEach((ms) => setTimeout(() => { if (!dead) { map.invalidateSize(); overview(false); } }, ms));
    return {
      overview,
      focus(id, box) {
        const hit = lines.find((x) => x.r.id === id);
        if (!dead && hit) map.flyToBounds(hit.line.getBounds(), { paddingTopLeft: [40, box ? box[0] : 220], paddingBottomRight: [40, box ? box[1] : 300], duration: 1.6, maxZoom: 16 });
        for (const x of lines) x.line.setStyle({ opacity: !hit || x === hit ? 1 : 0.25 });
      },
      all() { for (const x of lines) x.line.setStyle({ opacity: 1 }); },
      // Every route draws itself, one after another.
      draw(ms = 1800) {
        lines.forEach(({ line }, i) => {
          const p = line.getElement && line.getElement();
          if (!p || !p.getTotalLength) return;
          const n = p.getTotalLength();
          p.style.strokeDasharray = n; p.animate([{ strokeDashoffset: n }, { strokeDashoffset: 0 }], { duration: ms, delay: i * 90, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'backwards' });
          setTimeout(() => { p.style.strokeDasharray = ''; }, ms + i * 90 + 50);
        });
      },
      destroy() { dead = true; map.remove(); }
    };
  },
  // A friend's shared map: their routes, their usual places and where they are right now (whatever they share).
  // show(data) redraws with new data; the view frames everything the first time only, so polling doesn't jump.
  mountFriend(el) {
    const map = L.map(el, { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([40.4093, 49.8671], 12);
    tiles(map, el);
    const layer = L.layerGroup().addTo(map);
    let dead = false, framed = false;
    [300, 700].forEach((ms) => setTimeout(() => { if (!dead) map.invalidateSize(); }, ms));
    return {
      show({ trips = [], places = [], live = null } = {}) {
        if (dead) return;
        layer.clearLayers();
        const all = [];
        for (const t of trips) {
          const ll = t.points.map((p) => [p[0], p[1]]);
          routeLine(ll, MODE[t.mode], layer);
          all.push(...ll);
        }
        for (const p of places) {
          stay([p.lat, p.lng], layer)
            .bindTooltip(p.name || p.visits + (p.visits === 1 ? ' visit' : ' visits'), { direction: 'top', offset: [0, -6] });
          all.push([p.lat, p.lng]);
        }
        if (live) {
          L.circleMarker([live.lat, live.lng], { radius: 16, stroke: false, fillColor: ink(), fillOpacity: 0.12 }).addTo(layer);
          inkDot([live.lat, live.lng], layer, 7);
        }
        if (live && !framed) map.setView([live.lat, live.lng], 15, { animate: false });
        else if (all.length && !framed) map.fitBounds(L.latLngBounds(all).pad(0.2), { animate: false, maxZoom: 15 });
        if (live || all.length) framed = true;
      },
      reframe() { framed = false; },
      fly(lat, lng) { if (!dead) map.flyTo([lat, lng], 16, { duration: 0.8 }); },
      destroy() { dead = true; map.remove(); }
    };
  },
  // One trip in its mode colour, from a stay ring (start) to an ink dot (finish).
  mountTrip(el, points, color) {
    const map = L.map(el, { zoomControl: false, attributionControl: true, preferCanvas: true });
    tiles(map, el);
    L.polyline(points.map((p) => [p[0], p[1]]), { color: card(), weight: 9, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
    // One short line per step, so the replay can draw the route in behind the runner.
    const segs = points.slice(1).map((p, i) => L.polyline([[points[i][0], points[i][1]], [p[0], p[1]]], { color: col(color), weight: 5, lineCap: 'round' }).addTo(map));
    if (points.length) {
      stay([points[0][0], points[0][1]], map);
      const e = points[points.length - 1];
      inkDot([e[0], e[1]], map);
      map.fitBounds(L.latLngBounds(points.map((p) => [p[0], p[1]])).pad(0.2), { animate: false });
    } else map.setView([40.4093, 49.8671], 12);
    let dead = false, raf = 0, runner = null;
    [300, 700].forEach((ms) => setTimeout(() => { if (!dead) map.invalidateSize(); }, ms));
    return {
      // Replays the trip as a timelapse: a marker retraces the route at its real pace (slow stretches stay slow),
      // drawing the coloured line behind it. onTick(progress, clockTime, done) drives the page's clock.
      replay(onTick) {
        if (dead || points.length < 2) return;
        cancelAnimationFrame(raf);
        segs.forEach((g) => g.setStyle({ opacity: 0 }));
        if (!runner) runner = L.circleMarker([points[0][0], points[0][1]], { radius: 7, color: card(), weight: 3, fillColor: ink(), fillOpacity: 1 }).addTo(map);
        const t0 = performance.now(), D = Math.min(9000, Math.max(4500, points.length * 30));
        const a = points[0][2], span = Math.max(1, points[points.length - 1][2] - a);
        let i = 0;
        const step = (now) => {
          if (dead) return;
          const f = Math.min(1, (now - t0) / D), e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2, at = a + span * e;
          while (i < points.length - 2 && points[i + 1][2] <= at) { segs[i].setStyle({ opacity: 1 }); i++; }
          const p = points[i], q = points[i + 1], k = Math.min(1, Math.max(0, (at - p[2]) / Math.max(1, q[2] - p[2])));
          runner.setLatLng([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
          if (onTick) onTick(e, at, f >= 1);
          if (f < 1) { raf = requestAnimationFrame(step); return; }
          segs.forEach((g) => g.setStyle({ opacity: 1 }));
          runner.remove(); runner = null;
        };
        raf = requestAnimationFrame(step);
      },
      destroy() { dead = true; cancelAnimationFrame(raf); map.remove(); }
    };
  },
  // Explorer: every ~150 m square you've passed through is filled in ink on the grey map.
  mountFog(el, cells, center) {
    const map = L.map(el, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], 13);
    tiles(map, el);
    // The squares are drawn by a Leaflet canvas renderer, so they pan and zoom (pinch and animated) in step with the tiles.
    const cv = L.canvas({ padding: 0.3 });
    map.addLayer(cv);
    const CELL = 0.00135; // must match explorer() in motio.js
    let dead = false;
    cv.on('update', () => {
      if (dead) return;
      const g = cv._ctx, b = cv._bounds;
      g.save();
      g.fillStyle = ink(); g.globalAlpha = 0.55;
      for (const c of cells) {
        const dl = CELL / 2, dg = CELL / 2 / Math.cos((c[0] * Math.PI) / 180);
        const p = map.latLngToLayerPoint([c[0] + dl, c[1] - dg]), q = map.latLngToLayerPoint([c[0] - dl, c[1] + dg]);
        if (q.x < b.min.x || q.y < b.min.y || p.x > b.max.x || p.y > b.max.y) continue;
        const w = q.x - p.x, h = q.y - p.y, gap = w > 6 ? 1 : 0;
        g.fillRect(p.x + gap, p.y + gap, Math.max(1, w - 2 * gap), Math.max(1, h - 2 * gap));
      }
      g.restore();
    });
    // Redraw at most once a frame while dragging or flying; pinch and zoom animations are handled by Leaflet.
    let raf = 0;
    map.on('move', () => { if (!raf && !map._animatingZoom) raf = requestAnimationFrame(() => { raf = 0; if (!dead && !map._animatingZoom) cv._update(); }); });
    if (cells.length) map.fitBounds(L.latLngBounds(cells.map((c) => [c[0], c[1]])), { padding: [20, 20], maxZoom: 15 });
    [0, 300, 700].forEach((ms) => setTimeout(() => { if (!dead) { map.invalidateSize(); cv._update(); } }, ms));
    return { fly(lat, lng, z = 15) { if (!dead) map.flyTo([lat, lng], z, { duration: 0.9 }); }, destroy() { dead = true; map.remove(); } };
  }
};
