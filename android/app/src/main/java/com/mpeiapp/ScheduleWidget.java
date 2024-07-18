package com.mpeiapp;

import android.annotation.SuppressLint;
import android.app.PendingIntent;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.content.SharedPreferences;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class ScheduleWidget extends AppWidgetProvider {

    private static final String ACTION_YESTERDAY = "com.mpeiapp.ScheduleWidget.ACTION_YESTERDAY";
    private static final String ACTION_TODAY = "com.mpeiapp.ScheduleWidget.ACTION_TODAY";
    private static final String ACTION_TOMORROW = "com.mpeiapp.ScheduleWidget.ACTION_TOMORROW";

    private static final SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());

    private static final Map<String, List<ScheduleItem>> scheduleData = new HashMap<String, List<ScheduleItem>>() {{
        put("2024-07-15", List.of(
                new ScheduleItem("08:00", "Math", "Mr. Smith"),
                new ScheduleItem("10:00", "English", "Ms. Johnson")
        ));
        put("2024-07-16", List.of(
                new ScheduleItem("09:00", "Science", "Mr. Doe")
        ));
        put("2024-07-17", List.of(
                new ScheduleItem("08:00", "Math", "Mr. Smith"),
                new ScheduleItem("11:00", "Art", "Ms. Brown")
        ));
    }};

    private static String getCurrentDate() {
        return dateFormat.format(Calendar.getInstance().getTime());
    }

    private static String getYesterdayDate() {
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.DATE, -1);
        return dateFormat.format(calendar.getTime());
    }

    private static String getTomorrowDate() {
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.DATE, 1);
        return dateFormat.format(calendar.getTime());
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId, String date) {
        @SuppressLint("RemoteViewLayout") RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.schedule_widget);

        List<ScheduleItem> scheduleItems = null;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            scheduleItems = scheduleData.getOrDefault(date, new ArrayList<>());
        }
        StringBuilder scheduleText = new StringBuilder();
        assert scheduleItems != null;
        for (ScheduleItem item : scheduleItems) {
            scheduleText.append(item.getTime())
                    .append(" - ")
                    .append(item.getSubject())
                    .append(" (Teacher: ")
                    .append(item.getTeacher())
                    .append(")\n");
        }

        views.setTextViewText(R.id.date_text, "Schedule for " + date);

        // Clear previous schedule items
        views.removeAllViews(R.id.schedule_container);
        for (ScheduleItem item : scheduleItems) {
            RemoteViews itemView = new RemoteViews(context.getPackageName(), R.layout.schedule_item);
            itemView.setTextViewText(R.id.schedule_time, item.getTime());
            itemView.setTextViewText(R.id.schedule_subject, item.getSubject());
            itemView.setTextViewText(R.id.schedule_teacher, "Teacher: " + item.getTeacher());
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
        String todayDate = getCurrentDate();
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId, todayDate);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, ScheduleWidget.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);

        String action = intent.getAction();
        String date = getCurrentDate();
        if (ACTION_YESTERDAY.equals(action)) {
            date = getYesterdayDate();
        } else if (ACTION_TODAY.equals(action)) {
            date = getCurrentDate();
        } else if (ACTION_TOMORROW.equals(action)) {
            date = getTomorrowDate();
        }

        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId, date);
        }
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