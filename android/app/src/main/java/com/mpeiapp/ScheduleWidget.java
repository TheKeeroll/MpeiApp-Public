package com.mpeiapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.util.Log;
import android.widget.RemoteViews;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import org.joda.time.DateTime;
import java.util.Locale;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

public class ScheduleWidget extends AppWidgetProvider {

    private static final String ACTION_YESTERDAY = "com.mpeiapp.ScheduleWidget.ACTION_YESTERDAY";
    private static final String ACTION_TODAY = "com.mpeiapp.ScheduleWidget.ACTION_TODAY";
    private static final String ACTION_TOMORROW = "com.mpeiapp.ScheduleWidget.ACTION_TOMORROW";
    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId, String day) {
        RemoteViews views = null;
        try {
            views = new RemoteViews(context.getPackageName(), R.layout.schedule_widget);
        } catch (Exception e) {
            Log.e("ScheduleWidget", "RemoteViews failed: ", e);
        }
        String scheduleDataString = " ";
        try {
            SharedPreferences sharedPref = context.getSharedPreferences("DATA", Context.MODE_PRIVATE);
            scheduleDataString = sharedPref.getString("appData", "{\"schedule\":'no data'}");
            Log.i("ScheduleWidget", "Schedule Data: " + scheduleDataString);
        }catch (Exception e) {
            Log.e("ScheduleWidget", "Obtaining schedule Data failed: ", e);
        }
        String formattedToday = getDateText("today");
        String formattedYesterday = getDateText("yesterday");
        String formattedTomorrow = getDateText("tomorrow");
        String shortCurrentDate = " ";
        String shortYesterdayDate = " ";
        String shortTomorrowDate = " ";
        try {
            shortCurrentDate = shortenDateString(formattedToday);
            shortYesterdayDate = shortenDateString(formattedYesterday);
            shortTomorrowDate = shortenDateString(formattedTomorrow);
        } catch (Exception e) {
            Log.e("ScheduleWidget", "Obtaining shorten strings failed: ", e);
        }

        try {
            assert views != null;
            views.setTextViewText(R.id.btnYesterday, shortYesterdayDate);
            views.setTextViewText(R.id.btnTomorrow, shortTomorrowDate);
            views.setTextViewText(R.id.btnToday, shortCurrentDate);

            if (Objects.equals(day, "today")){
                views.setTextColor(R.id.btnToday, Color.parseColor("#6600CC"));
                views.setTextColor(R.id.btnYesterday, Color.parseColor("#DDDDE0"));
                views.setTextColor(R.id.btnTomorrow, Color.parseColor("#DDDDE0"));
            } else if (Objects.equals(day, "yesterday")){
                views.setTextColor(R.id.btnToday, Color.parseColor("#DDDDE0"));
                views.setTextColor(R.id.btnYesterday, Color.parseColor("#00FF00"));
                views.setTextColor(R.id.btnTomorrow, Color.parseColor("#DDDDE0"));
            } else if (Objects.equals(day, "tomorrow")){
                views.setTextColor(R.id.btnToday, Color.parseColor("#DDDDE0"));
                views.setTextColor(R.id.btnYesterday, Color.parseColor("#DDDDE0"));
                views.setTextColor(R.id.btnTomorrow, Color.parseColor("#00FF00"));
            }

            // Clear the existing schedule
            views.removeAllViews(R.id.schedule_container);

        } catch (Exception e) {
            Log.e("ScheduleWidget","Setting texts&colors failed: " + e);
        }
        String lesson_num;
        List<WidgetSchItem> widgetSchItems = Collections.emptyList();
        try {
            // Load schedule data for the selected day
            widgetSchItems = getScheduleForDay(day, scheduleDataString); // Implement this method to return a list of schedule items for the day
            // Update date text based on the selected day
            lesson_num = widgetSchItems.size() + " пары";
            if (widgetSchItems.isEmpty()){
                lesson_num = "пар нет!";
            } else if (widgetSchItems.size() == 1){
                lesson_num = "1 пара";
            } else if (widgetSchItems.size() >= 5){
                lesson_num = widgetSchItems.size() + " пар";
            }
        } catch (Exception e) {
            Log.e("ScheduleWidget", "getScheduleForDay failed: ", e);
            lesson_num = "пар нет!";
        }
        String dateText = getDateText(day);
        try {
            views.setTextViewText(R.id.date_text, dateText + " - " + lesson_num);

            // Clear previous schedule items
            views.removeAllViews(R.id.schedule_container);
            for (WidgetSchItem item : widgetSchItems) {
                RemoteViews itemView = new RemoteViews(context.getPackageName(), R.layout.schedule_item);

                itemView.setTextViewText(R.id.schedule_time, item.getTime());
                itemView.setTextViewText(R.id.schedule_cabinet, item.getCabinet());
                itemView.setTextViewText(R.id.schedule_lesson_type, item.getLessonType());
                itemView.setTextViewText(R.id.schedule_discipline, item.getDiscipline());
                itemView.setTextViewText(R.id.schedule_teacher, item.getTeacher());

                if (item.getLessonType().contains("абот") || item.getLessonType().contains("кзамен") || item.getLessonType().contains("ащита")) {
                    itemView.setTextColor(R.id.schedule_lesson_type, Color.parseColor("#FF0500"));
                } else if (item.getLessonType().contains("екция")){
                    itemView.setTextColor(R.id.schedule_lesson_type, Color.parseColor("#00FF00"));
                }

                views.addView(R.id.schedule_container, itemView);
            }
        } catch (Exception e) {
            Log.e("ScheduleWidget","Filing schedule_container failed: " + e);
        }

        try {
            // Set up intents for buttons
            Intent intentYesterday = new Intent(context, ScheduleWidget.class);
            intentYesterday.setAction(ACTION_YESTERDAY);
            PendingIntent pendingIntentYesterday = PendingIntent.getBroadcast(context, 0, intentYesterday, (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            views.setOnClickPendingIntent(R.id.btnYesterday, pendingIntentYesterday);

            Intent intentTomorrow = new Intent(context, ScheduleWidget.class);
            intentTomorrow.setAction(ACTION_TOMORROW);
            PendingIntent pendingIntentTomorrow = PendingIntent.getBroadcast(context, 0, intentTomorrow, (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            views.setOnClickPendingIntent(R.id.btnTomorrow, pendingIntentTomorrow);

            Intent intentToday = new Intent(context, ScheduleWidget.class);
            intentToday.setAction(ACTION_TODAY);
            PendingIntent pendingIntentToday = PendingIntent.getBroadcast(context, 0, intentToday, (PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            views.setOnClickPendingIntent(R.id.btnToday, pendingIntentToday);
        } catch (Exception e) {
            Log.e("ScheduleWidget","Setting up intents for buttons failed: " + e);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    // Основной класс, соответствующий корневому объекту JSON
    class Root {
        @SerializedName("dataForWidget")
        private DataForWidget dataForWidget;

        public DataForWidget getDataForWidget() {
            return dataForWidget;
        }
    }

    // Класс, представляющий dataForWidget
    class DataForWidget {
        private Day yesterday;
        private Day today;
        private Day tomorrow;

        public Day getYesterday() {
            return yesterday;
        }

        public Day getToday() {
            return today;
        }

        public Day getTomorrow() {
            return tomorrow;
        }
    }

    // Класс, представляющий каждый день
    class Day {
        private String date;
        private List<Lesson> lessons;
        private boolean isEmpty;
        private boolean isToday;

        public String getDate() {
            return date;
        }

        public List<Lesson> getLessons() {
            return lessons;
        }

        public boolean isEmpty() {
            return isEmpty;
        }

        public boolean isToday() {
            return isToday;
        }
    }

    class Lesson {
        private String name;
        private String lessonIndex;
        private String lessonType;
        private String place;
        private String cabinet;
        private Teacher teacher;
        private String group;
        private String type;

        public String GetName(){
            return name;
        }
        public String GetLessonIndex(){
            return lessonIndex;
        }
        public String GetLessonType(){
            return lessonType;
        }
        public String GetPlace(){
            return place;
        }
        public String GetCabinet(){
            return cabinet;
        }
        public Teacher GetTeacher(){
            return teacher;
        }
        public String GetGroup(){
            return group;
        }
        public String GetType(){
            return type;
        }
    }

    class Teacher {
        private String name;
        private String lec_oid;
        private String fullName;

        public String GetName(){
            return name;
        }
        public String GetLecOID() { return lec_oid; }
        public String GetFullName(){
            return fullName;
        }
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

    private static String formatDate(DateTime dateTime) {
        String dayOfWeek = dateTime.toString("EEEEE", Locale.forLanguageTag("ru"));
        String dayMonth = dateTime.toString("dd MMMM", Locale.forLanguageTag("ru"));
        return dayOfWeek + ", " + dayMonth;
    }

    private static String shortenDateString(String dateString) {
        // Разделение строки на день недели и дату
        String[] parts = dateString.split(", ");
        String dayOfWeek = parts[0];
        String dayMonth = parts[1];

        // Сокращение дня недели
        String shortDayOfWeek = shortenDayOfWeek(dayOfWeek);

        // Сокращение месяца
        String shortDayMonth = shortenDayMonth(dayMonth);

        return shortDayOfWeek + " " + shortDayMonth;
    }

    private static String shortenDayOfWeek(String dayOfWeek) {
        switch (dayOfWeek) {
            case "понедельник": return "Пн";
            case "вторник": return "Вт";
            case "среда": return "Ср";
            case "четверг": return "Чт";
            case "пятница": return "Пт";
            case "суббота": return "Сб";
            case "воскресенье": return "Вс";
            default: return "";
        }
    }

    private static String shortenDayMonth(String dayMonth) {
        String[] parts = dayMonth.split(" ");
        String day = parts[0];
        String month = parts[1];

        String shortMonth;
        switch (month) {
            case "января":
                shortMonth = "Янв";
                break;
            case "февраля":
                shortMonth = "Фев";
                break;
            case "марта":
                shortMonth = "Мар";
                break;
            case "апреля":
                shortMonth = "Апр";
                break;
            case "мая":
                shortMonth = "Мая";
                break;
            case "июня":
                shortMonth = "Июн";
                break;
            case "июля":
                shortMonth = "Июл";
                break;
            case "августа":
                shortMonth = "Авг";
                break;
            case "сентября":
                shortMonth = "Сен";
                break;
            case "октября":
                shortMonth = "Окт";
                break;
            case "ноября":
                shortMonth = "Ноя";
                break;
            case "декабря":
                shortMonth = "Дек";
                break;
            default: shortMonth = "";
        }
        return day + " " + shortMonth;
    }

    // Helper methods to get date text and schedule data
    private static String getDateText(String day) {
        // Implement this method to return the date text based on the day
        // Получение текущей даты
        DateTime currentDate = new DateTime();
        String formattedToday = formatDate(currentDate);
        Log.i("ScheduleWidget", "formattedDate - today: " + formattedToday);
        DateTime yesterdayDate = currentDate.minusDays(1);
        String formattedYesterday = formatDate(yesterdayDate);
        Log.i("ScheduleWidget", "formattedDate - yesterday: " + formattedYesterday);
        DateTime tomorrowDate = currentDate.plusDays(1);
        String formattedTomorrow = formatDate(tomorrowDate);
        Log.i("ScheduleWidget", "formattedDate - tomorrow: " + formattedTomorrow);
        if (Objects.equals(day, "today")){
            return formattedToday;
        } else if (Objects.equals(day, "yesterday")){
            return formattedYesterday;
        } else {
            return formattedTomorrow;
        }
    }

    private static List<WidgetSchItem> getScheduleForDay(String day, String sch) {
        // Implement this method to return the schedule items for the given day

        // Создание объекта Gson
        Gson gson = new Gson();
        Root schDataObj = null;
        try {
            // Преобразование JSON строки в объект
            schDataObj = gson.fromJson(sch, Root.class);
            // Доступ к данным
            boolean todayIsToday = schDataObj.getDataForWidget().getToday().isToday();
            Log.i("ScheduleWidget", "schDataObj - today is today? " + todayIsToday);
        } catch (Exception e) {
            Log.e("ScheduleWidget","Root.class fromJson failed: " + e);
        }

        WidgetSchItem sch_item = new WidgetSchItem("00:00 - 01:00", "Тест Лаборат работа", "Тест-100","Информационные что-то там и радиолокационные ещё что-то там такое", "доц. Тестовый Т. Т.");
        WidgetSchItem sch_item1 = new WidgetSchItem("01:00 - 02:00", "Test Лекция", "Test cabin1","Test dis1", "Test tea1");
        WidgetSchItem sch_item2 = new WidgetSchItem("01:00 - 02:00", "Test занятие", "Test cabin1","Test dis1", "Test tea1");
        // WidgetSchItem sch_item2 = new WidgetSchItem("00:00 - 00:00", schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).GetLessonType(), schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).GetCabinet(),schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).GetName(), schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).GetTeacher().GetName(), schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).GetType());
        List<WidgetSchItem> schlist = Collections.emptyList();
        List<WidgetSchItem> res = new ArrayList<>(schlist);
        try {
            if (Objects.equals(day, "today")){
                res.add(sch_item);
                res.add(sch_item);
                res.add(sch_item1);
                res.add(sch_item1);
                res.add(sch_item2);
                res.add(sch_item2);
            } else if (Objects.equals(day, "yesterday")){
                assert schDataObj != null;
                if (!schDataObj.getDataForWidget().getYesterday().isEmpty()){
                    for (Lesson sch_les : schDataObj.getDataForWidget().getYesterday().getLessons()) {
                        if (!Objects.equals(sch_les.GetType(), "DINNER")) {
                            res.add(new WidgetSchItem(sch_les.GetLessonIndex(), sch_les.GetLessonType(), sch_les.GetCabinet(), sch_les.GetName(), sch_les.GetTeacher().GetName()));
                        }
                    }
                }
            } else if (Objects.equals(day, "tomorrow")){
                assert schDataObj != null;
                if (!schDataObj.getDataForWidget().getTomorrow().isEmpty()){
                    for (Lesson sch_les : schDataObj.getDataForWidget().getTomorrow().getLessons()) {
                        if (!Objects.equals(sch_les.GetType(), "DINNER")) {
                            res.add(new WidgetSchItem(sch_les.GetLessonIndex(), sch_les.GetLessonType(), sch_les.GetCabinet(), sch_les.GetName(), sch_les.GetTeacher().GetName()));
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e("ScheduleWidget","Filling res with items failed: " + e);
        }
        return res;
    }

    public static class WidgetSchItem {
        private String time;
        private String lessonType;
        private String cabinet;
        private String discipline;
        private String teacher;

        public WidgetSchItem(String time, String lessonType, String cabinet, String discipline, String teacher) {
            this.time = time;
            this.lessonType = lessonType;
            this.cabinet = cabinet;
            this.discipline = discipline;
            this.teacher = teacher;
        }

        public String getTime() {
            return time;
        }

        public String getLessonType() {
            return lessonType;
        }

        public String getCabinet() {
            return cabinet;
        }

        public String getDiscipline() {return discipline; }

        public String getTeacher() {
            return teacher;
        }
    }
}
