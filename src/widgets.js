// Draws the bigger home screen widgets as PNG images, light and dark (Motio 5.0 board 11). Board pixels × 2.4.
// Today, steps, streak and the slim bar are drawn natively (WidgetDraw.java), so they stay right with Motio closed.
const FONT = (w, px) => `${w} ${px}px "Inter Tight", sans-serif`;
const K = 2.4;
const PAL = {
  light: { bg: '#FFFFFF', ink: '#0F0F0F', mute: '#6E6E6A', soft: '#F5F5F3', line: '#ECECEA', dark: '#141414', onDark: '#FFFFFF', onDarkMute: '#A8A8A4', track: 'rgba(255,255,255,.15)' },
  dark: { bg: '#1A1A1A', ink: '#F2F2F0', mute: '#8F8F8A', soft: '#242424', line: '#2C2C2C', dark: '#F2F2F0', onDark: '#0F0F0F', onDarkMute: '#5E5E5A', track: 'rgba(0,0,0,.12)' }
};
const GOAL = '#F6C343';

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const box = (g, x, y, w, h, r, color) => { g.fillStyle = color; g.beginPath(); rr(g, x, y, w, h, r); g.fill(); };

function card(w, h, P) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  box(g, 0, 0, w, h, 26 * K, P.bg);
  g.textBaseline = 'alphabetic';
  return [c, g];
}
// Shrinks text until it fits the given width.
function fit(g, text, weight, px, maxW) {
  g.font = FONT(weight, px);
  while (g.measureText(text).width > maxW && px > 14) { px -= 2; g.font = FONT(weight, px); }
}
function text(g, s, x, y, weight, px, color, align = 'left', maxW = 0) {
  g.fillStyle = color; g.textAlign = align;
  if (maxW) fit(g, s, weight, px, maxW); else g.font = FONT(weight, px);
  g.fillText(s, x, y); g.textAlign = 'left';
}
// The small grey label in capitals, with "motio." on the right.
function header(g, W, label, P, pad) {
  g.save(); g.letterSpacing = '1px'; text(g, label.toUpperCase(), pad, pad + 24, 600, 24, P.mute); g.restore();
  text(g, 'motio.', W - pad, pad + 24, 600, 24, P.ink, 'right');
}
const ring = (g, cx, cy, r, w, pct, track, color) => {
  g.lineCap = 'round'; g.lineWidth = w;
  g.strokeStyle = track; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  if (pct > 0) { g.strokeStyle = color; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, pct)); g.stroke(); }
};

