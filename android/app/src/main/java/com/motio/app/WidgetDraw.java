package com.motio.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Build;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

// Draws the widgets natively at the size they have on the home screen, in the same palette and layout as the
// images src/widgets.js used to draw for them (sizes there are on a 400 × 400 card, hence the m * x/400 below).
final class WidgetDraw {
    static final int INK = 0xFF1F1D47, GREY = 0xFF6B6890, BRAND = 0xFF4B3FD8, YELLOW = 0xFFF6C343, GREEN = 0xFF3DBF5C,
        CORAL = 0xFFF2766B, LILAC = 0xFFB57BE0, WHITE = 0xFFFFFFFF;
    static final long STALE = 60 * 60000;

    static Bitmap draw(Context c, String kind, int wDp, int hDp) {
        JSONObject d = MotioWidget.data(c);
        if (d == null) return null; // "Open Motio once"
        if (wDp <= 0 || hDp <= 0) { boolean wide = !kind.equals("ring") && !kind.equals("steps") && !kind.equals("streak"); wDp = wide ? 320 : 160; hDp = kind.equals("compact") ? 60 : 160; }
        float dp = Math.min(c.getResources().getDisplayMetrics().density, 720f / Math.max(wDp, hDp)); // keeps bitmaps small
        int W = Math.max(1, Math.round(wDp * dp)), H = Math.max(1, Math.round(hDp * dp));
        long now = System.currentTimeMillis();
        boolean today = d.optLong("day0") == MotioWidget.dayStart(now, 0);
        if (d.optBoolean("signedOut")) return message(W, H, dp, BRAND, WHITE, "Sign in to Motio", "to see your day here");
        JSONObject zero = d.optJSONObject("zero");
        String time = today || zero == null ? d.optString("time") : zero.optString("time"), dist = today || zero == null ? d.optString("dist") : zero.optString("dist");
        long at = d.optLong("at");
        switch (kind) {
            case "ring": return ring(c, W, H, dp, time, d.optString("goal"), today ? d.optDouble("pct", 0) : 0, at);
            case "steps": return steps(c, W, H, dp, MotioWidget.steps(c), d.optInt("stepGoal", 10000), Math.max(at, MotioWidget.prefs(c).getLong("sAt", 0)));
            case "streak": {
                int streak = today ? d.optInt("streak") : d.optLong("day0") == MotioWidget.dayStart(now, -1) && d.optBoolean("moved") ? d.optInt("streak") : 0;
                return streak(W, H, dp, streak);
            }
            case "compact": return compact(c, W, H, dp, String.format(Locale.US, "%,d steps", MotioWidget.steps(c)), dist, time, at);
            case "road": case "week":
                if (!today) return message(W, H, dp, WHITE, INK, "New day", "Open Motio to fill it in");
                return image(c, kind, at, GREY);
            case "persona": return image(c, kind, at, 0xB3FFFFFF);
            case "challenge": return image(c, kind, at, 0xB31F1D47);
            default: return image(c, kind, at, GREY);
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

    static Canvas card(Bitmap b, float dp, int bg) {
        Canvas g = new Canvas(b);
        float r = Math.min(Math.min(b.getWidth(), b.getHeight()) * 0.14f, 24 * dp);
        g.drawRoundRect(new RectF(0, 0, b.getWidth(), b.getHeight()), r, r, fill(bg));
        return g;
    }

    // "updated 14:05" (with the weekday once it's from another day), only when the numbers may be old.
    static String stamp(Context c, long at) {
        long now = System.currentTimeMillis();
        if (at <= 0 || now - at < STALE) return null;
        String t = android.text.format.DateFormat.getTimeFormat(c).format(new Date(at));
        return "updated " + (at < MotioWidget.dayStart(now, 0) ? new SimpleDateFormat("EEE", Locale.getDefault()).format(new Date(at)) + " " : "") + t;
    }

    static Bitmap ring(Context c, int W, int H, float dp, String time, String goal, double pct, long at) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp, BRAND);
        float m = Math.min(W, H), cx = W / 2f, cy = H / 2f, R = m * 0.36f;
        Paint s = new Paint(Paint.ANTI_ALIAS_FLAG);
        s.setStyle(Paint.Style.STROKE); s.setStrokeWidth(m * 0.075f); s.setStrokeCap(Paint.Cap.ROUND);
        s.setColor(0x2EFFFFFF); g.drawCircle(cx, cy, R, s);
        if (pct > 0) { s.setColor(YELLOW); g.drawArc(new RectF(cx - R, cy - R, cx + R, cy + R), -90, (float) (360 * Math.min(1, pct)), false, s); }
        Paint t = fit(text(WHITE, 700, m * 0.165f), time, R * 1.5f);
        t.setTextAlign(Paint.Align.CENTER); g.drawText(time, cx, cy + m * 0.03f, t);
        Paint sub = text(0xCCFFFFFF, 500, m * 0.065f); sub.setTextAlign(Paint.Align.CENTER);
        g.drawText("of " + goal, cx, cy + m * 0.13f, sub);
        String st = stamp(c, at);
        if (st != null) { Paint p = fit(text(0xB3FFFFFF, 500, m * 0.048f), st, R * 1.3f); p.setTextAlign(Paint.Align.CENTER); g.drawText(st, cx, cy + m * 0.21f, p); }
        return b;
    }

