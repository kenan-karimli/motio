// Draws the home screen widgets as PNG images. Same colours and layout as the previews in Settings › Widgets.
const INK = '#1F1D47';
const FONT = (w, px) => `${w} ${px}px Poppins, sans-serif`;

function card(w, h, bg) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.beginPath(); g.roundRect(0, 0, w, h, 56); g.fillStyle = bg; g.fill();
  g.textBaseline = 'alphabetic';
  return [c, g];
}
// Shrinks text until it fits the given width.
function fit(g, text, weight, px, maxW) {
  g.font = FONT(weight, px);
  while (g.measureText(text).width > maxW && px > 14) { px -= 2; g.font = FONT(weight, px); }
}

const draw = {
  ring(D) {
    const [c, g] = card(400, 400, '#4B3FD8');
    g.lineCap = 'round'; g.lineWidth = 30;
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(200, 200, 150, 0, Math.PI * 2); g.stroke();
    if (D.pct > 0) { g.strokeStyle = '#F6C343'; g.beginPath(); g.arc(200, 200, 150, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, D.pct)); g.stroke(); }
    g.fillStyle = '#FFFFFF'; g.textAlign = 'center';
    fit(g, D.time, 700, 66, 230); g.fillText(D.time, 200, 210);
    g.font = FONT(500, 26); g.globalAlpha = 0.8; g.fillText('of ' + D.goal, 200, 252);
    return c;
  },
  steps(D) {
    const [c, g] = card(400, 400, '#3DBF5C');
    g.fillStyle = INK;
    g.beginPath(); g.ellipse(64, 70, 12, 18, -0.2, 0, Math.PI * 2); g.ellipse(94, 98, 12, 18, 0.2, 0, Math.PI * 2); g.fill();
    fit(g, D.steps, 700, 84, 330); g.fillText(D.steps, 40, 248);
    g.font = FONT(500, 26); g.fillText('steps · ' + Math.round(D.stepPct * 100) + '% of ' + D.stepGoalK + 'k', 40, 292);
    g.fillStyle = 'rgba(31,29,71,0.18)'; g.beginPath(); g.roundRect(40, 330, 320, 18, 9); g.fill();
    g.fillStyle = INK; g.beginPath(); g.roundRect(40, 330, Math.max(18, 320 * Math.min(1, D.stepPct)), 18, 9); g.fill();
    return c;
  },
  streak(D) {
    const [c, g] = card(400, 400, '#F2766B');
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(70, 112); g.bezierCurveTo(40, 80, 64, 50, 78, 34); g.bezierCurveTo(84, 60, 108, 62, 104, 92); g.bezierCurveTo(102, 108, 88, 118, 70, 112); g.fill();
    fit(g, String(D.streak), 700, 132, 320); g.fillText(String(D.streak), 40, 270);
    g.font = FONT(600, 28); g.fillText(D.streak === 1 ? 'day moving' : 'days moving', 40, 316);
    g.font = FONT(500, 24); g.globalAlpha = 0.75; g.fillText('in a row', 40, 350);
    return c;
  },
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
      g.beginPath(); g.roundRect(x, 480 - h, bw, h, 14); g.fill();
      g.fillStyle = i === D.todayI ? INK : '#6B6890'; g.font = FONT(i === D.todayI ? 700 : 500, 22); g.fillText(D.labels[i], x + bw / 2, 520);
    });
    return c;
  }
};

export const KINDS = Object.keys(draw);
export const drawWidget = (kind, D) => draw[kind](D);
