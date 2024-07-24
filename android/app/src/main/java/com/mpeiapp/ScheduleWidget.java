package com.mpeiapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.widget.RemoteViews;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

public class ScheduleWidget extends AppWidgetProvider {

    private static final String ACTION_YESTERDAY = "com.mpeiapp.ScheduleWidget.ACTION_YESTERDAY";
    private static final String ACTION_TODAY = "com.mpeiapp.ScheduleWidget.ACTION_TODAY";
    private static final String ACTION_TOMORROW = "com.mpeiapp.ScheduleWidget.ACTION_TOMORROW";
    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId, String day) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.schedule_widget);

        try {
            SharedPreferences sharedPref = context.getSharedPreferences("DATA", Context.MODE_PRIVATE);
            String scheduleDataString = sharedPref.getString("appData", "{\"schedule\":'no data'}");
            Log.i("ScheduleWidget", "Schedule Data: " + scheduleDataString);
        }catch (Exception e) {
            Log.e("ScheduleWidget", "Obtaining schedule Data failed: ", e);
        }

        // Update date text based on the selected day
        String dateText = getDateText(day); // Implement this method to return the date string based on the day
        views.setTextViewText(R.id.date_text, dateText);

        // Clear the existing schedule
        views.removeAllViews(R.id.schedule_container);

        // Load schedule data for the selected day
        List<ScheduleItem> scheduleItems = getScheduleForDay(day); // Implement this method to return a list of schedule items for the day

        // Clear previous schedule items
        views.removeAllViews(R.id.schedule_container);
        for (ScheduleItem item : scheduleItems) {
            RemoteViews itemView = new RemoteViews(context.getPackageName(), R.layout.schedule_item);
            itemView.setTextViewText(R.id.schedule_time, item.getTime());
            itemView.setTextViewText(R.id.schedule_subject, item.getSubject());
            itemView.setTextViewText(R.id.schedule_teacher, item.getTeacher());

            views.addView(R.id.schedule_container, itemView);
        }

        // Set up intents for buttons
        Intent intentYesterday = new Intent(context, ScheduleWidget.class);
        intentYesterday.setAction(ACTION_YESTERDAY);
        PendingIntent pendingIntentYesterday = PendingIntent.getBroadcast(context, 0, intentYesterday, (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        views.setOnClickPendingIntent(R.id.btnYesterday, pendingIntentYesterday);

        Intent intentToday = new Intent(context, ScheduleWidget.class);
        intentToday.setAction(ACTION_TODAY);
        PendingIntent pendingIntentToday = PendingIntent.getBroadcast(context, 0, intentToday, (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        views.setOnClickPendingIntent(R.id.btnToday, pendingIntentToday);

        Intent intentTomorrow = new Intent(context, ScheduleWidget.class);
        intentTomorrow.setAction(ACTION_TOMORROW);
        PendingIntent pendingIntentTomorrow = PendingIntent.getBroadcast(context, 0, intentTomorrow, (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        views.setOnClickPendingIntent(R.id.btnTomorrow, pendingIntentTomorrow);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        // There may be multiple widgets active, so update all of them
        for (int appWidgetId : appWidgetIds) {
            // Default to today
            Log.i("ScheduleWidget", "updating AppWidget onUpdate...");
            updateAppWidget(context, appWidgetManager, appWidgetId, "today");
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        Log.i("ScheduleWidget", "onReceive - action: " + intent.getAction());
        if (Objects.equals(intent.getAction(), ACTION_YESTERDAY)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisAppWidget = new ComponentName(context.getPackageName(), ScheduleWidget.class.getName());
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget);

            for (int appWidgetId : appWidgetIds) {
                Log.i("ScheduleWidget", "updating AppWidget - ACTION_YESTERDAY...");
                updateAppWidget(context, appWidgetManager, appWidgetId, "yesterday");
            }
        } else if (Objects.equals(intent.getAction(), ACTION_TODAY)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisAppWidget = new ComponentName(context.getPackageName(), ScheduleWidget.class.getName());
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget);

            for (int appWidgetId : appWidgetIds) {
                Log.i("ScheduleWidget", "updating AppWidget - ACTION_TODAY...");
                updateAppWidget(context, appWidgetManager, appWidgetId, "today");
            }
        } else if (Objects.equals(intent.getAction(), ACTION_TOMORROW)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisAppWidget = new ComponentName(context.getPackageName(), ScheduleWidget.class.getName());
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget);

            for (int appWidgetId : appWidgetIds) {
                Log.i("ScheduleWidget", "updating AppWidget - ACTION_TOMORROW...");
                updateAppWidget(context, appWidgetManager, appWidgetId, "tomorrow");
            }
        }
    }

    // Helper methods to get date text and schedule data
    private static String getDateText(String day) {
        // Implement this method to return the date text based on the day
        return day;
    }

    private static List<ScheduleItem> getScheduleForDay(String day) {
        // Implement this method to return the schedule items for the given day
        ScheduleItem sch_item = new ScheduleItem("00-00", "Test sub", "Test tea");
        ScheduleItem sch_item1 = new ScheduleItem("00-01", "Test sub1", "Test tea1");
        List<ScheduleItem> schlist = Collections.emptyList();
        List<ScheduleItem> res = new ArrayList<>(schlist);
        res.add(sch_item);
        res.add(sch_item1);
        return res;
    }

    public static class ScheduleItem {
        private String time;
        private String subject;
        private String teacher;

        public ScheduleItem(String time, String subject, String teacher) {
            this.time = time;
            this.subject = subject;
            this.teacher = teacher;
        }

        public String getTime() {
            return time;
        }

        public String getSubject() {
            return subject;
        }

        public String getTeacher() {
            return teacher;
        }
    }
}