    static Bitmap steps(Context c, int W, int H, float dp, long steps, int goal, long at) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp, GREEN);
        float m = Math.min(W, H), u = m / 400, pad = m * 0.1f;
        Paint ink = fill(INK);
        footprint(g, 64 * u, 70 * u, 12 * u, 18 * u, -11, ink);
        footprint(g, 94 * u, 98 * u, 12 * u, 18 * u, 11, ink);
        String n = String.format(Locale.US, "%,d", steps);
        g.drawText(n, pad, H - m * 0.38f, fit(text(INK, 700, m * 0.21f), n, W - 2 * pad));
        double pct = goal > 0 ? (double) steps / goal : 0;
        String line = "steps · " + Math.round(pct * 100) + "% of " + Math.round(goal / 1000f) + "k";
        g.drawText(line, pad, H - m * 0.27f, fit(text(INK, 500, m * 0.065f), line, W - 2 * pad));
        float y = H - m * 0.175f, bh = m * 0.045f, bw = W - 2 * pad;
        g.drawRoundRect(new RectF(pad, y, pad + bw, y + bh), bh / 2, bh / 2, fill(0x2E1F1D47));
        g.drawRoundRect(new RectF(pad, y, pad + Math.max(bh, (float) (bw * Math.min(1, pct))), y + bh), bh / 2, bh / 2, ink);
        String st = stamp(c, at);
        if (st != null) { Paint p = text(0xB31F1D47, 500, m * 0.05f); p.setTextAlign(Paint.Align.RIGHT); g.drawText(st, W - pad, pad + m * 0.03f, p); }
        return b;
    }

    static void footprint(Canvas g, float x, float y, float rx, float ry, float deg, Paint p) {
        g.save(); g.rotate(deg, x, y); g.drawOval(new RectF(x - rx, y - ry, x + rx, y + ry), p); g.restore();
    }

    static Bitmap streak(int W, int H, float dp, int streak) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp, CORAL);
        float m = Math.min(W, H), u = m / 400, pad = m * 0.1f;
        Path f = new Path();
        f.moveTo(70 * u, 112 * u);
        f.cubicTo(40 * u, 80 * u, 64 * u, 50 * u, 78 * u, 34 * u);
        f.cubicTo(84 * u, 60 * u, 108 * u, 62 * u, 104 * u, 92 * u);
        f.cubicTo(102 * u, 108 * u, 88 * u, 118 * u, 70 * u, 112 * u);
        g.drawPath(f, fill(INK));
        String n = String.valueOf(streak);
        g.drawText(n, pad, H - m * 0.325f, fit(text(INK, 700, m * 0.33f), n, W - 2 * pad));
        g.drawText(streak == 1 ? "day moving" : "days moving", pad, H - m * 0.21f, text(INK, 600, m * 0.07f));
        g.drawText("in a row", pad, H - m * 0.125f, text(0xBF1F1D47, 500, m * 0.06f));
        return b;
    }

    // One row: steps, distance and time, for a 4 × 1 (or narrower) spot.
    static Bitmap compact(Context c, int W, int H, float dp, String steps, String dist, String time, long at) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp, INK);
        String[] vals = { steps, dist, time };
        int[] cols = { GREEN, LILAC, YELLOW };
        int n = W >= H * 3.6f ? 3 : 2;
        float padX = H * 0.28f, cell = (W - 2 * padX) / n, base = H * 0.5f + H * 0.1f;
        for (int i = 0; i < n; i++) {
            float x = padX + i * cell;
            g.drawCircle(x + H * 0.07f, H * 0.5f, H * 0.07f, fill(cols[i]));
            g.drawText(vals[i], x + H * 0.22f, base, fit(text(WHITE, 600, H * 0.3f), vals[i], cell - H * 0.3f));
        }
        String st = stamp(c, at);
        if (st != null) { Paint p = text(0x99FFFFFF, 500, H * 0.14f); p.setTextAlign(Paint.Align.RIGHT); g.drawText(st, W - padX, H * 0.9f, p); }
        return b;
    }

    // A plain card with a title and a line: signed out, or a new day the app hasn't drawn yet.
    static Bitmap message(int W, int H, float dp, int bg, int fg, String title, String line) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas g = card(b, dp, bg);
        float t = Math.min(H * 0.28f, W * 0.1f), pad = Math.min(W, H) * 0.1f, top = (H - t * 1.85f) / 2;
        g.drawText(title, pad, top + t * 0.9f, fit(text(fg, 700, t), title, W - 2 * pad));
        g.drawText(line, pad, top + t * 1.75f, fit(text((fg & 0x00FFFFFF) | 0xBF000000, 500, t * 0.55f), line, W - 2 * pad));
        return b;
    }

    // An image the app drew, with the stamp in its top right corner when it may be old.
    static Bitmap image(Context c, String kind, long at, int stampColor) {
        File f = MotioWidget.file(c, kind);
        if (!f.exists()) return null;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inMutable = true;
        Bitmap b = BitmapFactory.decodeFile(f.getAbsolutePath(), o);
        String st = b == null ? null : stamp(c, at);
        if (st != null) {
            Paint p = text(stampColor, 500, 20); p.setTextAlign(Paint.Align.RIGHT); // the app's images are 400 px per 2 cells
            new Canvas(b).drawText(st, b.getWidth() - 40, 40, p);
        }
        return b;
    }
}
