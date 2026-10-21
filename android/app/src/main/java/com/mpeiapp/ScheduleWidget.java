package com.mpeiapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ScheduleWidget extends AppWidgetProvider {
    private static final String TAG = "ScheduleWidget";
    private static final String ACTION_NAVIGATE = "com.mpeiapp.ScheduleWidget.NAVIGATE";
    private static final String LEGACY_ACTION = "com.mpeiapp.ScheduleWidget.ACTION_";
    private static final String STATE = "ScheduleWidgetState";
    private static final int TEXT = Color.rgb(238, 234, 244);
    private static final int MUTED = Color.rgb(130, 121, 146);
    private static final String[] MONTHS = {"янв.", "фев.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."};

    private static SharedPreferences state(Context context) {
        return context.getSharedPreferences(STATE, Context.MODE_PRIVATE);
    }

    static void clearState(Context context) { state(context).edit().clear().apply(); }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, ScheduleWidget.class))) {
            updateAppWidget(context, manager, id);
        }
    }

    /** Used by the configuration activity; regular updates preserve the user's choice. */
    public static void updateAppWidget(Context context, AppWidgetManager manager, int id, String selection) {
        state(context).edit().putString(id + ".selection", selection).putInt(id + ".lesson", 0).apply();
        updateAppWidget(context, manager, id);
    }

    static ScheduleWidgetData readData(Context context) {
        String raw = context.getSharedPreferences("DATA", Context.MODE_PRIVATE).getString("appData", null);
        if (raw != null) {
            try { return JsonParser.parseJson(raw); }
            catch (Exception error) { Log.w(TAG, "Could not read cached schedule: " + error.getClass().getSimpleName()); }
        }
        return new ScheduleWidgetData();
    }

    public static synchronized void updateAppWidget(Context context, AppWidgetManager manager, int id) {
        long now = System.currentTimeMillis();
        SharedPreferences preferences = state(context);
        String selection = ScheduleWidgetState.normalize(preferences.getString(id + ".selection", "today"), now);
        String date = ScheduleWidgetState.selectedDate(selection, now);
        int lessonOffset = date.equals(preferences.getString(id + ".displayed", "")) ? preferences.getInt(id + ".lesson", 0) : 0;
        preferences.edit().putString(id + ".selection", selection).putString(id + ".displayed", date)
                .putInt(id + ".lesson", lessonOffset).apply();
        ScheduleWidgetData data = readData(context);
        Bundle options = manager.getAppWidgetOptions(id);
        float fontScale = context.getResources().getConfiguration().fontScale;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ArrayList<SizeF> sizes = widgetSizes(options);
            if (sizes != null && !sizes.isEmpty()) {
                Map<SizeF, RemoteViews> variants = new LinkedHashMap<>();
                for (SizeF size : sizes) {
                    if (size != null && size.getWidth() > 0 && size.getHeight() > 0
                            && Float.isFinite(size.getWidth()) && Float.isFinite(size.getHeight())) {
                        variants.put(size, render(context, id, size.getWidth(), size.getHeight(), fontScale, data, selection, lessonOffset, now));
                        if (variants.size() == 16) break;
                    }
                }
                if (!variants.isEmpty()) { manager.updateAppWidget(id, new RemoteViews(variants)); return; }
            }
        }
        // Older/third-party launchers may not provide exact sizes. Supply both orientations.
        int minWidth = dimension(options, AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 240);
        int minHeight = dimension(options, AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 280);
        int maxWidth = dimension(options, AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, minWidth);
        int maxHeight = dimension(options, AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, minHeight);
        RemoteViews portrait = render(context, id, minWidth, maxHeight, fontScale, data, selection, lessonOffset, now);
        RemoteViews landscape = render(context, id, maxWidth, minHeight, fontScale, data, selection, lessonOffset, now);
        manager.updateAppWidget(id, new RemoteViews(landscape, portrait));
    }

    private static int dimension(Bundle options, String key, int fallback) {
        int value = options.getInt(key, fallback);
        return value > 0 ? value : fallback;
    }

    @SuppressWarnings("deprecation") // The typed overload is not present on Android 12.
    private static ArrayList<SizeF> widgetSizes(Bundle options) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, SizeF.class)
                : options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
    }

    private static RemoteViews render(Context context, int id, float width, float height, float fontScale,
                                      ScheduleWidgetData data, String selection, int offset, long now) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.schedule_widget);
        String date = ScheduleWidgetState.selectedDate(selection, now);
        List<String> dates = ScheduleWidgetState.dates(now);
        int index = dates.indexOf(date);
        int week = index / 7;
        ScheduleWidgetData.Day day = data.day(date);
        int total = day == null ? 0 : day.lessons.size();
        ScheduleWidgetState.Layout layout = new ScheduleWidgetState.Layout(width, height, fontScale, total);
        String first = dates.get(week * 7), last = dates.get(week * 7 + 6);
        String weekTitle = Integer.parseInt(first.substring(0, 2)) + (first.substring(3, 5).equals(last.substring(3, 5)) ? "" : " " + month(first))
                + "–" + Integer.parseInt(last.substring(0, 2)) + " " + month(last);
        views.setTextViewText(R.id.widget_week_title, weekTitle);
        views.setContentDescription(R.id.widget_week_title, "Расписание: " + first + " – " + last);
        views.setTextViewTextSize(R.id.widget_week_title, TypedValue.COMPLEX_UNIT_SP, layout.compact ? 11 : 12);
        views.setTextViewText(R.id.date_text, date.substring(0, 5) + (day == null ? " · Нет данных" : " · Пар: " + day.lessonCount()));
        views.setContentDescription(R.id.date_text, date + (day == null ? ", расписание не загружено" : ", пар: " + day.lessonCount()));
        views.setViewVisibility(R.id.date_text, layout.headingHeight == 0 ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_notice, layout.noticeHeight == 0 ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_notice, layout.compact ? "Обновить расписание в MpeiApp" : "Откройте MpeiApp, чтобы обновить расписание в виджете.");
        views.setTextViewTextSize(R.id.widget_notice, TypedValue.COMPLEX_UNIT_SP, layout.compact ? 9 : 10);
        views.setInt(R.id.widget_notice, "setMaxLines", layout.compact ? 1 : 2);
        setHeight(views, R.id.widget_week_controls, layout.topHeight);
        setHeight(views, R.id.widget_day_strip, layout.daysHeight);
        if (layout.headingHeight > 0) setHeight(views, R.id.date_text, layout.headingHeight);
        if (layout.noticeHeight > 0) setHeight(views, R.id.widget_notice, layout.noticeHeight);

        bind(views, context, id, R.id.widget_week_previous, "week_previous", null, week > 0, layout);
        bind(views, context, id, R.id.widget_week_next, "week_next", null, week < 1, layout);
        bind(views, context, id, R.id.widget_today, "today", null, true, layout);
        int start = ScheduleWidgetState.dayPageStart(index % 7, layout.daysPerPage);
        boolean dayPager = layout.daysPerPage < 7;
        views.setViewVisibility(R.id.widget_days_previous, dayPager ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_days_next, dayPager ? View.VISIBLE : View.GONE);
        bind(views, context, id, R.id.widget_days_previous, "days_previous", null, start > 0, layout);
        bind(views, context, id, R.id.widget_days_next, "days_next", null, start + layout.daysPerPage < 7, layout);
        views.removeAllViews(R.id.widget_days);
        for (int slot = 0; slot < layout.daysPerPage; slot++) {
            RemoteViews tab = new RemoteViews(context.getPackageName(), R.layout.schedule_widget_day);
            setHeight(tab, R.id.widget_day_root, layout.daysHeight - 2);
            int weekday = start + slot;
            if (weekday > 6) {
                tab.setViewVisibility(R.id.widget_day_root, View.INVISIBLE);
            } else {
                String key = dates.get(week * 7 + weekday);
                ScheduleWidgetData.Day tabDay = data.day(key);
                boolean selected = key.equals(date), today = key.equals(ScheduleWidgetState.format(now, "dd.MM.yyyy"));
                tab.setTextViewText(R.id.widget_day_weekday, new String[]{"Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"}[weekday]);
                tab.setTextViewText(R.id.widget_day_number, String.valueOf(Integer.parseInt(key.substring(0, 2))));
                tab.setTextViewText(R.id.widget_day_month, month(key));
                tab.setViewVisibility(R.id.widget_day_month, layout.compact ? View.GONE : View.VISIBLE);
                tab.setInt(R.id.widget_day_root, "setBackgroundResource", selected ? R.drawable.schedule_widget_selected : R.drawable.app_widget_rounded_corner);
                tab.setInt(R.id.widget_day_number, "setBackgroundResource", today ? R.drawable.schedule_widget_today : R.drawable.schedule_widget_date);
                tab.setTextColor(R.id.widget_day_number, tabDay == null && !today && !selected ? MUTED : TEXT);
                tab.setContentDescription(R.id.widget_day_root, key + (today ? ", сегодня" : "") + (selected ? ", выбран" : "")
                        + (tabDay == null ? ", расписание не загружено" : ", пар: " + tabDay.lessonCount()));
                bind(tab, context, id, R.id.widget_day_root, "select", key, true, layout);
            }
            views.addView(R.id.widget_days, tab);
        }

        int pageStart = ScheduleWidgetState.lessonPageStart(offset, total, layout.lessonsPerPage);
        int pageEnd = Math.min(total, pageStart + layout.lessonsPerPage);
        views.removeAllViews(R.id.schedule_container);
        boolean showLessons = total > 0 && layout.lessonsPerPage > 0;
        views.setViewVisibility(R.id.widget_empty, showLessons ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_empty, day == null ? "На этот день расписание не загружено. Откройте MpeiApp."
                : total == 0 ? "Занятий нет" : "Увеличьте высоту виджета, чтобы увидеть занятия.");
        if (showLessons) {
            for (int item = pageStart; item < pageEnd; item++) {
                ScheduleWidgetData.Lesson lesson = day.lessons.get(item);
                RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.schedule_item);
                row.setTextViewText(R.id.schedule_time, lesson.time);
                row.setTextViewText(R.id.schedule_discipline, lesson.name);
                row.setTextViewText(R.id.schedule_lesson_type, layout.compact && !lesson.cabinet.isEmpty() ? lesson.cabinet + " · " + lesson.type : lesson.type);
                row.setTextViewText(R.id.schedule_cabinet, lesson.cabinet);
                row.setTextViewText(R.id.schedule_teacher, lesson.teacher);
                row.setViewVisibility(R.id.widget_lesson_details, layout.compact ? View.GONE : View.VISIBLE);
                row.setTextViewTextSize(R.id.schedule_discipline, TypedValue.COMPLEX_UNIT_SP, layout.compact ? 11 : 12);
                int color = lesson.type.contains("абот") || lesson.type.contains("кзамен") || lesson.type.contains("ащита")
                        ? Color.rgb(255, 100, 110) : lesson.type.contains("екция") ? Color.rgb(130, 230, 150) : Color.rgb(244, 201, 122);
                row.setTextColor(R.id.schedule_lesson_type, color);
                row.setContentDescription(R.id.widget_lesson_root, lesson.time + ", " + lesson.name + ", " + lesson.type + ", " + lesson.cabinet + ", " + lesson.teacher);
                setHeight(row, R.id.widget_lesson_root, layout.rowHeight - 3);
                views.addView(R.id.schedule_container, row);
            }
        }
        boolean lessonPager = showLessons && total > layout.lessonsPerPage;
        views.setViewVisibility(R.id.widget_lesson_controls, lessonPager ? View.VISIBLE : View.GONE);
        if (lessonPager) {
            setHeight(views, R.id.widget_lesson_controls, layout.pagerHeight);
            views.setTextViewText(R.id.widget_lesson_page, (pageStart + 1) + "–" + pageEnd + " из " + total);
            bind(views, context, id, R.id.widget_lessons_previous, "lessons_previous", null, pageStart > 0, layout);
            bind(views, context, id, R.id.widget_lessons_next, "lessons_next", null, pageEnd < total, layout);
        }
        PendingIntent open = PendingIntent.getActivity(context, id,
                new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_notice, open);
        views.setOnClickPendingIntent(R.id.widget_empty, open);
        views.setOnClickPendingIntent(R.id.widget_week_title, open);
        return views;
    }

    private static void setHeight(RemoteViews views, int viewId, int dp) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) views.setViewLayoutHeight(viewId, dp, TypedValue.COMPLEX_UNIT_DIP);
    }

    private static String month(String date) { return MONTHS[Integer.parseInt(date.substring(3, 5)) - 1]; }

    private static void bind(RemoteViews views, Context context, int id, int view, String command,
                             String date, boolean enabled, ScheduleWidgetState.Layout layout) {
        views.setBoolean(view, "setEnabled", enabled);
        if (!"select".equals(command)) views.setTextColor(view, enabled ? TEXT : MUTED);
        if (!"select".equals(command) && !"today".equals(command)) views.setTextViewTextSize(view, TypedValue.COMPLEX_UNIT_DIP, 20);
        Intent intent = new Intent(context, ScheduleWidget.class).setAction(ACTION_NAVIGATE)
                .setData(new Uri.Builder().scheme("mpeiapp-widget").authority("schedule").appendPath(String.valueOf(id))
                        .appendPath(command).appendPath(date == null ? "" : date)
                        .appendQueryParameter("days", String.valueOf(layout.daysPerPage))
                        .appendQueryParameter("lessons", String.valueOf(layout.lessonsPerPage)).build())
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id).putExtra("command", command)
                .putExtra("date", date).putExtra("days", layout.daysPerPage).putExtra("lessons", layout.lessonsPerPage);
        views.setOnClickPendingIntent(view, PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) updateAppWidget(context, manager, id);
    }

    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        updateAppWidget(context, manager, id);
    }

    @Override public void onDeleted(Context context, int[] ids) {
        SharedPreferences.Editor editor = state(context).edit();
        for (int id : ids) editor.remove(id + ".selection").remove(id + ".lesson").remove(id + ".displayed");
        editor.apply();
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            updateAll(context);
        } else if (action != null && action.startsWith(LEGACY_ACTION)) {
            String choice = action.substring(LEGACY_ACTION.length()).toLowerCase(java.util.Locale.ROOT);
            if (!"today".equals(choice) && !"yesterday".equals(choice) && !"tomorrow".equals(choice)) return;
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            for (int id : manager.getAppWidgetIds(new ComponentName(context, ScheduleWidget.class))) updateAppWidget(context, manager, id, choice);
        } else if (ACTION_NAVIGATE.equals(action)) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            boolean found = false;
            for (int ownId : manager.getAppWidgetIds(new ComponentName(context, ScheduleWidget.class))) if (ownId == id) found = true;
            if (!found) return;
            navigate(context, id, intent);
            updateAppWidget(context, manager, id);
        }
    }

    private static void navigate(Context context, int id, Intent intent) {
        long now = System.currentTimeMillis();
        SharedPreferences preferences = state(context);
        String previous = preferences.getString(id + ".selection", "today");
        String selection = ScheduleWidgetState.normalize(previous, now);
        String date = ScheduleWidgetState.selectedDate(selection, now);
        int offset = date.equals(preferences.getString(id + ".displayed", "")) ? preferences.getInt(id + ".lesson", 0) : 0;
        String command = intent.getStringExtra("command");
        if ("today".equals(command)) { selection = "today"; offset = 0; }
        else if ("select".equals(command)) selection = ScheduleWidgetState.select(intent.getStringExtra("date"), now);
        else if ("week_previous".equals(command) || "week_next".equals(command)) {
            selection = ScheduleWidgetState.moveWeek(selection, "week_previous".equals(command) ? -1 : 1, now);
        } else if ("days_previous".equals(command) || "days_next".equals(command)) {
            selection = ScheduleWidgetState.moveDayPage(selection, "days_previous".equals(command) ? -1 : 1, intent.getIntExtra("days", 1), now);
        } else if ("lessons_previous".equals(command) || "lessons_next".equals(command)) {
            ScheduleWidgetData.Day day = readData(context).day(date);
            int capacity = Math.max(1, Math.min(12, intent.getIntExtra("lessons", 1)));
            offset = ScheduleWidgetState.moveLessonPage(offset, "lessons_previous".equals(command) ? -1 : 1, day == null ? 0 : day.lessons.size(), capacity);
        } else return;
        String nextDate = ScheduleWidgetState.selectedDate(selection, now);
        if (!nextDate.equals(date)) offset = 0;
        preferences.edit().putString(id + ".selection", selection).putInt(id + ".lesson", offset).putString(id + ".displayed", nextDate).apply();
    }
}
