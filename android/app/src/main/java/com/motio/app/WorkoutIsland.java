package com.motio.app;

import android.animation.ValueAnimator;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.PathInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

// The live island: a pill floating at the top of the screen while a workout records and Motio is in the
// background. Tap: it grows into a card with time, distance, pause/resume, end and open. Works on any
// Android that allows "display over other apps".
class WorkoutIsland {
    interface Actions { void on(String action); }

    private static final int PILL_W = 150, PILL_H = 38, CARD_W = 340, CARD_H = 196;
    private final Context ctx;
    private final WindowManager wm;
    private final Handler tick = new Handler(Looper.getMainLooper());
    private final Actions actions;
    private FrameLayout root;
    private LinearLayout card;
    private View pill, full, dot;
    private TextView pillTime, bigTime, title, detail, pauseBtn;
    private WindowManager.LayoutParams lp;
    private boolean expanded, animating;
    private ValueAnimator pulse;

    // Workout state, kept here so the clock runs even while the app's own code is asleep.
    private long start, pausedMs, pausedAt;
    private double distanceM;
    private String mode = "Run", unit = "km";
    private int color = 0xFFF2766B;

    WorkoutIsland(Context ctx, Actions actions) {
        this.ctx = ctx.getApplicationContext();
        this.wm = (WindowManager) this.ctx.getSystemService(Context.WINDOW_SERVICE);
        this.actions = actions;
    }

    static boolean allowed(Context c) { return Settings.canDrawOverlays(c); }

