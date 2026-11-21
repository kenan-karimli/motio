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
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;
import android.os.PowerManager;
import android.provider.Settings;
import java.util.ArrayList;
import java.util.List;
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

    // The server address and session for background notifications (Inbox); an empty token turns them off.
    // `since`: the app has already shown everything up to this time.
    @PluginMethod
    public void setInbox(PluginCall call) {
        android.content.SharedPreferences.Editor e = Inbox.prefs(getContext()).edit();
        e.putString("api", call.getString("api", "")).putString("token", call.getString("token", ""));
        long since = (long) call.getDouble("since", 0d).doubleValue();
        if (since > Inbox.prefs(getContext()).getLong("since", 0)) e.putLong("since", since);
        e.apply();
        call.resolve();
    }

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

    // The numbers the widgets show (JSON from widgetData() in motio.js); the native widgets are drawn from them.
    @PluginMethod
    public void widgetData(PluginCall call) {
        MotioWidget.save(getContext(), call.getString("json", "{}"));
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
    // Enter/exit events for still, walking, running, cycling and driving.

    // Tracking runs in TrackService. Starting hands back what was recorded while the app wasn't running
    // (location fixes and activity readings, oldest first), then new ones arrive as "location"/"activity" events.
    @PluginMethod
    public void startTracking(PluginCall call) {
        if (!TrackService.canRun(getContext())) { call.reject("permission", "denied"); return; }
        if (allowed()) ActivityReceiver.register(getContext());
        org.json.JSONArray backlog = TrackService.attach(getContext(), (item) -> {
            JSObject e;
            try { e = JSObject.fromJSONObject(item); } catch (Exception ex) { return; }
            notifyListeners("a".equals(item.optString("k")) ? "activity" : "location", e, false);
        });
        TrackService.start(getContext());
        JSObject r = new JSObject();
        r.put("backlog", backlog);
        call.resolve(r);
    }

    @PluginMethod
    public void setTrackingMode(PluginCall call) {
        TrackService.setSaver(getContext(), call.getBoolean("saver", false));
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        TrackService.stop(getContext());
        ActivityReceiver.unregister(getContext());
        call.resolve();
    }

    // "Allow all the time" location: needed for tracking to restart by itself after a reboot.
    @PluginMethod
    public void requestBackgroundLocation(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 29 && !backgroundAllowed())
            androidx.core.app.ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, 77);
        call.resolve();
    }

    private boolean backgroundAllowed() {
        return Build.VERSION.SDK_INT < 29 || androidx.core.content.ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }



    // Which of the given fitness apps are installed, so Connected apps can offer the right ones.
    @PluginMethod
    public void installedApps(PluginCall call) {
        JSObject r = new JSObject();
        try {
            com.getcapacitor.JSArray list = call.getArray("packages");
            for (int i = 0; i < list.length(); i++) { String pkg = list.getString(i); r.put(pkg, installed(pkg)); }
        } catch (Exception e) { /* bad input: report none */ }
        call.resolve(r);
    }

    // Sign in with Google through Android's Credential Manager; the ID token goes to the Motio server to check.
    @PluginMethod
    public void googleSignIn(PluginCall call) {
        String clientId = call.getString("clientId", "");
        if (clientId.isEmpty()) { call.reject("Google sign-in isn't set up", "off"); return; }
        androidx.credentials.CredentialManager cm = androidx.credentials.CredentialManager.create(getContext());
        androidx.credentials.GetCredentialRequest req = new androidx.credentials.GetCredentialRequest.Builder()
            .addCredentialOption(new com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption.Builder(clientId).build()).build();
        cm.getCredentialAsync(getActivity(), req, new android.os.CancellationSignal(), java.util.concurrent.Executors.newSingleThreadExecutor(),
            new androidx.credentials.CredentialManagerCallback<androidx.credentials.GetCredentialResponse, androidx.credentials.exceptions.GetCredentialException>() {
                @Override public void onResult(androidx.credentials.GetCredentialResponse r) {
                    androidx.credentials.Credential c = r.getCredential();
                    if (c instanceof androidx.credentials.CustomCredential && com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                        JSObject o = new JSObject();
                        o.put("idToken", com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.createFrom(c.getData()).getIdToken());
                        call.resolve(o);
                    } else call.reject("Google didn't return an account", "failed");
                }
                @Override public void onError(androidx.credentials.exceptions.GetCredentialException e) {
                    call.reject(String.valueOf(e.getMessage()), e instanceof androidx.credentials.exceptions.GetCredentialCancellationException ? "cancelled" : "failed");
                }
            });
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        Intent i = getContext().getPackageManager().getLaunchIntentForPackage(call.getString("package", ""));
        JSObject r = new JSObject();
        if (i == null) {
            // Not installed: open its Play Store page instead.
            String pkg = call.getString("package", "");
            i = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg));
            if (i.resolveActivity(getContext().getPackageManager()) == null) i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + pkg));
            r.put("store", true);
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        r.put("ok", true);
        call.resolve(r);
    }

    // Phone settings that decide whether tracking survives in the background (Xiaomi and others stop apps hard).
    @PluginMethod
    public void setupStatus(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("battery", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        boolean xiaomi = Build.MANUFACTURER.toLowerCase().matches(".*(xiaomi|redmi|poco).*");
        r.put("xiaomi", xiaomi);
        r.put("background", backgroundAllowed());
        if (xiaomi) {
            // MIUI/HyperOS keep Autostart as hidden app-op 10008 (0 = allowed); no public API exposes it.
            try {
                android.app.AppOpsManager ops = (android.app.AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
                java.lang.reflect.Method m = android.app.AppOpsManager.class.getMethod("checkOpNoThrow", int.class, int.class, String.class);
                int mode = (Integer) m.invoke(ops, 10008, android.os.Process.myUid(), getContext().getPackageName());
                r.put("autostart", mode == 0);
            } catch (Exception e) { /* unknown on this build: the app falls back to "opened the screen" */ }
        }
        call.resolve(r);
    }

    @PluginMethod
    public void openSetup(PluginCall call) {
        String what = call.getString("what", "battery");
        String pkg = getContext().getPackageName();
        Intent i;
        if ("app".equals(what)) {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
        } else if ("autostart".equals(what)) {
            i = new Intent().setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
        } else {
            i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); }
        catch (Exception e) {
            // No such screen on this phone: open Motio's own app settings instead.
            getContext().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
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
        // The WebView is going away (app closed): new readings wait in TrackService's file until it's back.
        TrackService.detach();
    }
}
