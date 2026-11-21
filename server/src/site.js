// The Motio website: the landing page at /, its images under /site/, a short download link, a no-cookie
// count of page views and downloads, the iPhone waitlist and the "Report a problem" form. Both forms are stored and
// emailed to the Motio inbox. Stats and lists are for ADMIN_TOKEN holders only.
import { readFileSync, existsSync } from 'node:fs';
import { isAdmin } from './announce.js';

const DOWNLOAD = 'https://github.com/kenan-karimli/motio/releases/latest/download/motio.apk';
// GitHub's release feed, not its API: the API limits requests per IP, and hosting IPs are shared.
const FEED = 'https://github.com/kenan-karimli/motio/releases.atom';
const TYPES = { jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' };
const INBOX = 'noreply.motio@gmail.com';
const validEmail = (e) => e.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e);

export async function siteRoutes({ db, env, now, fetchImpl, mailer, HttpError, bad }) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS site_stats (day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, kind));
    CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, platform TEXT NOT NULL, created_at BIGINT NOT NULL);
    ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS name TEXT;
    CREATE TABLE IF NOT EXISTS site_messages (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at BIGINT NOT NULL);
  `);
  // The same checks the page makes, repeated here because the page can be skipped.
  const person = (body) => {
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    const email = String(body.email || '').trim().toLowerCase();
    if (!name) throw bad('name_missing', 'Enter your name.');
    if (name.length > 60) throw bad('name_long', 'Keep your name under 60 characters.');
    if (!validEmail(email)) throw bad('email_invalid', 'Enter a valid email address.');
    return { name, email };
  };
  // Stored first, so a mail outage never loses a message.
  const notify = (subject, text) => mailer.sendText(INBOX, subject, text).catch((e) => console.error('[site] mail failed:', e.message));
  const q = {
    hit: db.prepare('INSERT INTO site_stats (day, kind, n) VALUES (?, ?, 1) ON CONFLICT (day, kind) DO UPDATE SET n = site_stats.n + 1'),
    stats: db.prepare('SELECT day, kind, n FROM site_stats WHERE day >= ? ORDER BY day'),
    say: db.prepare('INSERT INTO site_messages (name, email, message, created_at) VALUES (?, ?, ?, ?)'),
    join: db.prepare('INSERT INTO waitlist (email, platform, created_at, name) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO UPDATE SET name = COALESCE(excluded.name, waitlist.name)'),
    list: db.prepare('SELECT name, email, platform, created_at FROM waitlist ORDER BY created_at DESC'),
    waiting: db.prepare('SELECT platform, COUNT(*)::int AS n FROM waitlist GROUP BY platform')
  };
  const page = readFileSync(new URL('./site.html', import.meta.url), 'utf8');
  const day = () => new Date(now()).toISOString().slice(0, 10);
  // Crawlers and link-preview bots don't count as visits.
  const human = (req) => !/bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slurp|curl|wget|uptime/i.test(String(req.headers['user-agent'] || ''));
  const count = (req, kind) => { if (human(req)) q.hit.run(day(), kind).catch(() => {}); };

  // Newest release (version, size, date), cached for 10 minutes so visitors never wait on GitHub.
  let rel = null, relAt = 0;
  async function release() {
    if (now() - relAt < 600000) return rel;
    relAt = now();
    try {
      const feed = await (await fetchImpl(FEED)).text();
      const m = /<entry>[\s\S]*?<updated>(\d{4}-\d\d-\d\d)[\s\S]*?releases\/tag\/v([\d.]+)"/.exec(feed);
      const head = await fetchImpl(DOWNLOAD, { method: 'HEAD', redirect: 'follow' });
      const size = Number(head.headers.get('content-length'));
      // The newest entry's notes ("- " lines become <li>s in the feed's escaped HTML).
      const entry = (/<entry>([\s\S]*?)<\/entry>/.exec(feed) || [])[1] || '';
      const html = ((/<content[^>]*>([\s\S]*?)<\/content>/.exec(entry) || [])[1] || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      const decode = (t) => t.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      // Inside each item, text entities (&#39; and the like) are decoded once; the page escapes it again safely.
      const notes = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => decode(x[1].replace(/<[^>]+>/g, '')).trim()).filter(Boolean).slice(0, 6);
      if (m && size > 0) rel = { version: m[2], mb: (size / 1048576).toFixed(1), date: m[1], notes };
    } catch { /* keep the last known release */ }
    return rel;
  }

  const routes = {
    'GET /': async ({ req }) => {
      count(req, 'view');
      const r = await release();
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      const attrs = r ? `data-version="${esc(r.version)}" data-mb="${r.mb}" data-date="${r.date}"` : '';
      const notes = r && r.notes.length ? r.notes.map((n) => `<li>${esc(n)}</li>`).join('') : '';
      const waiting = (await q.waiting.all()).reduce((a, x) => a + x.n, 0);
      return { type: 'text/html', raw: page.replace('data-release=""', attrs).replace('<!--NOTES-->', notes).replace('data-waiting="0"', `data-waiting="${waiting}"`) };
    },
    'GET /download': async ({ req }) => { count(req, 'download'); return { redirect: DOWNLOAD }; },
    // Images for the page, from server/src/site/ (names only: no paths).
    'GET /site': async ({ url }) => {
      const name = url.pathname.slice(6);
      const ext = name.split('.').pop();
      const file = new URL('./site/' + name, import.meta.url);
      if (!/^[a-z0-9-]+\.(jpg|png|svg)$/.test(name) || !existsSync(file)) throw new HttpError(404, 'not_found', 'Not found');
      return { type: TYPES[ext], raw: readFileSync(file), cache: 'public, max-age=86400' };
    },
    'POST /v1/waitlist': async ({ body }) => {
      const { name, email } = person(body);
      const platform = body.platform === 'ios' ? 'ios' : 'other';
      await q.join.run(email, platform, now(), name);
      notify(`Motio iPhone sign-up: ${name}`, `${name} <${email}> joined the iPhone list (${platform}).`);
      return { ok: true, waiting: (await q.waiting.all()).reduce((a, x) => a + x.n, 0) };
    },
    // "Report a problem" on the website.
    'POST /v1/contact': async ({ body }) => {
      const { name, email } = person(body);
      const message = String(body.message || '').trim();
      if (message.length < 10) throw bad('message_short', 'Describe the problem in at least 10 characters.');
      if (message.length > 2000) throw bad('message_long', 'Keep it under 2000 characters.');
      await q.say.run(name, email, message, now());
      notify(`Motio problem report from ${name}`, `From: ${name} <${email}>\n\n${message}`);
      return { ok: true };
    },
    // Everyone on the iPhone list, newest first (admin only: these are people's emails).
    'GET /v1/admin/waitlist': async ({ req }) => {
      if (!isAdmin(req, env)) throw new HttpError(401, 'unauthorized', 'Wrong admin token.');
      return { people: (await q.list.all()).map((p) => ({ name: p.name, email: p.email, platform: p.platform, at: new Date(Number(p.created_at)).toISOString() })) };
    },
    'GET /v1/admin/stats': async ({ req }) => {
      if (!isAdmin(req, env)) throw new HttpError(401, 'unauthorized', 'Wrong admin token.');
      const since = new Date(now() - 30 * 86400000).toISOString().slice(0, 10);
      const days = {};
      for (const r of await q.stats.all(since)) (days[r.day] = days[r.day] || { view: 0, download: 0 })[r.kind] = r.n;
      return { days, waitlist: Object.fromEntries((await q.waiting.all()).map((r) => [r.platform, r.n])) };
    }
  };
  // The newest release, for the notification inbox (not a route, so it isn't spread into the router).
  Object.defineProperty(routes, 'latest', { value: release, enumerable: false });
  return routes;
}
