// Draws the Motio 5.0 icon (Tuli, Motio's fox, white on near-black) as Android vector drawables (sharp at any
// size), and renders the legacy PNG icons and the pre-Android-12 launch screen from assets/logo-full.svg.
import sharp from 'sharp';
import { writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';

const res = 'android/app/src/main/res';
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const INK = '#141414', LIGHT = '#ECECEA';

// Tuli from src/tuli.js (viewBox 28 6 96 110), placed inside the 66-unit safe zone of the 108-unit adaptive icon.
const S = 0.6, TX = 6, TY = 15.5;
const FOX = [
  ['M82,104 C104,106 117,92 110,70 C106,84 96,92 82,94 Z', 'F'],
  ['M110,70 C115,79 114,88 108,95 C105,86 105,78 110,70 Z', 'D'],
  ['M44,109 C40,86 44,66 58,58 C66,54 76,58 80,68 C86,82 86,98 82,109 Z', 'F'],
  ['M58,62 C55,75 58,87 64,93 C66,80 68,68 70,62 Z', 'D'],
  ['M58,38 L61,18 L70,32 Z', 'F'], ['M67,33 L75,19 L78,37 Z', 'F'],
  ['M52,61 C48,49 52,39 60,35 L69,31 L77,36 C85,40 93,44 99,50 C93,55 85,57 77,57 C71,63 61,65 52,61 Z', 'F'],
  ['M71.4,44 a2.6,2.6 0 1,0 5.2,0 a2.6,2.6 0 1,0 -5.2,0 Z', 'D']
];
const LEGS = 'M60,109 L60,94 M72,109 L72,94';
const head = '<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n';
const fox = (light, dark) => `    <group android:scaleX="${S}" android:scaleY="${S}" android:translateX="${TX}" android:translateY="${TY}">\n` +
  FOX.map(([d, k]) => `        <path android:pathData="${d}" android:fillColor="${k === 'F' ? light : dark}"/>\n`).join('') +
  `        <path android:pathData="${LEGS}" android:strokeColor="${dark}" android:strokeWidth="2.5" android:strokeLineCap="round" android:fillColor="#00000000"/>\n    </group>\n`;

writeFileSync(`${res}/drawable/ic_launcher_foreground.xml`, head + fox('#FFFFFF', INK) + '</vector>\n');
writeFileSync(`${res}/drawable/ic_launcher_monochrome.xml`, head + fox('#FFFFFF', '#00000000') + '</vector>\n');
writeFileSync(`${res}/drawable/ic_launcher_background.xml`, head + `    <path android:pathData="M0,0h108v108h-108z" android:fillColor="${INK}"/>\n</vector>\n`);
for (const f of ['drawable-v24/ic_launcher_foreground.xml', 'values/ic_launcher_background.xml']) if (existsSync(`${res}/${f}`)) rmSync(`${res}/${f}`);
const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@drawable/ic_launcher_background"/>\n    <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n</adaptive-icon>\n';
writeFileSync(`${res}/mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
writeFileSync(`${res}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptive);

// The same art as an SVG (also kept as assets/logo-full.svg for the store listing and the website).
const svgFox = (light, dark) => `<g transform="translate(${TX} ${TY}) scale(${S})">` + FOX.map(([d, k]) => `<path d="${d.replace(/,/g, ' ')}" fill="${k === 'F' ? light : dark}"/>`).join('') +
  `<path d="${LEGS.replace(/,/g, ' ')}" stroke="${dark}" stroke-width="2.5" stroke-linecap="round"/></g>`;
const full = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="21 21 66 66"><rect x="0" y="0" width="108" height="108" fill="${INK}"/>${svgFox('#FFFFFF', INK)}</svg>`);
writeFileSync('assets/logo-full.svg', full);

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

// Pre-Android-12 launch screen: the app's light grey with the icon in the middle.
const mark = async (size) => sharp(full, { density: 384 }).resize(size, size).composite([{ input: squircleMask(size), blend: 'dest-in' }]).png().toBuffer();
const splash = async (w, h) => sharp({ create: { width: w, height: h, channels: 4, background: LIGHT } })
  .composite([{ input: await mark(Math.round(Math.min(w, h) * 0.3)), gravity: 'centre' }]).png();
await (await splash(480, 800)).toFile(`${res}/drawable/splash.png`);
for (const [d, k] of Object.entries(densities)) {
  await (await splash(Math.round(320 * k), Math.round(480 * k))).toFile(`${res}/drawable-port-${d}/splash.png`);
  await (await splash(Math.round(480 * k), Math.round(320 * k))).toFile(`${res}/drawable-land-${d}/splash.png`);
}
console.log('vector icon + legacy PNGs + splash written');
