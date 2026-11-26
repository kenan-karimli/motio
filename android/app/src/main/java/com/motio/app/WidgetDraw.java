package com.motio.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Build;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

// Draws the widgets natively at the size they have on the home screen (Motio 5.0 board 11): white cards with ink
// text in the light theme, near-black cards at night. Colour only for meaning: the goal is yellow.
final class WidgetDraw {
    static final int GOAL = 0xFFF6C343, WHITE = 0xFFFFFFFF;
    static final long STALE = 60 * 60000;
    // Card, ink, grey, track (bars and rings): light, then dark.
    static int BG = WHITE, INK = 0xFF0F0F0F, MUTE = 0xFF6E6E6A, LINE = 0xFFECECEA;

    static void theme(Context c, JSONObject d) {
        String t = d.optString("theme", "system");
        boolean night = (c.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        boolean dark = "dark".equals(t) || ("system".equals(t) && night);
        BG = dark ? 0xFF1A1A1A : WHITE; INK = dark ? 0xFFF2F2F0 : 0xFF0F0F0F; MUTE = dark ? 0xFF8F8F8A : 0xFF6E6E6A; LINE = dark ? 0xFF2C2C2C : 0xFFECECEA;
        isDark = dark;
    }
    static boolean isDark = false;

    static Bitmap draw(Context c, String kind, int wDp, int hDp) {
        JSONObject d = MotioWidget.data(c);
        if (d == null) return null; // "Open Motio once"
        theme(c, d);
        if (wDp <= 0 || hDp <= 0) { boolean wide = !kind.equals("ring") && !kind.equals("steps") && !kind.equals("streak") && !kind.equals("persona"); wDp = wide ? 320 : 160; hDp = kind.equals("compact") ? 60 : 160; }
        float dp = Math.min(c.getResources().getDisplayMetrics().density, 720f / Math.max(wDp, hDp)); // keeps bitmaps small
        int W = Math.max(1, Math.round(wDp * dp)), H = Math.max(1, Math.round(hDp * dp));
        long now = System.currentTimeMillis();
        boolean today = d.optLong("day0") == MotioWidget.dayStart(now, 0);
        if (d.optBoolean("signedOut")) return message(W, H, dp, "Sign in to Motio", "to see your day here");
        JSONObject zero = d.optJSONObject("zero");
        String time = today || zero == null ? d.optString("time") : zero.optString("time"), dist = today || zero == null ? d.optString("dist") : zero.optString("dist");
        long at = d.optLong("at");
        switch (kind) {
            case "ring": return today(c, W, H, dp, time, today ? d.optInt("min") : 0, d.optInt("goalMin", 180), at);
            case "steps": return steps(c, W, H, dp, MotioWidget.steps(c), d.optInt("stepGoal", 10000), Math.max(at, MotioWidget.prefs(c).getLong("sAt", 0)));
            case "streak": {
                int streak = today ? d.optInt("streak") : d.optLong("day0") == MotioWidget.dayStart(now, -1) && d.optBoolean("moved") ? d.optInt("streak") : 0;
                return streak(W, H, dp, streak, Math.max(streak, d.optInt("bestStreak")));
            }
            case "compact": return compact(c, W, H, dp, String.format(Locale.US, "%,d steps", MotioWidget.steps(c)), dist, time, today ? d.optInt("min") : 0, d.optInt("goalMin", 180), at);
            case "road": case "week":
                if (!today) return message(W, H, dp, "New day", "Open Motio to fill it in");
                // Tall enough for the Today rail (4 × 3 cells and up): the large layout.
                return image(c, kind.equals("road") && hDp > wDp * 0.8f ? "road_large" : kind, at);
            default: return image(c, kind, at);
        }
    }

    static Typeface face(int weight) {
        if (Build.VERSION.SDK_INT >= 28) return Typeface.create(Typeface.SANS_SERIF, weight, false);
        return weight >= 700 ? Typeface.DEFAULT_BOLD : Typeface.create(weight >= 500 ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL);
    }

    static Paint text(int color, int weight, float px) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(color); p.setTypeface(face(weight)); p.setTextSize(px);
        return p;
    }

    static Paint fill(int color) { Paint p = new Paint(Paint.ANTI_ALIAS_FLAG); p.setColor(color); return p; }

