package com.motio.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MotioSensorsPlugin.class);
        registerPlugin(MotioHealthPlugin.class);
        registerPlugin(UpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); }

    // A tapped notification (Inbox) opens the Notifications page once the app has loaded.
    @Override
    public void onResume() {
        super.onResume();
        Intent i = getIntent();
        if (i != null && "inbox".equals(i.getStringExtra("open")) && getBridge() != null) {
            i.removeExtra("open");
            getBridge().getWebView().postDelayed(() -> getBridge().getWebView().evaluateJavascript("window.__motioGo && window.__motioGo('inbox')", null), 1200);
        }
    }
}
