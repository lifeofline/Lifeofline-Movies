package com.lifeofline.movies.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * Lifeofline Movies on Android TV / Google TV.
 * The whole app is the website (movies.lifeofline.com) in a full-screen web view. The site sees
 * "LifeoflineTV" in the browser name and switches to its TV layout: big tiles, remote-control
 * arrows, no Premium sales (bought on the website, it unlocks here after signing in).
 */
public class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private View fullView;                       // a video playing in the page's own full screen
    private WebChromeClient.CustomViewCallback fullDone;
    private TextView offline;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#140F1C"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#140F1C"));
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " LifeoflineTV/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                // Everything stays inside the app (a TV has no other browser to hand links to).
                return !(scheme.equals("https") || scheme.equals("http"));
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) showOffline(true);
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (offline.getVisibility() == View.VISIBLE && url.contains(BuildConfig.HOST)) showOffline(false);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback cb) {
                if (fullView != null) { cb.onCustomViewHidden(); return; }
                fullView = view; fullDone = cb;
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }
            @Override public void onHideCustomView() { leaveFull(); }
        });

        offline = new TextView(this);
        offline.setText(R.string.offline);
        offline.setTextColor(Color.WHITE);
        offline.setTextSize(24);
        offline.setGravity(android.view.Gravity.CENTER);
        offline.setPadding(120, 0, 120, 0);
        offline.setVisibility(View.GONE);
        offline.setFocusable(true);
        offline.setOnClickListener(v -> { showOffline(false); web.reload(); });

        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(offline, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        hideBars();

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(BuildConfig.START_URL);
        web.requestFocus();
    }

    private void showOffline(boolean on) {
        offline.setVisibility(on ? View.VISIBLE : View.GONE);
        if (on) offline.requestFocus(); else web.requestFocus();
    }

    private void leaveFull() {
        if (fullView == null) return;
        root.removeView(fullView);
        fullView = null;
        if (fullDone != null) fullDone.onCustomViewHidden();
        fullDone = null;
        web.setVisibility(View.VISIBLE);
        web.requestFocus();
        hideBars();
    }

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        // The remote's Back button: leave full screen, else step back in the site (closes the player,
        // returns to the previous page), and only on the home screen leave the app.
        if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_UP) {
                if (fullView != null) leaveFull();
                else if (offline.getVisibility() == View.VISIBLE) finish();
                else if (web.canGoBack()) web.goBack();
                else finish();
            }
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); hideBars(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