    // Shrinks text until it fits the given width.
    static Paint fit(Paint p, String s, float maxW) {
        while (p.measureText(s) > maxW && p.getTextSize() > 8) p.setTextSize(p.getTextSize() * 0.92f);
        return p;
    }

    static Canvas card(Bitmap b, float dp) {
        Canvas g = new Canvas(b);
        float r = Math.min(Math.min(b.getWidth(), b.getHeight()) * 0.16f, 26 * dp);
        g.drawRoundRect(new RectF(0, 0, b.getWidth(), b.getHeight()), r, r, fill(BG));
        return g;
    }

    // "updated 14:05" (with the weekday once it's from another day), only when the numbers may be old.
    static String stamp(Context c, long at) {
        long now = System.currentTimeMillis();
        if (at <= 0 || now - at < STALE) return null;
        String t = android.text.format.DateFormat.getTimeFormat(c).format(new Date(at));
        return "updated " + (at < MotioWidget.dayStart(now, 0) ? new SimpleDateFormat("EEE", Locale.getDefault()).format(new Date(at)) + " " : "") + t;
    }

    static String mins(int m) { return m >= 60 ? (m / 60) + "h " + String.format(Locale.US, "%02d", m % 60) + "m" : m + " min"; }

    // The small grey label at the top left, "motio." (or the stale stamp) at the top right.
    static void header(Context c, Canvas g, int W, float m, String label, long at) {
        float pad = m * 0.094f, y = pad + m * 0.06f;
        Paint l = text(MUTE, 600, m * 0.06f); l.setLetterSpacing(0.04f);
        g.drawText(label, pad, y, l);
        String st = stamp(c, at);
        Paint r = st != null ? text(MUTE, 500, m * 0.05f) : text(INK, 600, m * 0.06f);
        r.setTextAlign(Paint.Align.RIGHT);
        g.drawText(st != null ? st : "motio.", W - pad, y, fit(r, st != null ? st : "motio.", W * 0.5f));
    }

    static void bar(Canvas g, float x, float y, float w, float h, double pct, int color) {
        g.drawRoundRect(new RectF(x, y, x + w, y + h), h / 2, h / 2, fill(LINE));
        if (pct > 0) g.drawRoundRect(new RectF(x, y, x + Math.max(h, (float) (w * Math.min(1, pct))), y + h), h / 2, h / 2, fill(color));
    }

