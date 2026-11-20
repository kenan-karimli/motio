package com.motio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// After a reboot or an app update, tracking carries on by itself if it was on, without opening Motio.
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(a) && !"android.intent.action.QUICKBOOT_POWERON".equals(a)) return;
        if (!TrackService.wanted(c)) return;
        ActivityReceiver.register(c);
        try { TrackService.start(c); } catch (Exception e) { /* Android refused a background start: the app starts it when opened */ }
    }
}
