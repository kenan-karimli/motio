# Launching Motio

The app and server are ready. These steps need accounts in your name, so you do them; each says exactly what to copy where.

## 1. Email with Brevo (free, 300 emails a day)

1. Create an account at brevo.com.
2. **Senders, domains & dedicated IPs › Senders**: add the address emails should come from (for example your Gmail) and confirm it from your inbox.
3. **Settings › SMTP & API › SMTP**: note the *Login* (looks like `8a1b2c001@smtp-brevo.com`) and click **Generate a new SMTP key**.
4. Copy `server/.env.example` to `server/.env` and fill in:
   ```
   SMTP_USER=<the Login from step 3>
   SMTP_PASS=<the SMTP key>
   MAIL_FROM="Motio <the sender you confirmed in step 2>"
   ```
5. Check it works:
   ```bash
   cd server && npm run mail-test -- you@example.com
   ```
6. Restart the server. Its first line says `[mail] SMTP login OK`. The yellow code banner in the app disappears, and codes arrive by email.

## 2. Put the server online

The phone can only reach a server on this computer while it's plugged in by USB. For everyone else it needs a home on the internet:

1. Rent a small Linux server (Hetzner CX22, DigitalOcean or similar, about €4–6 a month) and buy a domain (about €10 a year).
2. Point a DNS **A record** such as `api.yourdomain.com` at the server's IP address.
3. On the server, install Docker and copy the `server/` folder there. Then:
   - put your domain in `server/Caddyfile`,
   - create `server/.env` as in step 1 and add `PUBLIC_URL=https://api.yourdomain.com`,
   - run `docker compose up -d`.
4. Open `https://api.yourdomain.com/v1/health`: it should show `{"ok":true,...}`. Your privacy policy is at `https://api.yourdomain.com/privacy`.

## 3. Build the release app

```bash
RELEASE=1 MOTIO_API=https://api.yourdomain.com npm run apk
```

This makes `dist/motio-<version>.apk` (to install directly) and `dist/motio-<version>.aab` (for Google Play). Release builds turn off the debugging that test builds have.

Keep `android/keystore/motio-release.jks` and `android/keystore.properties` safe and backed up. Every future update must be signed with the same key.

## 4. Google Play

1. Create a Google Play developer account ($25 once).
2. Create the app and upload the `.aab` to **Internal testing** first.
3. Store listing: use `https://api.yourdomain.com/privacy` as the privacy policy.
4. **App content**:
   - *Data safety*: location, steps, name and email; collected for app functionality; not shared or sold; users can delete their account in the app (Settings › Privacy › Delete my account).
   - *Health apps* / *Health Connect*: Motio writes exercise, steps and distance and reads steps. Fill the Health Connect declaration form.
   - *Location permissions*: Motio uses background location only while tracking is on, with a visible notification. Record a short video of that for the declaration.

## 5. Optional: Strava

1. Go to strava.com/settings/api and create an app.
2. Set its **Authorization Callback Domain** to `api.yourdomain.com` (or `localhost` while testing over USB).
3. Add these to `server/.env` and restart:
   ```
   STRAVA_CLIENT_ID=...
   STRAVA_CLIENT_SECRET=...
   ```
4. Strava starts new apps at a limit of 1 connected athlete. Ask Strava to raise it before launch.

## Everyday commands

| What | Command |
|---|---|
| Server on this computer (dev) | `cd server && MOTIO_DEV=1 npm start` |
| Server tests | `cd server && npm test` |
| Test build for your phone over USB | `npm run apk` then `adb reverse tcp:8787 tcp:8787` |
