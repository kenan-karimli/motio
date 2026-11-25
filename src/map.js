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
    // 5.0 map style: places are white stays with an ink ring (home filled ink), no colour.
    const ink = '#0F0F0F';
    const pts = list.map((p) => {
      L.circle([p.lat, p.lng], { radius: 150, color: ink, weight: 1, opacity: 0.25, fillOpacity: 0.06 }).addTo(map);
      L.circleMarker([p.lat, p.lng], { radius: 7, color: ink, weight: 3, fillColor: p.kind === 'home' ? ink : '#FFFFFF', fillOpacity: 1 }).addTo(map).bindTooltip(p.name, { permanent: list.length <= 6, direction: 'top', offset: [0, -8] });
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
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors', className: 'motio-tiles' }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    const COLOR = { walk: '#3DBF5C', run: '#F2766B', bike: '#6E8CF7', drive: '#8C7CF0', transit: '#F6C343' };
    let dead = false, framed = false;
    [300, 700].forEach((ms) => setTimeout(() => { if (!dead) map.invalidateSize(); }, ms));
    return {
      show({ trips = [], places = [], live = null } = {}) {
        if (dead) return;
        layer.clearLayers();
        const all = [];
        for (const t of trips) {
          const ll = t.points.map((p) => [p[0], p[1]]);
          L.polyline(ll, { color: '#1F1D47', weight: 8, opacity: 0.14, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
          L.polyline(ll, { color: COLOR[t.mode] || '#5B4FE0', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
          all.push(...ll);
        }
        for (const p of places) {
          L.circle([p.lat, p.lng], { radius: 120, color: '#5B4FE0', weight: 1, fillOpacity: 0.12 }).addTo(layer);
          L.circleMarker([p.lat, p.lng], { radius: 7, color: '#FFFFFF', weight: 3, fillColor: '#5B4FE0', fillOpacity: 1 }).addTo(layer)
            .bindTooltip(p.name || p.visits + (p.visits === 1 ? ' visit' : ' visits'), { direction: 'top', offset: [0, -6] });
          all.push([p.lat, p.lng]);
        }
        if (live) {
          L.circle([live.lat, live.lng], { radius: 60, color: '#F2766B', weight: 0, fillOpacity: 0.25 }).addTo(layer);
          L.circleMarker([live.lat, live.lng], { radius: 10, color: '#FFFFFF', weight: 4, fillColor: '#F2766B', fillOpacity: 1 }).addTo(layer);
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
  // One trip, coloured by speed (blue slow → yellow → red fast), with start and finish dots.
  mountTrip(el, points) {
    const map = L.map(el, { zoomControl: false, attributionControl: true, preferCanvas: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors', className: 'motio-tiles' }).addTo(map);
    const R = 6371000, rad = Math.PI / 180;
    const dist = (a, b) => { const x = Math.sin(((b[0] - a[0]) * rad) / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(((b[1] - a[1]) * rad) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
    const speeds = points.slice(1).map((p, i) => dist(points[i], p) / Math.max(1, (p[2] - points[i][2]) / 1000));
    const top = Math.max(1, ...speeds.slice().sort((a, b) => a - b).slice(0, Math.max(1, Math.floor(speeds.length * 0.95))));
    const ramp = (f) => { const c = f < 0.5 ? [[110, 140, 247], [246, 195, 67]] : [[246, 195, 67], [242, 118, 107]]; const k = f < 0.5 ? f * 2 : (f - 0.5) * 2; return 'rgb(' + c[0].map((v, i) => Math.round(v + (c[1][i] - v) * k)).join(',') + ')'; };
    L.polyline(points.map((p) => [p[0], p[1]]), { color: '#1F1D47', weight: 10, opacity: 0.15, lineCap: 'round' }).addTo(map);
    const segs = speeds.map((v, i) => L.polyline([[points[i][0], points[i][1]], [points[i + 1][0], points[i + 1][1]]], { color: ramp(Math.min(1, v / top)), weight: 6, lineCap: 'round' }).addTo(map));
    if (points.length) {
      L.circleMarker([points[0][0], points[0][1]], { radius: 7, color: '#FFFFFF', weight: 3, fillColor: '#3DBF5C', fillOpacity: 1 }).addTo(map);
      const e = points[points.length - 1];
      L.circleMarker([e[0], e[1]], { radius: 7, color: '#FFFFFF', weight: 3, fillColor: '#1F1D47', fillOpacity: 1 }).addTo(map);
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
        if (!runner) runner = L.circleMarker([points[0][0], points[0][1]], { radius: 9, color: '#FFFFFF', weight: 4, fillColor: '#1F1D47', fillOpacity: 1 }).addTo(map);
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
  // Explorer: the map under a fog that's cleared, softly, wherever you've been.
  mountFog(el, cells, center) {
    const map = L.map(el, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors', className: 'motio-tiles' }).addTo(map);
    // The fog is drawn by a Leaflet canvas renderer, so it pans and zooms (pinch and animated) in step with the tiles.
    const fog = L.canvas({ padding: 0.3 });
    map.addLayer(fog);
    let dead = false;
    fog.on('update', () => {
      if (dead) return;
      const g = fog._ctx, b = fog._bounds;
      g.save();
      g.fillStyle = 'rgba(22,20,47,0.86)'; g.fillRect(b.min.x, b.min.y, b.max.x - b.min.x, b.max.y - b.min.y);
      g.globalCompositeOperation = 'destination-out';
      // ~150 m around each visited square, so neighbouring squares merge into one clear trail.
      const px = map.latLngToLayerPoint([center.lat, center.lng]).distanceTo(map.latLngToLayerPoint([center.lat + 0.0014, center.lng]));
      const rad = Math.max(4, px), soft = g.createRadialGradient(0, 0, 0, 0, 0, rad);
      soft.addColorStop(0, 'rgba(0,0,0,1)'); soft.addColorStop(0.7, 'rgba(0,0,0,0.95)'); soft.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = soft;
      for (const c of cells) {
        const p = map.latLngToLayerPoint([c[0], c[1]]);
        if (p.x < b.min.x - rad || p.y < b.min.y - rad || p.x > b.max.x + rad || p.y > b.max.y + rad) continue;
        g.translate(p.x, p.y); g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill(); g.translate(-p.x, -p.y);
      }
      g.restore();
    });
    // Redraw at most once a frame while dragging or flying, so no unfogged edge shows; pinch and zoom animations are handled by Leaflet.
    let raf = 0;
    map.on('move', () => { if (!raf && !map._animatingZoom) raf = requestAnimationFrame(() => { raf = 0; if (!dead && !map._animatingZoom) fog._update(); }); });
    // Frame everything explored, clear of the title above and the stats card below.
    if (cells.length) map.fitBounds(L.latLngBounds(cells.map((c) => [c[0], c[1]])), { paddingTopLeft: [24, 100], paddingBottomRight: [24, 300], maxZoom: 15 });
    [0, 300, 700].forEach((ms) => setTimeout(() => { if (!dead) { map.invalidateSize(); fog._update(); } }, ms));
    return { fly(lat, lng, z = 15) { if (!dead) map.flyTo([lat, lng], z, { duration: 0.9 }); }, destroy() { dead = true; map.remove(); } };
  }
};
