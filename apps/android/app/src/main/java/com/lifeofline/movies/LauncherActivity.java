package com.lifeofline.movies;

import android.content.pm.ActivityInfo;
import android.os.Build;
import android.os.Bundle;

/**
 * Opens movies.lifeofline.com full-screen in Chrome. Videos need to turn sideways for full screen,
 * so the app follows the phone's rotation (no fixed orientation).
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    }
}
