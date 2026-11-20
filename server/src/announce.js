// Announcements: one email to every verified user (e.g. "a new version is out"). Locked with ADMIN_TOKEN,
// which only exists in the server's environment; without it the route doesn't exist.
// Each (key, user) is recorded, so re-running the same announcement (after Brevo's daily limit, or a failure)
// only emails the people who haven't had it yet.
import { createHash, timingSafeEqual } from 'node:crypto';

const sha = (s) => createHash('sha256').update(String(s)).digest();

export async function announceRoutes({ db, env, mailer, HttpError, bad }) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS announced (
      key TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (key, user_id)
    );
  `);
  const q = {
    pending: db.prepare('SELECT u.id, u.email, u.name FROM users u WHERE u.verified = 1 AND NOT EXISTS (SELECT 1 FROM announced a WHERE a.key = ? AND a.user_id = u.id) ORDER BY u.id LIMIT ?'),
    mark: db.prepare('INSERT INTO announced (key, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
  };
  const token = String(env.ADMIN_TOKEN || '');
  if (token.length < 24) return {};

  return {
    // Body: { key, subject, text, limit?, send? }. Without send: true it only counts who would get it.
    // {name} in the text becomes each person's first name.
    'POST /v1/admin/announce': async ({ req, body }) => {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
      if (!m || !timingSafeEqual(sha(m[1]), sha(token))) throw new HttpError(401, 'unauthorized', 'Wrong admin token.');
      const key = String(body.key || '').trim(), subject = String(body.subject || '').trim(), text = String(body.text || '');
      if (!/^[\w.-]{3,40}$/.test(key)) throw bad('key_invalid', 'Give the announcement a short key, like "v3.6".');
      if (!subject || !text.trim()) throw bad('empty', 'Subject and text are required.');
      const limit = Math.min(Math.max(1, Number(body.limit) || 280), 1000);
      const people = await q.pending.all(key, limit);
      if (!body.send) return { wouldSend: people.length, sample: people.slice(0, 3).map((p) => p.email.replace(/^(.).*@/, '$1…@')) };
      let sent = 0;
      const failed = [];
      for (const p of people) {
        try {
          await mailer.sendText(p.email, subject, text.replace(/\{name\}/g, String(p.name || '').split(' ')[0] || 'there'));
          await q.mark.run(key, p.id);
          sent++;
        } catch (e) { failed.push(p.id); if (failed.length >= 5) break; } // the mail service is refusing: stop and retry later
      }
      return { sent, failed: failed.length, remaining: (await q.pending.all(key, 100000)).length };
    }
  };
}
