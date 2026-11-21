package com.motio.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.contract.ActivityResultContract;
import androidx.health.connect.client.HealthConnectClient;
import androidx.health.connect.client.PermissionController;
import androidx.health.connect.client.aggregate.AggregationResult;
import androidx.health.connect.client.records.DistanceRecord;
import androidx.health.connect.client.records.ExerciseSessionRecord;
import androidx.health.connect.client.records.Record;
import androidx.health.connect.client.records.StepsRecord;
import androidx.health.connect.client.records.metadata.Device;
import androidx.health.connect.client.records.metadata.Metadata;
import androidx.health.connect.client.request.AggregateRequest;
import androidx.health.connect.client.time.TimeRangeFilter;
import androidx.health.connect.client.units.Length;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import kotlin.coroutines.EmptyCoroutineContext;
import kotlinx.coroutines.BuildersKt;
import org.json.JSONObject;

// Health Connect: Motio writes walks, runs and rides as workouts (plus steps and distance) and reads today's steps.
@CapacitorPlugin(name = "MotioHealth")
public class MotioHealthPlugin extends Plugin {
    static final String[] PERMS = {
        "android.permission.health.WRITE_EXERCISE",
        "android.permission.health.WRITE_STEPS",
        "android.permission.health.WRITE_DISTANCE",
        "android.permission.health.READ_STEPS"
    };

    private boolean available() {
        return HealthConnectClient.Companion.getSdkStatus(getContext()) == HealthConnectClient.SDK_AVAILABLE;
    }

    private HealthConnectClient client() { return HealthConnectClient.Companion.getOrCreate(getContext()); }

    @SuppressWarnings("unchecked")
    private Set<String> granted() throws InterruptedException {
        PermissionController pc = client().getPermissionController();
        return (Set<String>) BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, (scope, cont) -> pc.getGrantedPermissions(cont));
    }

    private JSObject status() throws InterruptedException {
        JSObject r = new JSObject();
        int sdk = HealthConnectClient.Companion.getSdkStatus(getContext());
        r.put("available", sdk == HealthConnectClient.SDK_AVAILABLE);
        r.put("needsUpdate", sdk == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED);
        Set<String> g = sdk == HealthConnectClient.SDK_AVAILABLE ? granted() : Collections.emptySet();
        r.put("connected", g.contains(PERMS[0]) && g.contains(PERMS[1]));
        r.put("readSteps", g.contains(PERMS[3]));
        return r;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        new Thread(() -> { try { call.resolve(status()); } catch (Exception e) { call.reject(e.getMessage()); } }).start();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!available()) { call.reject("unavailable"); return; }
        ActivityResultContract<Set<String>, Set<String>> contract = PermissionController.createRequestPermissionResultContract();
        Set<String> want = new HashSet<>(); Collections.addAll(want, PERMS);
        startActivityForResult(call, contract.createIntent(getContext(), want), "afterConnect");
    }

    @ActivityCallback
    private void afterConnect(PluginCall call, ActivityResult result) {
        new Thread(() -> { try { call.resolve(status()); } catch (Exception e) { call.reject(e.getMessage()); } }).start();
    }

    // trips: [{ id, start, end, mode, distanceM, steps, updatedAt }]. The same trip id updates its records instead of duplicating.
    @PluginMethod
    public void writeTrips(PluginCall call) {
        JSArray trips = call.getArray("trips");
        new Thread(() -> {
            try {
                Device phone = new Device(Device.TYPE_PHONE, android.os.Build.MANUFACTURER, android.os.Build.MODEL);
                List<Record> out = new ArrayList<>();
                List<String> noSteps = new ArrayList<>(); // trips whose steps were corrected to none: drop the old record
                for (int i = 0; trips != null && i < trips.length(); i++) {
                    JSONObject t = trips.getJSONObject(i);
                    Instant a = Instant.ofEpochMilli(t.getLong("start")), b = Instant.ofEpochMilli(Math.max(t.getLong("end"), t.getLong("start") + 1000));
                    ZoneOffset za = ZoneId.systemDefault().getRules().getOffset(a), zb = ZoneId.systemDefault().getRules().getOffset(b);
                    String id = "motio-" + t.getString("id");
                    long ver = t.optLong("updatedAt", 1);
                    String mode = t.optString("mode");
                    int type = mode.equals("run") ? ExerciseSessionRecord.EXERCISE_TYPE_RUNNING
                        : mode.equals("bike") ? ExerciseSessionRecord.EXERCISE_TYPE_BIKING
                        : mode.equals("walk") ? ExerciseSessionRecord.EXERCISE_TYPE_WALKING : -1;
                    if (type < 0) continue; // drives and transit aren't workouts
                    out.add(new ExerciseSessionRecord(a, za, b, zb, Metadata.activelyRecorded(phone, id + "-session", ver), type, t.optString("title", null)));
                    if (t.optDouble("distanceM", 0) > 0) out.add(new DistanceRecord(a, za, b, zb, Length.meters(t.getDouble("distanceM")), Metadata.activelyRecorded(phone, id + "-distance", ver)));
                    if (t.optLong("steps", 0) > 0) out.add(new StepsRecord(a, za, b, zb, t.getLong("steps"), Metadata.activelyRecorded(phone, id + "-steps", ver)));
                    else noSteps.add(id + "-steps");
                }
                if (!out.isEmpty()) BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, (scope, cont) -> client().insertRecords(out, cont));
                if (!noSteps.isEmpty()) BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, (scope, cont) -> client().deleteRecords(kotlin.jvm.JvmClassMappingKt.getKotlinClass(StepsRecord.class), Collections.emptyList(), noSteps, cont));
                JSObject r = new JSObject(); r.put("written", out.size()); call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    // Total steps between two times from every app and device that writes to Health Connect (watches, other trackers).
    @PluginMethod
    public void readSteps(PluginCall call) {
        long from = (long) call.getDouble("from", 0d).doubleValue(), to = (long) call.getDouble("to", (double) System.currentTimeMillis()).doubleValue();
        new Thread(() -> {
            try {
                Set<androidx.health.connect.client.aggregate.AggregateMetric<?>> metrics = new HashSet<>();
                metrics.add(StepsRecord.COUNT_TOTAL);
                AggregateRequest req = new AggregateRequest(metrics, TimeRangeFilter.Companion.between(Instant.ofEpochMilli(from), Instant.ofEpochMilli(to)), Collections.emptySet());
                AggregationResult res = (AggregationResult) BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, (scope, cont) -> client().aggregate(req, cont));
                Long steps = res.get(StepsRecord.COUNT_TOTAL);
                JSObject r = new JSObject(); r.put("steps", steps == null ? 0 : steps); call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"));
            call.resolve();
        } catch (Exception e) { call.reject("unavailable"); }
    }
}