    private int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, ctx.getResources().getDisplayMetrics())); }

    void update(String mode, int color, long start, long pausedMs, long pausedAt, double distanceM, String unit) {
        this.mode = mode; this.color = color; this.start = start; this.pausedMs = pausedMs; this.pausedAt = pausedAt; this.distanceM = distanceM; this.unit = unit;
        if (root != null) render();
    }

    void show() {
        if (root != null || !allowed(ctx)) return;
        build();
        lp = new WindowManager.LayoutParams(dp(PILL_W), dp(PILL_H), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.y = dp(10);
        try { wm.addView(root, lp); } catch (Exception e) { root = null; return; }
        // Drops in from the top.
        card.setTranslationY(-dp(60)); card.setAlpha(0f);
        card.animate().translationY(0).alpha(1f).setDuration(420).setInterpolator(new PathInterpolator(0.22f, 1f, 0.36f, 1f)).start();
        render();
        tick.post(ticker);
        pulse = ValueAnimator.ofFloat(1f, 0.35f);
        pulse.setDuration(900); pulse.setRepeatMode(ValueAnimator.REVERSE); pulse.setRepeatCount(ValueAnimator.INFINITE);
        pulse.addUpdateListener((a) -> dot.setAlpha((float) a.getAnimatedValue()));
        pulse.start();
    }

    void hide() {
        tick.removeCallbacks(ticker);
        if (pulse != null) pulse.cancel();
        if (root == null) return;
        final FrameLayout r = root;
        root = null; expanded = false;
        card.animate().translationY(-dp(60)).alpha(0f).setDuration(240).withEndAction(() -> { try { wm.removeView(r); } catch (Exception e) { /* already gone */ } }).start();
    }

    private final Runnable ticker = new Runnable() {
        @Override public void run() { if (root != null) { render(); tick.postDelayed(this, 1000); } }
    };

    private long activeMs() {
        long now = System.currentTimeMillis();
        return Math.max(0, now - start - pausedMs - (pausedAt > 0 ? now - pausedAt : 0));
    }

    private void render() {
        long s = activeMs() / 1000;
        String clock = s >= 3600 ? String.format("%d:%02d:%02d", s / 3600, (s / 60) % 60, s % 60) : String.format("%d:%02d", s / 60, s % 60);
        boolean paused = pausedAt > 0;
        pillTime.setText(paused ? "Paused" : clock);
        bigTime.setText(clock);
        double d = unit.equals("mi") ? distanceM / 1609.34 : distanceM / 1000;
        String pace = "";
        if (d > 0.05 && !mode.equals("Ride")) { double p = activeMs() / 1000.0 / d; pace = String.format("  ·  %d:%02d /%s", (int) (p / 60), (int) (p % 60), unit); }
        else if (d > 0.05) { pace = String.format("  ·  %.1f %s/h", d / (activeMs() / 3600000.0), unit); }
        detail.setText(String.format("%.2f %s", d, unit) + pace);
        title.setText(paused ? mode + " · paused" : mode);
        ((GradientDrawable) dot.getBackground()).setColor(paused ? 0xFFF6C343 : color);
        pauseBtn.setText(paused ? "Resume" : "Pause");
    }

    private TextView text(float sp, int style, int color) {
        TextView t = new TextView(ctx);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTypeface(Typeface.create("sans-serif", style));
        t.setTextColor(color);
        t.setSingleLine(true);
        return t;
    }

    private TextView button(String label, int bg, int fg, String action) {
        TextView b = text(14, Typeface.BOLD, fg);
        b.setText(label);
        b.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable(); g.setColor(bg); g.setCornerRadius(dp(20)); b.setBackground(g);
        b.setOnClickListener((v) -> { v.animate().scaleX(0.94f).scaleY(0.94f).setDuration(80).withEndAction(() -> v.animate().scaleX(1f).scaleY(1f).setDuration(120).start()).start(); actions.on(action); });
        return b;
    }

    private void build() {
        root = new FrameLayout(ctx);
        card = new LinearLayout(ctx);
        card.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable(); bg.setColor(0xFF0E0D1A); bg.setCornerRadius(dp(PILL_H / 2f)); card.setBackground(bg);
        card.setElevation(dp(8));
        root.addView(card, new FrameLayout.LayoutParams(dp(PILL_W), dp(PILL_H), Gravity.CENTER_HORIZONTAL | Gravity.TOP));

        // Collapsed: dot + time.
        LinearLayout p = new LinearLayout(ctx);
        p.setGravity(Gravity.CENTER);
        p.setPadding(dp(14), 0, dp(14), 0);
        dot = new View(ctx);
        GradientDrawable dg = new GradientDrawable(); dg.setShape(GradientDrawable.OVAL); dg.setColor(color); dot.setBackground(dg);
        p.addView(dot, new LinearLayout.LayoutParams(dp(9), dp(9)));
        pillTime = text(14, Typeface.BOLD, Color.WHITE);
        pillTime.setFontFeatureSettings("tnum");
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); tl.leftMargin = dp(8);
        p.addView(pillTime, tl);
        pill = p;
        card.addView(pill, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(PILL_H)));

        // Expanded: title, big clock, distance/pace, and actions.
        LinearLayout f = new LinearLayout(ctx);
        f.setOrientation(LinearLayout.VERTICAL);
        f.setPadding(dp(18), 0, dp(18), dp(16));
        title = text(13, Typeface.BOLD, 0xFFC9C5EC);
        bigTime = text(34, Typeface.BOLD, Color.WHITE);
        bigTime.setFontFeatureSettings("tnum");
        detail = text(13, Typeface.NORMAL, 0xFFC9C5EC);
        f.addView(title); f.addView(bigTime); f.addView(detail);
        LinearLayout row = new LinearLayout(ctx);
        row.setPadding(0, dp(12), 0, 0);
        pauseBtn = button("Pause", 0xFF2D2A6E, Color.WHITE, "toggle");
        TextView end = button("End", 0xFFF2766B, 0xFF16142F, "end");
        TextView open = button("Open", Color.WHITE, 0xFF16142F, "open");
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(0, dp(40), 1f);
        LinearLayout.LayoutParams bm = new LinearLayout.LayoutParams(0, dp(40), 1f); bm.leftMargin = dp(8);
        LinearLayout.LayoutParams br = new LinearLayout.LayoutParams(0, dp(40), 1f); br.leftMargin = dp(8);
        row.addView(pauseBtn, bl); row.addView(end, bm); row.addView(open, br);
        f.addView(row);
        full = f;
        full.setVisibility(View.GONE);
        card.addView(full, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // First tap expands, a tap on the open card goes to the workout in Motio.
        card.setOnClickListener((v) -> { if (animating) return; if (!expanded) setExpanded(true); else actions.on("open"); });
        // Tapping the clock area while expanded folds it back up.
        pill.setOnClickListener((v) -> { if (!animating) setExpanded(!expanded); });
    }

    // Grows or shrinks the card smoothly; the window is resized at the edge of the animation so taps
    // outside the small pill keep going to the app underneath.
    private void setExpanded(boolean open) {
        animating = true;
        final int w0 = card.getWidth(), h0 = card.getHeight();
        final int w1 = dp(open ? CARD_W : PILL_W), h1 = dp(open ? CARD_H : PILL_H);
        if (open) { lp.width = dp(CARD_W); lp.height = dp(CARD_H); wm.updateViewLayout(root, lp); full.setVisibility(View.VISIBLE); full.setAlpha(0f); }
        final GradientDrawable bg = (GradientDrawable) card.getBackground();
        ValueAnimator a = ValueAnimator.ofFloat(0f, 1f);
        a.setDuration(open ? 420 : 320);
        a.setInterpolator(new PathInterpolator(0.22f, 1f, 0.36f, 1f));
        a.addUpdateListener((va) -> {
            float t = (float) va.getAnimatedValue();
            FrameLayout.LayoutParams p = (FrameLayout.LayoutParams) card.getLayoutParams();
            p.width = Math.round(w0 + (w1 - w0) * t); p.height = Math.round(h0 + (h1 - h0) * t);
            card.setLayoutParams(p);
            bg.setCornerRadius(dp(open ? PILL_H / 2f + (28 - PILL_H / 2f) * t : 28 + (PILL_H / 2f - 28) * t));
            full.setAlpha(open ? Math.max(0f, (t - 0.35f) / 0.65f) : Math.max(0f, 1f - t * 2f));
            pillTime.setAlpha(open ? 1f - t : t); // the big clock takes over while open
        });
        a.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override public void onAnimationEnd(android.animation.Animator an) {
                expanded = open; animating = false;
                if (!open && root != null) { full.setVisibility(View.GONE); lp.width = dp(PILL_W); lp.height = dp(PILL_H); wm.updateViewLayout(root, lp); }
            }
        });
        a.start();
    }

    // Brings Motio to the front, on the workout screen.
    static void openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        i.putExtra("motio.open", "live");
        c.startActivity(i);
    }
}
