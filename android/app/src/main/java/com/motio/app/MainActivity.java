package com.motio.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MotioSensorsPlugin.class);
        registerPlugin(MotioHealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
