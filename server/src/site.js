// The Motio website: the landing page at / and a short download link that always points at the newest APK.
import { readFileSync } from 'node:fs';

const DOWNLOAD = 'https://github.com/kenan-karimli/motio/releases/latest/download/motio.apk';

export function siteRoutes() {
  const html = readFileSync(new URL('./site.html', import.meta.url), 'utf8');
  return {
    'GET /': async () => ({ type: 'text/html', raw: html }),
    'GET /download': async () => ({ redirect: DOWNLOAD })
  };
}
