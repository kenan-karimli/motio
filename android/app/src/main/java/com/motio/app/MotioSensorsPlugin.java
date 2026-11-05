package com.motio.app;

import android.Manifest;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import com.google.android.gms.location.ActivityRecognition;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Telephony;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Step counter: the phone's hardware pedometer, counted since the last reboot.
@CapacitorPlugin(name = "MotioSensors", permissions = { @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION }) })
public class MotioSensorsPlugin extends Plugin implements SensorEventListener {
    private SensorManager sensors;
    private Sensor counter;
    private float lastSteps = -1;

    @Override
    public void load() {
        sensors = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        counter = sensors != null ? sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) : null;
        startIfAllowed();
    }

    private boolean allowed() {
        return Build.VERSION.SDK_INT < 29 || getPermissionState("activity") == PermissionState.GRANTED;
    }

    private void startIfAllowed() {
        if (counter != null && allowed()) sensors.registerListener(this, counter, SensorManager.SENSOR_DELAY_NORMAL);
    }

    @PluginMethod
    public void requestStepPermission(PluginCall call) {
        if (allowed()) { startIfAllowed(); resolveStatus(call); return; }
        requestPermissionForAlias("activity", call, "afterPermission");
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        startIfAllowed();
        resolveStatus(call);
    }

    @PluginMethod
    public void getSteps(PluginCall call) { resolveStatus(call); }

    // Saves a widget image the app drew (base64 PNG) and redraws any placed widgets of that kind.
    @PluginMethod
    public void updateWidget(PluginCall call) {
        String kind = call.getString("kind", "ring"), png = call.getString("png");
        if (png == null) { call.reject("png missing"); return; }
        try (java.io.FileOutputStream out = new java.io.FileOutputStream(MotioWidget.file(getContext(), kind))) {
            out.write(android.util.Base64.decode(png, android.util.Base64.DEFAULT));
        } catch (java.io.IOException e) { call.reject("write failed"); return; }
        MotioWidget.refresh(getContext(), kind);
        call.resolve();
    }

    // Opens one app directly with an image from the cache folder: Instagram stories, WhatsApp, X or the SMS app.
    // Resolves ok:false when that app isn't installed, so the page can fall back to the share sheet.
    @PluginMethod
    public void shareTo(PluginCall call) {
        String target = call.getString("target", ""), text = call.getString("text", "");
        java.io.File f = new java.io.File(getContext().getCacheDir(), call.getString("path", ""));
        JSObject r = new JSObject();
        if (!f.exists()) { call.reject("image missing"); return; }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
        Intent i = new Intent(Intent.ACTION_SEND).setType("image/png")
            .putExtra(Intent.EXTRA_STREAM, uri).putExtra(Intent.EXTRA_TEXT, text)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        String pkg;
        switch (target) {
            case "story": pkg = "com.instagram.android"; break;
            case "whatsapp": pkg = installed("com.whatsapp") ? "com.whatsapp" : "com.whatsapp.w4b"; break;
            case "x": pkg = "com.twitter.android"; break;
            case "sms": pkg = Telephony.Sms.getDefaultSmsPackage(getContext()); break;
            default: pkg = null;
        }
        if (pkg == null || !installed(pkg)) { r.put("ok", false); r.put("reason", "not_installed"); call.resolve(r); return; }
        getContext().grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            if (target.equals("story")) {
                // Straight to the story composer; older Instagram versions get their own share picker instead.
                Intent story = new Intent(i).setClassName(pkg, "com.instagram.share.handleractivity.StoryShareHandlerActivity");
                try { getActivity().startActivity(story); r.put("ok", true); call.resolve(r); return; } catch (ActivityNotFoundException e) { /* fall through */ }
            }
            getActivity().startActivity(i.setPackage(pkg));
            r.put("ok", true);
        } catch (ActivityNotFoundException e) {
            r.put("ok", false); r.put("reason", "not_installed");
        }
        call.resolve(r);
    }

    private boolean installed(String pkg) {
        try { getContext().getPackageManager().getPackageInfo(pkg, 0); return true; } catch (Exception e) { return false; }
    }

    // Google Activity Recognition: an update every ~10 s while moving; results arrive as "activity" events.
    private PendingIntent activityIntent() {
        Intent i = new Intent(getContext(), ActivityReceiver.class);
        return PendingIntent.getBroadcast(getContext(), 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
    }

    @PluginMethod
    public void startActivity(PluginCall call) {
        if (!allowed()) { call.reject("permission"); return; }
        ActivityReceiver.listener = (type, confidence, at) -> {
            JSObject e = new JSObject();
            e.put("type", type); e.put("confidence", confidence); e.put("at", at);
            notifyListeners("activity", e);
        };
        try {
            ActivityRecognition.getClient(getContext()).requestActivityUpdates(10000, activityIntent())
                .addOnSuccessListener((v) -> call.resolve())
                .addOnFailureListener((err) -> call.reject(err.getMessage()));
        } catch (SecurityException e) { call.reject("permission"); }
    }

    @PluginMethod
    public void stopActivity(PluginCall call) {
        try { ActivityRecognition.getClient(getContext()).removeActivityUpdates(activityIntent()); } catch (SecurityException e) { /* never started */ }
        ActivityReceiver.listener = null;
        call.resolve();
    }

    // How many of each widget are on the home screen right now.
    @PluginMethod
    public void widgetStatus(PluginCall call) {
        AppWidgetManager m = AppWidgetManager.getInstance(getContext());
        JSObject r = new JSObject();
        for (String k : MotioWidget.KINDS) r.put(k, m.getAppWidgetIds(new ComponentName(getContext(), MotioWidget.classFor(k))).length);
        call.resolve(r);
    }

    // Asks the launcher to place the widget (Android 8+ launchers that support pinning).
    @PluginMethod
    public void pinWidget(PluginCall call) {
        JSObject r = new JSObject();
        AppWidgetManager m = AppWidgetManager.getInstance(getContext());
        ComponentName which = new ComponentName(getContext(), MotioWidget.classFor(call.getString("kind", "ring")));
        boolean ok = Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported();
        if (ok) ok = m.requestPinAppWidget(which, null, null);
        r.put("ok", ok);
        r.put("placed", m.getAppWidgetIds(which).length);
        call.resolve(r);
    }

    private void resolveStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", counter != null);
        r.put("granted", allowed());
        r.put("steps", lastSteps < 0 ? null : (double) lastSteps);
        call.resolve(r);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        lastSteps = event.values[0];
        JSObject r = new JSObject();
        r.put("steps", (double) lastSteps);
        notifyListeners("steps", r);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    @Override
    protected void handleOnDestroy() {
        if (sensors != null) sensors.unregisterListener(this);
    }
}
