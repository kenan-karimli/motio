// Sends one test code email: npm run mail-test -- you@example.com
import { readFileSync, existsSync } from 'node:fs';
import { createMailer } from './mailer.js';

if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
const to = process.argv[2];
if (!to) { console.error('Usage: npm run mail-test -- you@example.com'); process.exit(1); }
const mailer = createMailer(process.env);
if (mailer.mode === 'dev') { console.error('No email settings in .env yet (BREVO_API_KEY or SMTP_*).'); process.exit(1); }
await mailer.verifyConnection();
await mailer.sendCode(to, 'verify', '123456', 'Test');
console.log('Sent a test email to ' + to + ' from ' + (process.env.MAIL_FROM || process.env.SMTP_USER));
