package com.motio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.google.android.gms.location.ActivityRecognitionResult;
import com.google.android.gms.location.DetectedActivity;

// Receives Google Activity Recognition results (on-device ML) and hands the best guess to the plugin.
public class ActivityReceiver extends BroadcastReceiver {
    interface Listener { void onActivity(String type, int confidence, long at); }
    static Listener listener;

    @Override
    public void onReceive(Context context, Intent intent) {
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
        if (type != null && listener != null) listener.onActivity(type, Math.max(0, conf), result.getTime());
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
