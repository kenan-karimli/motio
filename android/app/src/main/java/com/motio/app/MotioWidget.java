package com.motio.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.content.ContextCompat;
import java.io.File;
import java.util.Calendar;
import org.json.JSONObject;

// Home screen widgets. The app sends the numbers it shows (widgetData() in motio.js), cached here with the day they
// belong to. Ring, steps, streak and the compact bar are drawn here from those numbers, so they roll over at
// midnight and keep counting steps (TrackService) with Motio closed. The richer ones are images the app draws.
public class MotioWidget extends AppWidgetProvider {
    public static final String[] KINDS = { "ring", "steps", "road", "streak", "persona", "week", "friends", "challenge", "compact" };
    static final String[] NATIVE = { "ring", "steps", "streak", "compact" };
    static final String PREFS = "motio.widget", TICK = "com.motio.app.WIDGET_TICK";
    private static long stepsDrawnAt = 0;

    protected String kind() { return "ring"; }

    public static Class<? extends MotioWidget> classFor(String kind) {
        switch (kind) {
            case "steps": return Steps.class;
            case "road": return Road.class;
            case "streak": return Streak.class;
            case "persona": return Persona.class;
            case "week": return Week.class;
            case "friends": return Friends.class;
            case "challenge": return Challenge.class;
            case "compact": return Compact.class;
            default: return MotioWidget.class;
        }
    }

    static File file(Context c, String kind) { return new File(c.getFilesDir(), "widget_" + kind + ".png"); }
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id, kind());
        scheduleMidnight(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        update(context, manager, id, kind()); // resized: redraw at the new shape
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (TICK.equals(intent.getAction())) { refreshAll(context); scheduleMidnight(context); }
        else super.onReceive(context, intent);
    }

    static void update(Context c, AppWidgetManager m, int id, String kind) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.motio_widget_img);
        Bitmap bmp = null;
        try {
            Bundle o = m.getAppWidgetOptions(id);
            // Portrait size: min width × max height, what launchers use on a phone held upright.
            bmp = WidgetDraw.draw(c, kind, o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH), o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT));
        } catch (Exception e) { Log.w("MotioWidget", "draw " + kind, e); }
        if (bmp != null) {
            v.setImageViewBitmap(R.id.widget_img, bmp);
            v.setViewVisibility(R.id.widget_empty, View.GONE);
        } else {
            v.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        }
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        m.updateAppWidget(id, v);
    }

    static void refresh(Context c, String kind) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : m.getAppWidgetIds(new ComponentName(c, classFor(kind)))) update(c, m, id, kind);
    }

    static void refreshAll(Context c) { for (String k : KINDS) refresh(c, k); }

    // The numbers from the app. It is the authority on today's steps, so the step count restarts from its figure.
    static void save(Context c, String json) {
        JSONObject d;
        try { d = new JSONObject(json); } catch (Exception e) { return; }
        SharedPreferences p = prefs(c);
        boolean signedOutBefore = p.getBoolean("signedOut", false), signedOut = d.optBoolean("signedOut");
        SharedPreferences.Editor e = p.edit().putString("data", json).putBoolean("signedOut", signedOut);
        if (!signedOut) e.putLong("sDay", d.optLong("day0")).putLong("sSteps", d.optLong("stepsN")).putLong("sTotal", d.optLong("stepTotal", -1)).putLong("sAt", d.optLong("at"));
        e.apply();
        if (signedOut != signedOutBefore) refreshAll(c);
        else for (String k : NATIVE) refresh(c, k);
        scheduleMidnight(c);
    }

    static JSONObject data(Context c) {
        String s = prefs(c).getString("data", null);
        try { return s == null ? null : new JSONObject(s); } catch (Exception e) { return null; }
    }

    static long dayStart(long t, int addDays) {
        Calendar k = Calendar.getInstance();
        k.setTimeInMillis(t);
        k.set(Calendar.HOUR_OF_DAY, 0); k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0); k.set(Calendar.MILLISECOND, 0);
        k.add(Calendar.DAY_OF_MONTH, addDays);
        return k.getTimeInMillis();
    }

    // Just after midnight, so the day's numbers start over. RTC (not wakeup): it runs when the phone next wakes.
    static void scheduleMidnight(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, new Intent(c, MotioWidget.class).setAction(TICK), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        am.set(AlarmManager.RTC, dayStart(System.currentTimeMillis(), 1) + 60000, pi);
    }

    // Today's steps as the widgets know them: the app's last figure plus what the step counter added since.
    static long steps(Context c) {
        SharedPreferences p = prefs(c);
        return p.getLong("sDay", 0) == dayStart(System.currentTimeMillis(), 0) ? p.getLong("sSteps", 0) : 0;
    }

    // Same counting as onSteps() in motio.js: the counter runs since reboot; a smaller number means it restarted.
    static void onSteps(Context c, long total) {
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis(), day = dayStart(now, 0), last = p.getLong("sTotal", -1);
        long delta = last < 0 ? 0 : total >= last ? total - last : total;
        boolean newDay = p.getLong("sDay", 0) != day;
        long steps = (newDay ? 0 : p.getLong("sSteps", 0)) + delta;
        p.edit().putLong("sDay", day).putLong("sSteps", steps).putLong("sTotal", total).putLong("sAt", now).apply();
        if (newDay || now - stepsDrawnAt > 5 * 60000) { stepsDrawnAt = now; refresh(c, "steps"); refresh(c, "compact"); }
    }

    // Started by TrackService while tracking runs; readings come in batches (up to 5 minutes) to save battery.
    static SensorEventListener watchSteps(Context c) {
        if (Build.VERSION.SDK_INT >= 29 && ContextCompat.checkSelfPermission(c, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) return null;
        SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        Sensor counter = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (counter == null) return null;
        Context app = c.getApplicationContext();
        SensorEventListener l = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent event) { onSteps(app, (long) event.values[0]); }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        sm.registerListener(l, counter, SensorManager.SENSOR_DELAY_NORMAL, 5 * 60 * 1000000);
        return l;
    }

    static void unwatchSteps(Context c, SensorEventListener l) {
        SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        if (l != null && sm != null) sm.unregisterListener(l);
    }

    public static class Steps extends MotioWidget { @Override protected String kind() { return "steps"; } }
    public static class Road extends MotioWidget { @Override protected String kind() { return "road"; } }
    public static class Streak extends MotioWidget { @Override protected String kind() { return "streak"; } }
    public static class Persona extends MotioWidget { @Override protected String kind() { return "persona"; } }
    public static class Week extends MotioWidget { @Override protected String kind() { return "week"; } }
    public static class Friends extends MotioWidget { @Override protected String kind() { return "friends"; } }
    public static class Challenge extends MotioWidget { @Override protected String kind() { return "challenge"; } }
    public static class Compact extends MotioWidget { @Override protected String kind() { return "compact"; } }
}
