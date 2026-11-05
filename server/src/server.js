import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { openDb } from './db.js';
import { createMailer } from './mailer.js';
import { createApp } from './app.js';

// Minimal .env loader so the server runs without extra packages.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

const env = process.env;
// DATABASE_URL (Postgres, e.g. Neon) in production; a local PGlite folder otherwise.
// Hosts like Render wipe local files on restart, so production refuses to run without a real database.
if (env.NODE_ENV === 'production' && !env.DATABASE_URL) { console.error('DATABASE_URL is required in production.'); process.exit(1); }
const db = await openDb(env.DATABASE_URL || env.DB_PATH || './data/pg');
const mailer = createMailer(env);
const server = createServer(await createApp({ db, mailer }));
const port = Number(env.PORT || 8787);
// Check the SMTP login once at start, so a wrong key shows up here and not as failed sign-ups.
if (mailer.mode !== 'dev') mailer.verifyConnection().then(() => console.log('[mail] ' + mailer.mode + ' login OK')).catch((e) => console.error('[mail] SMTP login FAILED:', e.message));
server.listen(port, '0.0.0.0', () => {
  console.log(`Motio API on http://localhost:${port} · mail: ${mailer.mode}${mailer.mode === 'dev' ? ` (see http://localhost:${port}/dev/outbox)` : ''}`);
});
