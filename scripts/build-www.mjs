// Bundles the designed screens, runtime, fonts and logo into www/ for Capacitor.
import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
mkdirSync('www/fonts', { recursive: true });

const sources = {};
for (const f of readdirSync('design').filter((f) => f.endsWith('.dc.html'))) {
  sources[f.replace('.dc.html', '')] = readFileSync('design/' + f, 'utf8');
}
// Fail the build if any screen's logic doesn't even parse (a broken screen would just be blank in the app).
for (const [name, src] of Object.entries(sources)) {
  const i = src.indexOf('class Component');
  if (i < 0) continue;
  try { new Function('DCLogic', src.slice(i, src.lastIndexOf('</script>')) + '; return Component'); }
  catch (e) { console.error(`design/${name}.dc.html: ${e.message}`); process.exit(1); }
}
writeFileSync('www/dc-sources.js', 'window.__DC_SOURCES=' + JSON.stringify(sources) + ';window.__MOTIO_API=' + JSON.stringify(process.env.MOTIO_API || 'http://localhost:8787') + ';');

const fonts = [['poppins', 'Poppins', [400, 500, 600, 700]], ['space-mono', 'Space Mono', [400, 700]]];
let css = '';
for (const [pkg, family, weights] of fonts) {
  for (const w of weights) {
    const file = `${pkg}-latin-${w}-normal.woff2`;
    copyFileSync(`node_modules/@fontsource/${pkg}/files/${file}`, 'www/fonts/' + file);
    css += `@font-face{font-family:'${family}';font-weight:${w};font-style:normal;font-display:swap;src:url(fonts/${file}) format('woff2')}\n`;
  }
}
writeFileSync('www/fonts.css', css);
copyFileSync('src/index.html', 'www/index.html');
copyFileSync('node_modules/leaflet/dist/leaflet.css', 'www/leaflet.css');

await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'chrome100', outfile: 'www/app.js', logLevel: 'info' });
console.log('www ready:', Object.keys(sources).length, 'screens');
