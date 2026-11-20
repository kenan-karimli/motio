// Draws the home screen widgets as PNG images. Same colours and layout as the previews in Settings › Widgets.
const INK = '#1F1D47';
const FONT = (w, px) => `${w} ${px}px Poppins, sans-serif`;

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function card(w, h, bg) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.beginPath(); rr(g, 0, 0, w, h, 56); g.fillStyle = bg; g.fill();
  g.textBaseline = 'alphabetic';
  return [c, g];
}
// Shrinks text until it fits the given width.
function fit(g, text, weight, px, maxW) {
  g.font = FONT(weight, px);
  while (g.measureText(text).width > maxW && px > 14) { px -= 2; g.font = FONT(weight, px); }
}

// Ring, steps, streak and the compact bar are drawn natively (MotioWidget.java), so they stay right with Motio closed.
const draw = {
  persona(D) {
    const [c, g] = card(400, 400, INK);
    g.fillStyle = '#F6C343'; g.font = FONT(600, 22); g.fillText('THIS MONTH', 40, 72);
    g.fillStyle = '#FFFFFF';
    const words = D.persona.split(' ').filter((w) => w !== 'The');
    const mid = Math.ceil(words.length / 2);
    const lines = words.length > 1 ? [words.slice(0, mid).join(' '), words.slice(mid).join(' ')] : words;
    lines.forEach((l, i) => { fit(g, l, 700, 56, 320); g.fillText(l, 40, 180 + i * 64); });
    g.font = FONT(500, 24); g.globalAlpha = 0.75; g.fillText(D.personaLine, 40, 350);
    return c;
  },
  road(D) {
    const [c, g] = card(840, 400, '#FFFFFF');
    g.fillStyle = INK; fit(g, D.dist, 700, 64, 420); g.fillText(D.dist, 44, 104);
    g.font = FONT(500, 26); g.fillStyle = '#6B6890'; g.fillText(D.time + ' today', 44, 146);
    // 6 AM → midnight on one road; each trip is drawn where it happened.
    const x0 = 60, x1 = 780, y = 250, span = 18 * 3600000, t6 = D.day0 + 6 * 3600000;
    const xAt = (t) => x0 + (x1 - x0) * Math.max(0, Math.min(1, (t - t6) / span));
    g.lineCap = 'round'; g.lineWidth = 34; g.strokeStyle = '#EEF0F6'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    for (const t of D.trips) { g.strokeStyle = t.color; g.beginPath(); g.moveTo(xAt(t.start), y); g.lineTo(Math.max(xAt(t.start) + 2, xAt(t.end)), y); g.stroke(); }
    g.fillStyle = '#9A97B5'; g.font = FONT(600, 20);
    [['6 AM', 0], ['NOON', 6], ['6 PM', 12], ['12 AM', 18]].forEach(([l, h], i) => { g.textAlign = i === 0 ? 'left' : i === 3 ? 'right' : 'center'; g.fillText(l, x0 + (x1 - x0) * h / 18 + (i === 0 ? -16 : i === 3 ? 16 : 0), y + 54); });
    g.textAlign = 'left'; let lx = 44;
    for (const m of D.modes.slice(0, 4)) {
      g.fillStyle = m.color; g.beginPath(); g.arc(lx + 9, 352, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = INK; g.font = FONT(500, 22); g.fillText(m.label, lx + 26, 360); lx += 52 + g.measureText(m.label).width;
    }
    if (!D.modes.length) { g.fillStyle = '#6B6890'; g.font = FONT(500, 22); g.fillText('Your trips appear on the road as you move', 44, 360); }
    return c;
  },
  week(D) {
    const [c, g] = card(840, 560, '#FFFFFF');
    g.fillStyle = '#6B6890'; g.font = FONT(600, 26); g.fillText('This week', 44, 76);
    g.fillStyle = INK; fit(g, D.weekDist, 700, 66, 460); g.fillText(D.weekDist, 44, 150);
    g.font = FONT(600, 24); g.fillStyle = D.weekUp ? '#2FA84D' : '#C2412F'; g.fillText(D.weekVs, 44, 192);
    g.textAlign = 'right'; g.fillStyle = '#6B6890'; g.font = FONT(500, 24); g.fillText(D.peak ? 'Peak ' + D.peak : '', 796, 76); g.textAlign = 'center';
    const max = Math.max(1, ...D.bars), bw = 64, gap = (752 - 7 * bw) / 6;
    D.bars.forEach((v, i) => {
      const h = v ? Math.max(14, Math.round(v / max * 230)) : 10, x = 44 + i * (bw + gap);
      g.fillStyle = i === D.todayI ? '#F2766B' : v === max && v ? '#5B4FE0' : '#C9C5EC';
      g.beginPath(); rr(g, x, 480 - h, bw, h, 14); g.fill();
      g.fillStyle = i === D.todayI ? INK : '#6B6890'; g.font = FONT(i === D.todayI ? 700 : 500, 22); g.fillText(D.labels[i], x + bw / 2, 520);
    });
    return c;
  },
  friends(D) {
    const [c, g] = card(840, 400, '#FFFFFF'), F = D.friends;
    g.fillStyle = '#6B6890'; g.font = FONT(600, 26); g.fillText('This week with friends', 44, 72);
    if (!F || F.n < 2) {
      g.fillStyle = INK; fit(g, 'Compare your week', 700, 56, 740); g.fillText('Compare your week', 44, 210);
      g.fillStyle = '#6B6890'; g.font = FONT(500, 26); g.fillText(F ? 'Add a friend in Motio › Social' : 'Open Social in Motio to load your friends', 44, 258);
      return c;
    }
    const max = Math.max(1, ...F.rows.map((r) => r.min));
    F.rows.forEach((r, i) => {
      const y = 140 + i * 76, col = r.me ? '#F2766B' : r.rank === 1 ? '#5B4FE0' : '#C9C5EC';
      g.fillStyle = col; g.beginPath(); g.arc(68, y, 24, 0, Math.PI * 2); g.fill();
      g.fillStyle = r.me || r.rank === 1 ? '#FFFFFF' : INK; g.font = FONT(700, 22); g.textAlign = 'center'; g.fillText(String(r.rank), 68, y + 8);
      g.textAlign = 'left'; g.fillStyle = INK; fit(g, r.name, r.me ? 700 : 500, 28, 210); g.fillText(r.name, 108, y + 10);
      g.fillStyle = '#EEF0F6'; g.beginPath(); rr(g, 340, y - 9, 290, 18, 9); g.fill();
      g.fillStyle = col; g.beginPath(); rr(g, 340, y - 9, Math.max(18, 290 * r.min / max), 18, 9); g.fill();
      g.fillStyle = INK; g.font = FONT(600, 26); g.textAlign = 'right'; g.fillText(r.time, 796, y + 10); g.textAlign = 'left';
    });
    if (F.rank > 3) { g.fillStyle = '#6B6890'; g.font = FONT(500, 22); g.fillText('You’re #' + F.rank + ' of ' + F.n, 44, 372); }
    return c;
  },
  challenge(D) {
    const [c, g] = card(840, 400, '#F6C343'), C = D.challenge;
    g.fillStyle = INK; g.globalAlpha = 0.7; g.font = FONT(600, 24); g.fillText(C ? 'CHALLENGE · ' + C.left.toUpperCase() : 'CHALLENGE', 44, 72); g.globalAlpha = 1;
    if (!C) {
      fit(g, 'No challenge running', 700, 56, 740); g.fillText('No challenge running', 44, 210);
      g.font = FONT(500, 26); g.fillText('Start one with friends in Motio › Social', 44, 258);
      return c;
    }
    fit(g, C.mine + ' of ' + C.goal, 700, 72, 752); g.fillText(C.mine + ' of ' + C.goal, 44, 168);
    g.fillStyle = 'rgba(31,29,71,0.15)'; g.beginPath(); rr(g, 44, 204, 752, 26, 13); g.fill();
    g.fillStyle = INK; g.beginPath(); rr(g, 44, 204, Math.max(26, 752 * Math.min(1, C.pct)), 26, 13); g.fill();
    fit(g, C.lead, 600, 28, 752); g.fillText(C.lead, 44, 300);
    g.globalAlpha = 0.7; g.font = FONT(500, 22); g.fillText(C.n === 1 ? 'Just you so far' : C.n + ' taking part', 44, 342);
    return c;
  }
};

export const KINDS = Object.keys(draw);
export const drawWidget = (kind, D) => draw[kind](D);
