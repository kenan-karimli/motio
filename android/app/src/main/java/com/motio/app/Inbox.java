package com.motio.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

// Notifications while Motio is closed: the tracking service asks the server's inbox every few minutes and shows
// what's new (cheers, friend requests, challenges, sharing, a new version) as phone notifications. The app hands
// over the server address and session (setInbox) and moves `since` forward whenever it has shown items itself.
final class Inbox {
    static final String PREFS = "motio.inbox";

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void check(Context c) {
        SharedPreferences p = prefs(c);
        String api = p.getString("api", ""), token = p.getString("token", "");
        if (api.isEmpty() || token.isEmpty()) return;
        new Thread(() -> {
            try {
                HttpURLConnection h = (HttpURLConnection) new URL(api + "/v1/inbox").openConnection();
                h.setConnectTimeout(10000); h.setReadTimeout(10000);
                h.setRequestProperty("Authorization", "Bearer " + token);
                if (h.getResponseCode() == 401) { p.edit().remove("token").apply(); return; } // signed out elsewhere
                if (h.getResponseCode() != 200) return;
                StringBuilder sb = new StringBuilder();
                try (BufferedReader r = new BufferedReader(new InputStreamReader(h.getInputStream(), "UTF-8"))) { String l; while ((l = r.readLine()) != null) sb.append(l); }
                JSONArray items = new JSONObject(sb.toString()).getJSONArray("items");
                long since = p.getLong("since", System.currentTimeMillis()), top = since;
                int shown = 0;
                for (int i = 0; i < items.length() && shown < 3; i++) {
                    JSONObject it = items.getJSONObject(i);
                    long at = it.optLong("at");
                    if (at <= since) continue;
                    top = Math.max(top, at);
                    if ("update".equals(it.optString("kind")) && !newer(it.optString("version"), appVersion(c))) continue;
                    show(c, it.optString("id").hashCode(), it.optString("title"), it.optString("body"));
                    shown++;
                }
                p.edit().putLong("since", top).apply();
            } catch (Exception e) { /* offline or server asleep: next round */ }
        }).start();
    }

    static boolean newer(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int u = i < x.length ? parse(x[i]) : 0, v = i < y.length ? parse(y[i]) : 0;
            if (u != v) return u > v;
        }
        return false;
    }

    private static String appVersion(Context c) {
        try { return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName; } catch (Exception e) { return "0"; }
    }

    private static int parse(String s) { try { return Integer.parseInt(s); } catch (Exception e) { return 0; } }

    private static void show(Context c, int id, String title, String body) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("motio-social", "Friends and updates", NotificationManager.IMPORTANCE_DEFAULT));
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT).putExtra("open", "inbox");
        PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        nm.notify(id, new NotificationCompat.Builder(c, "motio-social")
            .setSmallIcon(R.drawable.ic_launcher_monochrome).setContentTitle(title).setContentText(body)
            .setContentIntent(pi).setAutoCancel(true).build());
    }
}
