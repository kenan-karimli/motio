package com.motio.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// In-app updates: downloads a newer signed APK (pausable, resumable) and hands it to Android's installer.
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
    private volatile String stop;
    private volatile Thread worker;

    private File part(String name) { return new File(getContext().getCacheDir(), "motio-" + name.replaceAll("[^0-9A-Za-z.]", "") + ".part"); }
    private File apk(String name) { return new File(getContext().getCacheDir(), "motio-" + name.replaceAll("[^0-9A-Za-z.]", "") + ".apk"); }

    @PluginMethod
    public void version(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PackageInfo p = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("code", Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode);
            r.put("name", p.versionName);
        } catch (Exception e) { r.put("code", 0); }
        call.resolve(r);
    }

    // What is already on the phone for this version: a finished APK, or how much of a paused download.
    @PluginMethod
    public void status(PluginCall call) {
        String name = call.getString("name", "");
        JSObject r = new JSObject();
        r.put("downloaded", apk(name).exists());
        r.put("partial", part(name).exists() ? part(name).length() : 0);
        r.put("busy", worker != null && worker.isAlive());
        call.resolve(r);
    }

    // Downloads to a .part file, continuing a paused one with a Range request; resolves done, paused or cancelled.
    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", ""), name = call.getString("name", "");
        if (!url.startsWith("https://") || name.isEmpty()) { call.reject("Bad update link"); return; }
        if (worker != null && worker.isAlive()) { call.reject("Already downloading", "busy"); return; }
        stop = null;
        worker = new Thread(() -> {
            File part = part(name), done = apk(name);
            try {
                long have = part.exists() ? part.length() : 0;
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(15000); c.setReadTimeout(30000);
                if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
                int code = c.getResponseCode();
                if (code != 206) have = 0; // the server sent the whole file: start over
                long total = have + Math.max(0, c.getContentLengthLong()), got = have;
                int last = -1;
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(part, have > 0)) {
                    byte[] buf = new byte[64 * 1024];
                    for (int n; stop == null && (n = in.read(buf)) > 0; ) {
                        out.write(buf, 0, n);
                        got += n;
                        int pct = total > 0 ? (int) (got * 100 / total) : -1;
                        if (pct != last) { last = pct; JSObject e = new JSObject(); e.put("pct", pct); e.put("got", got); e.put("total", total); notifyListeners("progress", e); }
                    }
                }
                JSObject r = new JSObject();
                if ("cancel".equals(stop)) { part.delete(); r.put("cancelled", true); }
                else if ("pause".equals(stop)) { r.put("paused", true); r.put("got", got); r.put("total", total); }
                else { done.delete(); if (!part.renameTo(done)) throw new Exception("rename"); r.put("done", true); }
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Download failed", "failed"); // the .part stays, so Resume continues from it
            } finally { worker = null; }
        });
        worker.start();
    }

    @PluginMethod
    public void pause(PluginCall call) { stop = "pause"; call.resolve(); }

    @PluginMethod
    public void cancel(PluginCall call) {
        stop = "cancel";
        // Nothing running (a paused download): drop what was saved.
        if (worker == null || !worker.isAlive()) part(call.getString("name", "")).delete();
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        File done = apk(call.getString("name", ""));
        if (!done.exists()) { call.reject("Download it first", "missing"); return; }
        // Android asks once per app whether it may install updates; send the person there first.
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(i); } catch (Exception e) { /* no such screen */ }
            JSObject r = new JSObject(); r.put("needsPermission", true); call.resolve(r);
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", done);
        Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        JSObject r = new JSObject(); r.put("started", true); call.resolve(r);
    }
}
