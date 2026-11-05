// Draws the Motio logo as Android vector drawables (sharp at any size) and renders the legacy PNG icons.
import sharp from 'sharp';
import { writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';

const res = 'android/app/src/main/res';
const full = readFileSync('assets/logo-full.svg');
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// The logo lives on a 1024 grid; adaptive icons use a 108 grid whose safe zone is the middle 66.
const g = (n) => +(n * 108 / 1024).toFixed(2);
const fgX = (x) => g((x - 512) * 0.62 + 512);
const fgY = (y) => g((y - 480) * 0.62 + 512);
const fgR = (r) => g(r * 0.62);

const curve = `M${fgX(182)},${fgY(640)} C${fgX(300)},${fgY(640)} ${fgX(300)},${fgY(330)} ${fgX(512)},${fgY(330)} C${fgX(724)},${fgY(330)} ${fgX(724)},${fgY(640)} ${fgX(842)},${fgY(640)}`;
const dot = (cx, cy, r) => `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 z`;
const star = (() => {
  // sparkle: centre (232,282), arms 14 wide and 32 tall in logo units
  const cx = 232, cy = 282, a = 52, b = 22;
  const pts = [[cx, cy - a], [cx + b, cy - b], [cx + a, cy], [cx + b, cy + b], [cx, cy + a], [cx - b, cy + b], [cx - a, cy], [cx - b, cy - b]];
  return 'M' + pts.map(([x, y]) => `${fgX(x)},${fgY(y)}`).join(' L') + ' z';
})();
const head = '<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n';
const strokeW = fgR(84);

const art = (c1, c2, c3) =>
  `    <path android:pathData="${curve}" android:strokeColor="${c1}" android:strokeWidth="${strokeW}" android:strokeLineCap="round" android:fillColor="#00000000"/>\n` +
  `    <path android:pathData="${dot(fgX(842), fgY(640), fgR(62))}" android:fillColor="${c2}"/>\n` +
  `    <path android:pathData="${star}" android:fillColor="${c3}"/>\n`;

writeFileSync(`${res}/drawable/ic_launcher_foreground.xml`, head + art('#F6C343', '#F2766B', '#FFFFFF') + '</vector>\n');
writeFileSync(`${res}/drawable/ic_launcher_monochrome.xml`, head + art('#FFFFFF', '#FFFFFF', '#FFFFFF') + '</vector>\n');
writeFileSync(`${res}/drawable/ic_launcher_background.xml`, head +
  '    <path android:pathData="M0,0h108v108h-108z" android:fillColor="#4B3FD8"/>\n' +
  `    <path android:pathData="${dot(g(860), g(160), g(360))}" android:fillColor="#5649E4"/>\n` +
  `    <path android:pathData="${dot(g(120), g(940), g(260))}" android:fillColor="#5649E4"/>\n` +
  '</vector>\n');
for (const f of ['drawable-v24/ic_launcher_foreground.xml', 'values/ic_launcher_background.xml']) if (existsSync(`${res}/${f}`)) rmSync(`${res}/${f}`);
const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@drawable/ic_launcher_background"/>\n    <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n</adaptive-icon>\n';
writeFileSync(`${res}/mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
writeFileSync(`${res}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptive);

// Legacy PNGs only serve Android 7 (API 24-25); newer phones use the vector icon above.
const roundMask = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);
const squircleMask = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${s * 0.22}"/></svg>`);
for (const [d, k] of Object.entries(densities)) {
  const dir = `${res}/mipmap-${d}`;
  const size = Math.round(48 * k);
  const base = await sharp(full, { density: 384 }).resize(size, size).png().toBuffer();
  await sharp(base).composite([{ input: squircleMask(size), blend: 'dest-in' }]).png().toFile(`${dir}/ic_launcher.png`);
  await sharp(base).composite([{ input: roundMask(size), blend: 'dest-in' }]).png().toFile(`${dir}/ic_launcher_round.png`);
  if (existsSync(`${dir}/ic_launcher_foreground.png`)) rmSync(`${dir}/ic_launcher_foreground.png`);
}

// Pre-Android-12 launch screen: Motio purple with the logo mark in the middle.
const mark = async (size) => sharp(full, { density: 384 }).resize(size, size).composite([{ input: squircleMask(size), blend: 'dest-in' }]).png().toBuffer();
const splash = async (w, h) => sharp({ create: { width: w, height: h, channels: 4, background: '#4B3FD8' } })
  .composite([{ input: await mark(Math.round(Math.min(w, h) * 0.4)), gravity: 'centre' }]).png();
await (await splash(480, 800)).toFile(`${res}/drawable/splash.png`);
for (const [d, k] of Object.entries(densities)) {
  await (await splash(Math.round(320 * k), Math.round(480 * k))).toFile(`${res}/drawable-port-${d}/splash.png`);
  await (await splash(Math.round(480 * k), Math.round(320 * k))).toFile(`${res}/drawable-land-${d}/splash.png`);
}
console.log('vector icon + legacy PNGs + splash written');
