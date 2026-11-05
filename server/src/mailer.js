import nodemailer from 'nodemailer';

// Sends real email through Brevo's HTTPS API (BREVO_API_KEY; works on hosts that block mail ports, like
// Render's free tier) or SMTP; with neither configured, messages stay in a dev outbox.
export function createMailer(env, fetchImpl = fetch) {
  const outbox = [];
  const brevo = env.BREVO_API_KEY;
  const smtp = env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS;
  const transport = smtp
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 465),
        secure: Number(env.SMTP_PORT || 465) === 465,
        auth: { user: env.SMTP_USER, pass: String(env.SMTP_PASS).replace(/\s+/g, '') } // app passwords are often pasted with spaces
      })
    : null;
  const from = env.MAIL_FROM || (smtp ? `Motio <${env.SMTP_USER}>` : 'Motio <no-reply@motio.local>');
  const [, fromName = 'Motio', fromEmail = from] = /^\s*"?([^"<]*?)"?\s*<([^>]+)>/.exec(from) || [];

  async function send(to, subject, text, html) {
    if (brevo) {
      const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': brevo, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { name: fromName.trim() || 'Motio', email: fromEmail }, to: [{ email: to }], subject, textContent: text, htmlContent: html, headers: { 'Auto-Submitted': 'auto-generated' } })
      });
      if (!res.ok) throw new Error('Brevo ' + res.status + ': ' + (await res.text()).slice(0, 200));
    } else if (transport) {
      // Standard markers for automatic mail, so out-of-office replies don't bounce back.
      await transport.sendMail({ from, to, subject, text, html, headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' } });
    } else {
      outbox.unshift({ to, subject, text, at: new Date().toISOString() });
      outbox.length = Math.min(outbox.length, 50);
      console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}\n`);
    }
  }

  const codeMail = (purpose, code, name) => {
    const intro = purpose === 'verify' ? `Welcome to Motio${name ? ', ' + name : ''}!` : 'Reset your Motio password';
    const what = purpose === 'verify' ? 'confirm your email' : 'set a new password';
    const why = purpose === 'verify' ? 'You’re getting this because this address was used to create a Motio account.' : 'You’re getting this because someone asked to reset the password for this Motio account.';
    const text = `${intro}\n\nYour code to ${what}: ${code}\n\nIt expires in 10 minutes. If this wasn't you, you can ignore this email.\n\n${why}\n— Motio`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${intro}</title></head>
<body style="margin:0;padding:24px;background:#F4F3FA;font-family:Arial,Helvetica,sans-serif;color:#1F1D47">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:440px;background:#FFFFFF;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px">
<p style="margin:0 0 8px;font-size:20px;font-weight:bold">${intro}</p>
<p style="margin:0;font-size:15px;color:#4A4770">Your code to ${what}:</p>
<p style="margin:18px 0;font-size:34px;font-weight:bold;letter-spacing:8px;color:#4B3FD8">${code}</p>
<p style="margin:0;font-size:13px;color:#6B6890">It expires in 10 minutes. If this wasn’t you, you can ignore this email.</p>
</td></tr></table>
<p style="max-width:440px;margin:14px auto 0;font-size:11px;color:#8A88A6">${why}<br>Motio</p>
</td></tr></table></body></html>`;
    return { subject: purpose === 'verify' ? `Your Motio code: ${code}` : `Your Motio password reset code: ${code}`, text, html };
  };

  return {
    mode: brevo ? 'brevo' : transport ? 'smtp' : 'dev',
    outbox,
    async sendCode(to, purpose, code, name) {
      const m = codeMail(purpose, code, name);
      await send(to, m.subject, m.text, m.html);
    },
    async sendText(to, subject, text) { await send(to, subject, text, `<pre style="font-family:system-ui;white-space:pre-wrap">${text.replace(/</g, '&lt;')}</pre>`); },
    // Checks the login once: Brevo's account endpoint, or the SMTP handshake.
    async verifyConnection() {
      if (brevo) { const r = await fetchImpl('https://api.brevo.com/v3/account', { headers: { 'api-key': brevo, Accept: 'application/json' } }); if (!r.ok) throw new Error('Brevo key rejected (' + r.status + ')'); }
      else if (transport) await transport.verify();
    }
  };
}
