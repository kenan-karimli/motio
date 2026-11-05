package com.motio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.google.android.gms.location.ActivityRecognitionResult;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;
import java.util.ArrayDeque;

// Receives Google Activity Recognition results (on-device ML): periodic best guesses, and transitions
// ("started walking", "became still"), which also arrive while the phone lies still.
public class ActivityReceiver extends BroadcastReceiver {
    interface Listener { void onActivity(String type, int confidence, long at); }
    private static Listener listener;
    // Readings that arrive while the app's logic isn't listening are kept and handed over later, not dropped.
    private static final ArrayDeque<Object[]> pending = new ArrayDeque<>();

    static synchronized void setListener(Listener l) {
        listener = l;
        while (l != null && !pending.isEmpty()) { Object[] r = pending.poll(); l.onActivity((String) r[0], (int) r[1], (long) r[2]); }
    }

    private static synchronized void deliver(String type, int conf, long at) {
        if (listener != null) { listener.onActivity(type, conf, at); return; }
        if (pending.size() >= 60) pending.poll();
        pending.add(new Object[] { type, conf, at });
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
                    deliver(t, 95, System.currentTimeMillis() - (android.os.SystemClock.elapsedRealtimeNanos() - ev.getElapsedRealTimeNanos()) / 1000000);
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
        if (type != null) deliver(type, Math.max(0, conf), result.getTime());
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
