// Privacy policy and terms, served at /privacy and /terms (Google Play and Health Connect need a public policy URL).
const page = (title, body, env) => ({
  type: 'text/html',
  raw: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Motio</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:32px 20px 64px;line-height:1.6;color:#1F1D47;background:#FAFAFC}h1{font-size:28px}h2{font-size:18px;margin-top:28px}a{color:#4B3FD8}small{color:#6B6890}</style>
<h1>${title}</h1><small>Last updated 2 November 2026</small>${body.replace(/CONTACT/g, contact(env))}</html>`
});
const contact = (env) => {
  const m = /<([^>]+)>/.exec(env.MAIL_FROM || '') || [null, env.FEEDBACK_TO || env.MAIL_FROM || ''];
  return m[1] ? `<a href="mailto:${m[1]}">${m[1]}</a>` : 'the address in the app’s Help screen';
};

export const legalRoutes = (env) => ({
  'GET /privacy': () => page('Privacy policy', `
<p>Motio turns your everyday movement into stats and recaps. This page explains what we collect, why, and how to delete it.</p>
<h2>What we collect</h2>
<ul>
<li><b>Account:</b> your name, email address, a hashed password, and an optional bio and profile photo.</li>
<li><b>Trips:</b> while tracking is on, your phone records location points, times, speed and the type of movement (walk, run, bike, drive, transit). Tracking only runs when you turn it on and shows a notification while it does.</li>
<li><b>Steps:</b> the step count from your phone’s motion sensor.</li>
<li><b>Settings and feedback</b> you choose to send.</li>
</ul>
<h2>How we use it</h2>
<p>Only to show you your own stats, maps, recaps and widgets, and to keep them in sync between the app and our server. We do not sell your data, show ads, or use it to profile you for anyone else.</p>
<h2>Sharing</h2>
<p>Nothing leaves Motio unless you send it: images you share, files you export, and, if you connect them, Health Connect (workouts, steps and distance written on your phone) and Strava (walks, runs and rides with their routes, uploaded to your Strava account). You can disconnect either at any time in Settings › Connected apps.</p>
<h2>Privacy zones</h2>
<p>Places you add as private zones (for example home) are hidden from maps and shared images.</p>
<h2>How long we keep it</h2>
<p>Trips are kept for the period you choose in Settings › Privacy (3 months, 1 year or forever). Deleted trips are removed from our server on the next sync.</p>
<h2>Deleting your data</h2>
<p>Settings › Privacy › Delete movement history removes all trips. Settings › Privacy › Delete account removes your account and everything in it from our server immediately. You can also ask us at CONTACT.</p>
<h2>Security</h2>
<p>Passwords are stored as salted scrypt hashes. Sign-in sessions expire after 30 days. Data travels over HTTPS.</p>
<h2>Children</h2>
<p>Motio isn’t meant for children under 13.</p>
<h2>Contact</h2>
<p>Questions about your data: CONTACT.</p>`, env),
  'GET /terms': () => page('Terms of use', `
<p>By creating a Motio account you agree to these terms.</p>
<h2>The service</h2>
<p>Motio estimates distances, speeds, steps and movement types from your phone’s sensors. These numbers are estimates and are not medical or safety advice. Don’t use the app while driving.</p>
<h2>Your account</h2>
<p>Keep your password private. You’re responsible for activity on your account. You can delete it at any time in Settings › Privacy.</p>
<h2>Your content</h2>
<p>Your trips and recaps are yours. You let us store and process them only to run the service for you.</p>
<h2>Fair use</h2>
<p>Don’t misuse the service, try to access other people’s data, or overload our servers.</p>
<h2>Changes</h2>
<p>We may update these terms and will say so in the app when we do. Questions: CONTACT.</p>`, env)
});
