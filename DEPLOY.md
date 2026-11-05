# Putting Motio online (free)

Three free accounts, about 20 minutes. You create the accounts and paste the secret values into Render yourself; nothing secret goes into the code.

| Piece | Service | Why |
|---|---|---|
| Server | **Render** (free web service) | Runs the API at `https://motio-api.onrender.com` (or similar) |
| Database | **Neon** (free Postgres) | Keeps accounts and trips permanently (Render's free disk is wiped on every restart) |
| Email | **Brevo** (free, 300/day) | Sends codes over HTTPS (Render's free plan blocks mail ports) |
| Keep-awake | **UptimeRobot** (free) | Pings the server every 5 min so it doesn't fall asleep after 15 idle minutes |

## 1. Neon: the database
1. Sign up at **neon.tech**, create a project named `motio`, and pick region **Frankfurt (eu-central-1)**.
2. On the project dashboard, click **Connect** and copy the connection string (`postgresql://…neon.tech/neondb?sslmode=require`).

## 2. Brevo: email
1. Sign up at **brevo.com**.
2. **Senders, domains & dedicated IPs › Senders › Add a sender** with `noreply.motio@gmail.com`, then click the confirmation link Brevo emails there.
3. **SMTP & API › API keys › Generate a new API key** named `motio`, and copy it.

## 3. Render: the server
1. Sign up at **render.com** with your GitHub account.
2. **New › Blueprint** and pick the `motio` repository. Render reads `render.yaml` and creates `motio-api`.
3. When it asks for the secret values, fill in:
   - `DATABASE_URL` = the Neon string from step 1
   - `BREVO_API_KEY` = the key from step 2
   - Leave the Strava ones empty for now.
4. Deploy. When it's live, open `https://<your-service>.onrender.com/v1/health`; it should show `{"ok":true,"mail":"brevo",…}`.
5. Back in Render: **Environment**, add `PUBLIC_URL` = `https://<your-service>.onrender.com`, and save.

## 4. UptimeRobot: keep it awake
1. Sign up at **uptimerobot.com**.
2. **Add New Monitor**: type HTTP(s), URL `https://<your-service>.onrender.com/v1/health`, interval 5 minutes.

Render gives 750 free hours a month, enough for this one service running all month.

## 5. Tell Claude the URL
Claude then builds the release app pointed at it (`RELEASE=1 MOTIO_API=https://<your-service>.onrender.com npm run apk`), installs it and tests sign-up, email and sync end to end.

## Later, optional
- **Strava uploads:** create an app at strava.com/settings/api with callback domain `<your-service>.onrender.com`, then add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in Render.
- **Own domain:** emails land in the inbox instead of spam, and the address gets nicer.