const draw = {
  // Medium · your day: time moved, km and trips, the mix of modes as one bar.
  road(D, P) {
    const W = 840, H = 400, pad = 42, [c, g] = card(W, H, P);
    header(g, W, 'Your day · ' + new Date(D.day0).toLocaleDateString('en-GB', { weekday: 'short' }), P, pad);
    text(g, D.time, pad, 190, 600, 74, P.ink, 'left', 480);
    text(g, D.dist, W - pad, 150, 500, 28, P.mute, 'right');
    text(g, D.nTrips + (D.nTrips === 1 ? ' trip' : ' trips'), W - pad, 190, 500, 28, P.mute, 'right');
    const y = 236, bw = W - 2 * pad, bh = 24;
    if (!D.modes.length) { box(g, pad, y, bw, bh, 12, P.line); text(g, 'Your trips fill this bar as you move', pad, 330, 500, 28, P.mute); return c; }
    let x = pad; const gap = 7, total = D.modes.reduce((a, m) => a + m.pct, 0) || 1, n = D.modes.length;
    g.save(); g.beginPath(); rr(g, pad, y, bw, bh, 12); g.clip();
    D.modes.forEach((m, i) => { const w = i === n - 1 ? pad + bw - x : (bw - gap * (n - 1)) * m.pct / total; g.fillStyle = m.color; g.fillRect(x, y, w, bh); x += w + gap; });
    g.restore();
    x = pad;
    for (const m of D.modes.slice(0, 3)) {
      g.fillStyle = m.color; g.beginPath(); g.arc(x + 8, 322, 8, 0, Math.PI * 2); g.fill();
      const l = m.label + ' ' + m.time; text(g, l, x + 26, 332, 600, 26, P.ink); x += 60 + g.measureText(l).width;
    }
    return c;
  },
  // Large · the Today rail: the dark card with the goal ring, the last trips, now, and three numbers.
  road_large(D, P) {
    const W = 840, H = 900, pad = 44, [c, g] = card(W, H, P);
    header(g, W, D.dateLine, P, pad);
    const dy = 96, dh = 190;
    box(g, pad, dy, W - 2 * pad, dh, 20 * K, P.dark);
    g.save(); g.letterSpacing = '1px'; text(g, 'ON THE MOVE', pad + 38, dy + 66, 600, 24, P.onDarkMute); g.restore();
    text(g, D.time, pad + 38, dy + 150, 600, 78, P.onDark, 'left', 460);
    ring(g, W - pad - 108, dy + dh / 2, 56, 26, D.pct, P.track, GOAL);
    let y = dy + dh + 70;
    const rows = D.rail.rows;
    if (!rows.length) { text(g, 'Your trips appear here as you move.', pad, y + 20, 500, 30, P.mute); y += 80; }
    for (const r of rows) {
      text(g, new Date(r.at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }), pad, y, 600, 28, P.mute);
      g.fillStyle = P.line; g.fillRect(pad + 128, y - 40, 4, 104);
      g.fillStyle = r.color; g.beginPath(); g.arc(pad + 130, y - 9, 14, 0, Math.PI * 2); g.fill();
      text(g, r.title, pad + 172, y, 600, 32, P.ink, 'left', W - pad - (pad + 172));
      text(g, r.sub, pad + 172, y + 38, 500, 28, P.mute);
      y += 104;
    }
    if (D.rail.now) {
      text(g, 'now', pad, y, 600, 28, P.ink);
      g.fillStyle = P.ink; g.beginPath(); g.arc(pad + 130, y - 9, 14, 0, Math.PI * 2); g.fill();
      text(g, D.rail.now, pad + 172, y, 500, 28, P.mute, 'left', W - pad - (pad + 172));
    }
    const tiles = [['KM', D.dist.replace(/\s*(km|mi)$/, '')], ['STEPS', D.steps], ['STREAK', D.streak + ' d']], tw = (W - 2 * pad - 2 * 19) / 3, ty = H - pad - 120;
    tiles.forEach(([l, v], i) => { const x = pad + i * (tw + 19); box(g, x, ty, tw, 120, 14 * K, P.soft); text(g, l, x + 29, ty + 46, 600, 22, P.mute); text(g, v, x + 29, ty + 94, 600, 38, P.ink, 'left', tw - 50); });
    return c;
  },
  // Medium · this week: time moved, the change against last week, a bar per day (today in the goal colour).
  week(D, P) {
    const W = 840, H = 400, pad = 42, [c, g] = card(W, H, P);
    g.save(); g.letterSpacing = '1px'; text(g, 'THIS WEEK', pad, 120, 600, 24, P.mute); g.restore();
    text(g, D.weekTime, pad, 210, 600, 66, P.ink, 'left', 400);
    const dm = D.weekDelta, sign = dm >= 0 ? '+' : '−', abs = Math.abs(dm), dl = (abs >= 60 ? Math.floor(abs / 60) + 'h ' + String(abs % 60).padStart(2, '0') + 'm' : abs + 'm');
    text(g, sign + dl + ' vs last week', pad, 266, 600, 26, dm >= 0 ? GOAL : P.mute, 'left', 400);
    const x0 = 520, bw = 34, gap = 12, bh = 134, base = 270, max = Math.max(1, ...D.bars);
    D.bars.forEach((v, i) => {
      const h = Math.max(12, Math.round(v / max * bh)), x = x0 + i * (bw + gap);
      box(g, x, base - h, bw, h, 12, i === D.todayI ? GOAL : v === max && v ? P.ink : P.line);
      text(g, D.labels[i], x + bw / 2, base + 40, 600, 22, P.mute, 'center');
    });
    return c;
  },
  persona(D, P) {
    const W = 400, H = 400, pad = 38, [c, g] = card(W, H, P);
    g.save(); g.letterSpacing = '1px'; text(g, 'THIS MONTH', pad, pad + 24, 600, 24, P.mute); g.restore();
    const words = D.persona.split(' ').filter((w) => w !== 'The'), mid = Math.ceil(words.length / 2);
    const lines = words.length > 1 ? [words.slice(0, mid).join(' '), words.slice(mid).join(' ')] : words;
    lines.forEach((l, i) => text(g, l.toLowerCase() + (i === lines.length - 1 ? '.' : ''), pad, 200 + i * 60, 600, 56, P.ink, 'left', W - 2 * pad));
    text(g, D.personaLine, pad, H - pad, 500, 26, P.mute, 'left', W - 2 * pad);
    return c;
  },
  friends(D, P) {
    const W = 840, H = 400, pad = 42, [c, g] = card(W, H, P), F = D.friends;
    header(g, W, 'This week with friends', P, pad);
    if (!F || F.n < 2) {
      text(g, 'compare your week.', pad, 220, 600, 58, P.ink, 'left', W - 2 * pad);
      text(g, F ? 'Add a friend in Motio › Social' : 'Open Social in Motio to load your friends', pad, 270, 500, 28, P.mute);
      return c;
    }
    const max = Math.max(1, ...F.rows.map((r) => r.min));
    F.rows.forEach((r, i) => {
      const y = 150 + i * 78;
      g.lineWidth = 3.6; g.strokeStyle = P.line; g.fillStyle = r.me ? P.ink : P.bg; g.beginPath(); g.arc(pad + 26, y, 26, 0, Math.PI * 2); g.fill(); if (!r.me) g.stroke();
      text(g, String(r.rank), pad + 26, y + 9, 600, 24, r.me ? P.bg : P.ink, 'center');
      text(g, r.name, pad + 74, y + 10, r.me ? 700 : 500, 30, P.ink, 'left', 200);
      box(g, 330, y - 10, 300, 20, 10, P.line);
      box(g, 330, y - 10, Math.max(20, 300 * r.min / max), 20, 10, r.me ? GOAL : P.ink);
      text(g, r.time, W - pad, y + 10, 600, 28, P.ink, 'right');
    });
    if (F.rank > 3) text(g, 'You’re #' + F.rank + ' of ' + F.n, pad, H - 30, 500, 24, P.mute);
    return c;
  },
  challenge(D, P) {
    const W = 840, H = 400, pad = 42, [c, g] = card(W, H, P), C = D.challenge;
    header(g, W, C ? 'Challenge · ' + C.left : 'Challenge', P, pad);
    if (!C) {
      text(g, 'no challenge running.', pad, 220, 600, 58, P.ink, 'left', W - 2 * pad);
      text(g, 'Start one with friends in Motio › Social', pad, 270, 500, 28, P.mute);
      return c;
    }
    text(g, C.mine + ' of ' + C.goal, pad, 180, 600, 66, P.ink, 'left', W - 2 * pad);
    box(g, pad, 214, W - 2 * pad, 22, 11, P.line);
    box(g, pad, 214, Math.max(22, (W - 2 * pad) * Math.min(1, C.pct)), 22, 11, C.pct >= 1 ? GOAL : P.ink);
    text(g, C.lead, pad, 300, 600, 30, P.ink, 'left', W - 2 * pad);
    text(g, C.n === 1 ? 'Just you so far' : C.n + ' taking part', pad, 344, 500, 26, P.mute);
    return c;
  }
};

export const KINDS = Object.keys(draw);
export const drawWidget = (kind, D, dark) => draw[kind](D, PAL[dark ? 'dark' : 'light']);
