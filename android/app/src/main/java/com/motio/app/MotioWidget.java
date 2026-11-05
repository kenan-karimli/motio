package com.motio.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.view.View;
import android.widget.RemoteViews;
import java.io.File;

// Home screen widgets. The app draws each one as an image (same look as the in-app previews) and saves it;
// the widget just shows the latest image and opens Motio when tapped. This base class is the Today ring.
public class MotioWidget extends AppWidgetProvider {
    public static final String[] KINDS = { "ring", "steps", "road", "streak", "persona", "week" };

    protected String kind() { return "ring"; }

    public static Class<? extends MotioWidget> classFor(String kind) {
        switch (kind) {
            case "steps": return Steps.class;
            case "road": return Road.class;
            case "streak": return Streak.class;
            case "persona": return Persona.class;
            case "week": return Week.class;
            default: return MotioWidget.class;
        }
    }

    static File file(Context c, String kind) { return new File(c.getFilesDir(), "widget_" + kind + ".png"); }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context, kind()));
    }

    static RemoteViews views(Context context, String kind) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.motio_widget_img);
        File f = file(context, kind);
        Bitmap bmp = f.exists() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
        if (bmp != null) {
            v.setImageViewBitmap(R.id.widget_img, bmp);
            v.setViewVisibility(R.id.widget_empty, View.GONE);
        } else {
            v.setViewVisibility(R.id.widget_empty, View.VISIBLE);
        }
        Intent open = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        return v;
    }

    static void refresh(Context context, String kind) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, classFor(kind)));
        for (int id : ids) m.updateAppWidget(id, views(context, kind));
    }

    public static class Steps extends MotioWidget { @Override protected String kind() { return "steps"; } }
    public static class Road extends MotioWidget { @Override protected String kind() { return "road"; } }
    public static class Streak extends MotioWidget { @Override protected String kind() { return "streak"; } }
    public static class Persona extends MotioWidget { @Override protected String kind() { return "persona"; } }
    public static class Week extends MotioWidget { @Override protected String kind() { return "week"; } }
}
