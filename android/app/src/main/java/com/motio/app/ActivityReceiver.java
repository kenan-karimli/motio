package com.motio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.google.android.gms.location.ActivityRecognitionResult;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;
import android.os.Build;
import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityTransitionRequest;

// Receives Google Activity Recognition results (on-device ML): periodic best guesses, and transitions
// ("started walking", "became still"), which also arrive while the phone lies still.
public class ActivityReceiver extends BroadcastReceiver {
    // Readings go to the app while it listens, otherwise into TrackService's file, so none are lost
    // while Motio is closed or after Android restarts its process.
    private static void deliver(Context c, String type, int conf, long at) {
        try {
            org.json.JSONObject o = new org.json.JSONObject();
            o.put("k", "a"); o.put("type", type); o.put("confidence", conf); o.put("at", at);
            TrackService.deliver(c, o);
        } catch (Exception e) { /* skip this reading */ }
    }

    private static android.app.PendingIntent intent(Context c, int code) {
        return android.app.PendingIntent.getBroadcast(c, code, new Intent(c, ActivityReceiver.class), android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_MUTABLE);
    }

    // Turns on Google's periodic guesses and its "started walking / became still" transitions.
    static boolean register(Context c) {
        if (Build.VERSION.SDK_INT >= 29 && androidx.core.content.ContextCompat.checkSelfPermission(c, android.Manifest.permission.ACTIVITY_RECOGNITION) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false;
        java.util.List<ActivityTransition> list = new java.util.ArrayList<>();
        for (int a : new int[] { DetectedActivity.STILL, DetectedActivity.WALKING, DetectedActivity.RUNNING, DetectedActivity.ON_BICYCLE, DetectedActivity.IN_VEHICLE })
            for (int t : new int[] { ActivityTransition.ACTIVITY_TRANSITION_ENTER, ActivityTransition.ACTIVITY_TRANSITION_EXIT })
                list.add(new ActivityTransition.Builder().setActivityType(a).setActivityTransition(t).build());
        try {
            ActivityRecognition.getClient(c).requestActivityTransitionUpdates(new ActivityTransitionRequest(list), intent(c, 8));
            ActivityRecognition.getClient(c).requestActivityUpdates(10000, intent(c, 7));
            return true;
        } catch (SecurityException e) { return false; }
    }

    static void unregister(Context c) {
        try {
            ActivityRecognition.getClient(c).removeActivityUpdates(intent(c, 7));
            ActivityRecognition.getClient(c).removeActivityTransitionUpdates(intent(c, 8));
        } catch (SecurityException e) { /* never started */ }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ActivityTransitionResult.hasResult(intent)) {
            ActivityTransitionResult tr = ActivityTransitionResult.extractResult(intent);
            if (tr == null) return;
            for (ActivityTransitionEvent ev : tr.getTransitionEvents()) {
                String t = name(ev.getActivityType());
                // Entering an activity is a firm signal; leaving one says nothing about what comes next.
                if (t != null && ev.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                    deliver(context, t, 95, System.currentTimeMillis() - (android.os.SystemClock.elapsedRealtimeNanos() - ev.getElapsedRealTimeNanos()) / 1000000);
            }
            return;
        }
        if (!ActivityRecognitionResult.hasResult(intent)) return;
        ActivityRecognitionResult result = ActivityRecognitionResult.extractResult(intent);
        if (result == null) return;
        // Prefer the specific walking/running guesses over the generic "on foot".
        String type = null; int conf = 0;
        for (DetectedActivity a : result.getProbableActivities()) {
            String t = name(a.getType());
            if (t == null) continue;
            int c = a.getConfidence() + (a.getType() == DetectedActivity.ON_FOOT ? -5 : 0);
            if (c > conf) { conf = c; type = t; }
        }
        if (type != null) deliver(context, type, Math.max(0, conf), result.getTime());
    }

    static String name(int type) {
        switch (type) {
            case DetectedActivity.IN_VEHICLE: return "vehicle";
            case DetectedActivity.ON_BICYCLE: return "bike";
            case DetectedActivity.RUNNING: return "run";
            case DetectedActivity.WALKING:
            case DetectedActivity.ON_FOOT: return "walk";
            case DetectedActivity.STILL: return "still";
            default: return null; // tilting / unknown say nothing about how you move
        }
    }
}