    // Small · today: time moved, minutes to the goal, the goal bar.
    static Bitmap today(Context c, int W, int H, float dp, String time, int min, int goal, long at) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp);
        float m = Math.min(W, H), pad = m * 0.094f;
        header(c, g, W, m, "TODAY", at);
        int left = goal - min;
        g.drawText(time, pad, H * 0.6f, fit(text(INK, 600, m * 0.2f), time, W - 2 * pad));
        String sub = left > 0 ? mins(left) + " to goal" : "Goal done";
        g.drawText(sub, pad, H * 0.6f + m * 0.1f, fit(text(MUTE, 500, m * 0.07f), sub, W - 2 * pad));
        bar(g, pad, H - pad - m * 0.035f, W - 2 * pad, m * 0.035f, goal > 0 ? (double) min / goal : 0, GOAL);
        return b;
    }

    // Small · steps: a ring in ink around today's count.
    static Bitmap steps(Context c, int W, int H, float dp, long steps, int goal, long at) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp);
        float m = Math.min(W, H), cx = W / 2f, cy = H / 2f, R = m * 0.3f;
        Paint s = new Paint(Paint.ANTI_ALIAS_FLAG);
        s.setStyle(Paint.Style.STROKE); s.setStrokeWidth(m * 0.068f); s.setStrokeCap(Paint.Cap.ROUND);
        s.setColor(LINE); g.drawCircle(cx, cy, R, s);
        double pct = goal > 0 ? (double) steps / goal : 0;
        if (pct > 0) { s.setColor(pct >= 1 ? GOAL : INK); g.drawArc(new RectF(cx - R, cy - R, cx + R, cy + R), -90, (float) (360 * Math.min(1, pct)), false, s); }
        String n = String.format(Locale.US, "%,d", steps);
        Paint t = fit(text(INK, 600, m * 0.13f), n, R * 1.5f); t.setTextAlign(Paint.Align.CENTER);
        g.drawText(n, cx, cy + m * 0.03f, t);
        Paint sub = text(MUTE, 500, m * 0.06f); sub.setTextAlign(Paint.Align.CENTER);
        g.drawText("steps", cx, cy + m * 0.11f, sub);
        String st = stamp(c, at);
        if (st != null) { Paint p = fit(text(MUTE, 500, m * 0.045f), st, W * 0.8f); p.setTextAlign(Paint.Align.CENTER); g.drawText(st, cx, H - m * 0.04f, p); }
        return b;
    }

    // Small · streak: days in a row moving, and the best so far.
    static Bitmap streak(int W, int H, float dp, int streak, int best) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp);
        float m = Math.min(W, H), pad = m * 0.094f;
        Paint l = text(MUTE, 600, m * 0.06f); l.setLetterSpacing(0.04f);
        g.drawText("STREAK", pad, pad + m * 0.06f, l);
        String n = streak + (streak == 1 ? " day" : " days");
        g.drawText(n, pad, H * 0.6f, fit(text(INK, 600, m * 0.2f), n, W - 2 * pad));
        g.drawText("Best: " + best, pad, H - pad, text(MUTE, 500, m * 0.07f));
        return b;
    }

    // Slim · one row: time moved and the goal bar, then distance and steps, for a 4 × 1 (or narrower) spot.
    static Bitmap compact(Context c, int W, int H, float dp, String steps, String dist, String time, int min, int goal, long at) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp);
        float padX = H * 0.32f, base = H * 0.5f + H * 0.11f;
        Paint t = fit(text(INK, 600, H * 0.34f), time, W * 0.34f);
        g.drawText(time, padX, base, t);
        float x = padX + t.measureText(time) + H * 0.25f;
        String rest = W >= H * 3.6f ? dist + " · " + steps : dist;
        Paint r = fit(text(MUTE, 500, H * 0.24f), rest, W - x - padX); r.setTextAlign(Paint.Align.RIGHT);
        g.drawText(rest, W - padX, base, r);
        bar(g, padX, H - H * 0.16f, W - 2 * padX, H * 0.06f, goal > 0 ? (double) min / goal : 0, GOAL);
        String st = stamp(c, at);
        if (st != null) { Paint p = text(MUTE, 500, H * 0.14f); p.setTextAlign(Paint.Align.RIGHT); g.drawText(st, W - padX, H * 0.24f, p); }
        return b;
    }

    // A plain card with a title and a line: signed out, or a new day the app hasn't drawn yet.
    static Bitmap message(int W, int H, float dp, String title, String line) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp);
        float t = Math.min(H * 0.24f, W * 0.09f), pad = Math.min(W, H) * 0.1f, top = (H - t * 1.85f) / 2;
        g.drawText(title, pad, top + t * 0.9f, fit(text(INK, 600, t), title, W - 2 * pad));
        g.drawText(line, pad, top + t * 1.75f, fit(text(MUTE, 500, t * 0.55f), line, W - 2 * pad));
        return b;
    }

    // An image the app drew (the dark one at night), with the stamp in its top right corner when it may be old.
    static Bitmap image(Context c, String kind, long at) {
        File f = MotioWidget.file(c, kind + (isDark ? "_dark" : ""));
        if (!f.exists()) f = MotioWidget.file(c, kind);
        if (!f.exists() && kind.equals("road_large")) return image(c, "road", at);
        if (!f.exists()) return null;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inMutable = true;
        Bitmap b = BitmapFactory.decodeFile(f.getAbsolutePath(), o);
        String st = b == null ? null : stamp(c, at);
        if (st != null) {
            // Over "motio." in the header (the app's images are 2.4 px per board px, header at 42 px).
            Paint p = text(MUTE, 500, 24); p.setTextAlign(Paint.Align.RIGHT);
            Canvas g = new Canvas(b);
            Paint bg = fill(BG); g.drawRect(b.getWidth() - 200, 30, b.getWidth() - 36, 80, bg);
            g.drawText(st, b.getWidth() - 42, 66, p);
        }
        return b;
    }
}
