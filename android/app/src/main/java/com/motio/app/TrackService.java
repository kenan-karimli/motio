package com.motio.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import org.json.JSONArray;
import org.json.JSONObject;

// Records location in a foreground service, so trips are tracked with Motio closed, after the system
// kills it and after a reboot (BootReceiver). While the app's code is running, fixes go straight to it;
// otherwise they and Activity Recognition readings wait in a small file the app replays when it opens.
public class TrackService extends Service {
    interface Sink { void on(JSONObject item); }
    private static Sink sink;
    private static final String PREFS = "motio.track", BUFFER = "motio-buffer.jsonl";
    private static final int MAX_LINES = 20000; // about a day of fixes every 5 s
    private LocationCallback callback;
    private android.hardware.SensorEventListener steps; // keeps the steps widgets counting with Motio closed

    static boolean wanted(Context c) { return c.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("on", false); }

    static boolean canRun(Context c) {
        return ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static void start(Context c) {
        c.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("on", true).apply();
        if (canRun(c)) ContextCompat.startForegroundService(c, new Intent(c, TrackService.class));
    }

    static void setSaver(Context c, boolean saver) {
        c.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("saver", saver).apply();
        if (wanted(c) && canRun(c)) ContextCompat.startForegroundService(c, new Intent(c, TrackService.class)); // re-requests with the new mode
    }

    static void stop(Context c) {
        c.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("on", false).apply();
        c.stopService(new Intent(c, TrackService.class));
    }

    // Hands over everything recorded while the app wasn't listening, then sends new items live.
    static synchronized JSONArray attach(Context c, Sink s) {
        sink = s;
        return take(c);
    }

    static synchronized void detach() { sink = null; }

    static synchronized void deliver(Context c, JSONObject item) {
        if (sink != null) { sink.on(item); return; }
        File f = new File(c.getFilesDir(), BUFFER);
        // A very long time closed: keep the newest half instead of growing without end (it used to delete it all).
        if (f.length() > MAX_LINES * 160L) {
            try {
                java.util.List<String> lines = java.nio.file.Files.readAllLines(f.toPath());
                java.nio.file.Files.write(f.toPath(), lines.subList(lines.size() / 2, lines.size()));
            } catch (Exception e) { f.delete(); /* unreadable: start over */ }
        }
        try (FileWriter w = new FileWriter(f, true)) { w.write(item.toString()); w.write('\n'); } catch (Exception e) { /* storage full: drop this one */ }
    }

    private static JSONArray take(Context c) {
        JSONArray out = new JSONArray();
        File f = new File(c.getFilesDir(), BUFFER);
        if (!f.exists()) return out;
        try (BufferedReader r = new BufferedReader(new FileReader(f))) {
            String line;
            while ((line = r.readLine()) != null) { try { out.put(new JSONObject(line)); } catch (Exception e) { /* half-written line */ } }
        } catch (Exception e) { /* unreadable: start over */ }
        f.delete();
        return out;
    }

    private Notification notification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("tracking", "Tracking", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT), PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, "tracking")
            .setSmallIcon(R.drawable.ic_launcher_monochrome)
            .setContentTitle("Motio is tracking your moves")
            .setContentText("Tap to open. Turn off in Settings › Tracking.")
            .setContentIntent(open).setOngoing(true).setSilent(true).build();
    }

    // Runs on every start, not only the first: a service Android restarted in the background may have no
    // location access, and a start from the opened app gives it back.
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!wanted(this)) { stopSelf(); return START_NOT_STICKY; }
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(7, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(7, notification());
        } catch (Exception e) { stopSelf(); return START_NOT_STICKY; } // not allowed right now: the app starts it again when opened
        if (callback != null) LocationServices.getFusedLocationProviderClient(this).removeLocationUpdates(callback);
        callback = new LocationCallback() {
            @Override public void onLocationResult(LocationResult result) {
                for (Location l : result.getLocations()) {
                    try {
                        JSONObject o = new JSONObject();
                        o.put("k", "l"); o.put("latitude", l.getLatitude()); o.put("longitude", l.getLongitude());
                        o.put("accuracy", l.getAccuracy()); o.put("time", l.getTime());
                        if (l.hasSpeed()) o.put("speed", l.getSpeed());
                        if (l.hasBearing()) o.put("bearing", l.getBearing());
                        if (l.hasAltitude()) o.put("altitude", l.getAltitude());
                        deliver(TrackService.this, o);
                    } catch (Exception e) { /* skip this fix */ }
                }
            }
        };
        // Precise: GPS every 5 s. Battery saver: Wi-Fi and cell-assisted fixes every 15 s, less drain, rougher routes.
        boolean saver = getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("saver", false);
        LocationRequest req = saver
            ? new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 15000).setMinUpdateIntervalMillis(8000).setMinUpdateDistanceMeters(25).build()
            : new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000).setMinUpdateIntervalMillis(2000).setMinUpdateDistanceMeters(10).build();
        try { LocationServices.getFusedLocationProviderClient(this).requestLocationUpdates(req, callback, Looper.getMainLooper()); }
        catch (SecurityException e) { stopSelf(); return START_NOT_STICKY; }
        if (steps == null) steps = MotioWidget.watchSteps(this);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (callback != null) LocationServices.getFusedLocationProviderClient(this).removeLocationUpdates(callback);
        MotioWidget.unwatchSteps(this, steps);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
