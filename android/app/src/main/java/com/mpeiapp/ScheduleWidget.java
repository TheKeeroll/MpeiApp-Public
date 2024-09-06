package com.mpeiapp;

import static com.mpeiapp.JsonParser.parseJson;

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
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import java.util.Locale;

public class ScheduleWidget extends AppWidgetProvider {

    private static final String ACTION_YESTERDAY = "com.mpeiapp.ScheduleWidget.ACTION_YESTERDAY";
    private static final String ACTION_TODAY = "com.mpeiapp.ScheduleWidget.ACTION_TODAY";
    private static final String ACTION_TOMORROW = "com.mpeiapp.ScheduleWidget.ACTION_TOMORROW";
    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId, String day) {
        RemoteViews views = null;
        try {
            views = new RemoteViews(context.getPackageName(), R.layout.schedule_widget);
            views.setTextViewText(R.id.date_text, "Необходимо прогрузить всё в приложении!");
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

        Root schDataObj = getSchDataObj(scheduleDataString);

        String formattedToday;
        String formattedYesterday;
        String formattedTomorrow;
        String shortCurrentDate = " ";
        String shortYesterdayDate = " ";
        String shortTomorrowDate = " ";
        try {
            formattedToday = formatDate(schDataObj.getDataForWidget().getToday().getDate());
            formattedYesterday = formatDate(schDataObj.getDataForWidget().getYesterday().getDate());
            formattedTomorrow = formatDate(schDataObj.getDataForWidget().getTomorrow().getDate());
            shortCurrentDate = shortenDateString(formattedToday);
            shortYesterdayDate = shortenDateString(formattedYesterday);
            shortTomorrowDate = shortenDateString(formattedTomorrow);
        } catch (Exception e) {
            Log.e("ScheduleWidget", "Obtaining shorten strings failed: ", e);
            shortCurrentDate = "Нет данных";
            shortYesterdayDate = "Нет данных";
            shortTomorrowDate = "Нет данных";
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
            int chosen_dis_num = 0;
            for (WidgetSchItem sch_item : widgetSchItems) {
                if (sch_item.getDiscipline().contains("по выбору")){
                    chosen_dis_num++;
                }
            }
            int extra_chosen_num = chosen_dis_num - 1;
            if (extra_chosen_num < 0) {
                extra_chosen_num = 0;
            }
            // Update date text based on the selected day
            lesson_num = (widgetSchItems.size() - extra_chosen_num) + " пары";
            if (widgetSchItems.isEmpty()){
                lesson_num = "пар нет!";
            } else if ((widgetSchItems.size() - extra_chosen_num) == 1){
                lesson_num = "1 пара";
            } else if ((widgetSchItems.size() - extra_chosen_num) >= 5){
                lesson_num = (widgetSchItems.size() - extra_chosen_num) + " пар";
            }
        } catch (Exception e) {
            Log.e("ScheduleWidget", "getScheduleForDay failed: ", e);
            lesson_num = "пар нет!";
        }
        String dateText;
        try {
            switch (day) {
                case "yesterday": dateText = formatDate(schDataObj.getDataForWidget().getYesterday().getDate());
                    break;

                case "tomorrow": dateText = formatDate(schDataObj.getDataForWidget().getTomorrow().getDate());
                    break;

                default: dateText = formatDate(schDataObj.getDataForWidget().getToday().getDate());
            }

            views.setTextViewText(R.id.date_text, dateText + " - " + lesson_num);

            // Clear previous schedule items
            views.removeAllViews(R.id.schedule_container);
            for (WidgetSchItem item : widgetSchItems) {
                RemoteViews itemView = new RemoteViews(context.getPackageName(), R.layout.schedule_item);

                itemView.setTextViewText(R.id.schedule_time, item.getTime());
                itemView.setTextViewText(R.id.schedule_cabinet, item.getCabinet());
                itemView.setTextViewText(R.id.schedule_lesson_type, item.getLessonType());
                itemView.setTextViewText(R.id.schedule_discipline, item.getDiscipline());
                if (item.getTeacher().isEmpty()){
                    itemView.setViewVisibility(R.id.schedule_teacher, TextView.GONE);
                } else {
                    itemView.setTextViewText(R.id.schedule_teacher, item.getTeacher());
                }
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
    static class Root {
        private DataForWidget dataForWidget;

        public Root() {}

        public DataForWidget getDataForWidget() {
            return dataForWidget;
        }

        public void setDataForWidget(DataForWidget dataForWidget) {
            this.dataForWidget = dataForWidget;
        }
    }

    // Класс, представляющий dataForWidget
    static class DataForWidget {
        private Day yesterday;
        private Day today;
        private Day tomorrow;

        public DataForWidget() {}

        public Day getYesterday() {
            return yesterday;
        }

        public void setYesterday(Day yesterday) {
            this.yesterday = yesterday;
        }

        public Day getToday() {
            return today;
        }

        public void setToday(Day today) {
            this.today = today;
        }

        public Day getTomorrow() {
            return tomorrow;
        }

        public void setTomorrow(Day tomorrow) {
            this.tomorrow = tomorrow;
        }
    }

    // Класс, представляющий каждый день
    static class Day {
        private String date;
        private List<Lesson> lessons;
        private boolean isEmpty;
        private boolean isToday;

        public Day() {}

        public String getDate() {
            return date;
        }

        public void setDate(String date) {
            this.date = date;
        }

        public List<Lesson> getLessons() {
            return lessons;
        }

        public void setLessons(List<Lesson> lessons) {
            this.lessons = lessons;
        }

        public boolean getIsEmpty() {
            return isEmpty;
        }

        public void setIsEmpty(boolean empty) {
            isEmpty = empty;
        }

        public boolean getIsToday() {
            return isToday;
        }

        public void setIsToday(boolean today) {
            isToday = today;
        }
    }

    static class Lesson {
        private String name;
        private String lessonIndex;
        private String lessonType;
        private String place;
        private String cabinet;
        private Teacher teacher;
        private String group;
        private String type;

        public Lesson() {}

        public String getName(){
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getLessonIndex(){
            return lessonIndex;
        }

        public void setLessonIndex(String lessonIndex) {
            this.lessonIndex = lessonIndex;
        }

        public String getLessonType(){
            return lessonType;
        }

        public void setLessonType(String lessonType) {
            this.lessonType = lessonType;
        }

        public String getPlace(){
            return place;
        }

        public void setPlace(String place) {
            this.place = place;
        }

        public String getCabinet(){
            return cabinet;
        }

        public void setCabinet(String cabinet) {
            this.cabinet = cabinet;
        }

        public Teacher getTeacher(){
            return teacher;
        }

        public void setTeacher(Teacher teacher) {
            this.teacher = teacher;
        }

        public String getGroup(){
            return group;
        }

        public void setGroup(String group) {
            this.group = group;
        }

        public String getType(){
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }
    }

    static class Teacher {
        private String name;
        private String lec_oid;
        private String fullName;

        public Teacher() {}

        public String getName(){
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getLecOID() { return lec_oid; }

        public void setLec_oid(String lec_oid) {
            this.lec_oid = lec_oid;
        }

        public String getFullName(){
            return fullName;
        }

        public void setFullName(String fullName) {
            this.fullName = fullName;
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        // There may be multiple widgets active, so update all of them
        for (int appWidgetId : appWidgetIds) {
            // Default to today
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
                updateAppWidget(context, appWidgetManager, appWidgetId, "yesterday");
            }
        } else if (Objects.equals(intent.getAction(), ACTION_TODAY)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisAppWidget = new ComponentName(context.getPackageName(), ScheduleWidget.class.getName());
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget);

            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId, "today");
            }
        } else if (Objects.equals(intent.getAction(), ACTION_TOMORROW)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisAppWidget = new ComponentName(context.getPackageName(), ScheduleWidget.class.getName());
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget);

            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId, "tomorrow");
            }
        }
    }
    private static String formatDate(String dateString) {
        if (dateString.contains("NOT_SET")) {
            return "Нет расписания";
        }
        // Преобразуем строку в Calendar
        SimpleDateFormat sdf = new SimpleDateFormat("dd.MM.yyyy", Locale.forLanguageTag("ru"));
        Calendar calendar = Calendar.getInstance();
        try {
            calendar.setTime(sdf.parse(dateString));
        } catch (Exception e) {
            Log.e("ScheduleWidget","formatDate failed: " + e);
            return "Нет данных";
        }

        // Получаем день недели и дату
        SimpleDateFormat dayOfWeekFormatter = new SimpleDateFormat("EEEE", Locale.forLanguageTag("ru"));
        String dayOfWeek = dayOfWeekFormatter.format(calendar.getTime());

        SimpleDateFormat dayMonthFormatter = new SimpleDateFormat("dd MMMM", Locale.forLanguageTag("ru"));
        String dayMonth = dayMonthFormatter.format(calendar.getTime());

        return dayOfWeek + ", " + dayMonth;
    }

    private static String shortenDateString(String dateString) {
        if (dateString.contains("Нет")) {
            return dateString;
        }
        // Разделение строки на день недели и дату
        String[] parts;
        String dayOfWeek;
        String dayMonth;
        String shortDayOfWeek;
        String shortDayMonth;
        try {
            // Разделение строки на день недели и дату
            parts = dateString.split(", ");
            dayOfWeek = parts[0];
            dayMonth = parts[1];
            // Сокращение дня недели
            shortDayOfWeek = shortenDayOfWeek(dayOfWeek);
            // Сокращение месяца
            shortDayMonth = shortenDayMonth(dayMonth);
        } catch (Exception e) {
            Log.e("ScheduleWidget","shortDayOfWeek/shortDayMonth failed: " + e);
            return "Нет данных";
        }
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

    private static Root getSchDataObj(String sch) {
        try {
            // Преобразование JSON строки в объект
            Root schDataObj = parseJson(sch);
            // Доступ к данным
            boolean todayIsToday = schDataObj.getDataForWidget().getToday().getIsToday();
            Log.i("ScheduleWidget", "schDataObj - today is today? " + todayIsToday);
            return schDataObj;
        } catch (Exception e) {
            Log.e("ScheduleWidget","Root.class fromJson failed: " + e);
            return null;
        }
    }


    private static List<WidgetSchItem> getScheduleForDay(String day, String sch) {
        Root schDataObj = getSchDataObj(sch);
        // WidgetSchItem sch_item = new WidgetSchItem("00:00 - 00:00", "Лабораторная работа", "Тест-100","Информационные что-то там и радиолокационные ещё что-то там такое длинное вообщем", "доц. Тестовый Т. Т.");
        // WidgetSchItem sch_item1 = new WidgetSchItem("00:00 - 00:00", "Лекция", "Тест-101","Тестовая дисциплина", "проф. Тестовый Т. Т.");
        // WidgetSchItem sch_item2 = new WidgetSchItem("00:00 - 00:00", "Практическое занятие", "Тест-102","Ещё-что-то", "ст. преп. Тестовая Т. Т.");
        // WidgetSchItem sch_item2 = new WidgetSchItem("00:00 - 00:00", schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).getLessonType(), schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).getCabinet(),schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).getName(), schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).getTeacher().getName(), schDataObj.getDataForWidget().getTomorrow().getLessons().get(0).getType());
        List<WidgetSchItem> schlist = Collections.emptyList();
        List<WidgetSchItem> res = new ArrayList<>(schlist);
        try {
            if (Objects.equals(day, "today")){
//                res.add(sch_item);
//                res.add(sch_item);
//                res.add(sch_item1);
//                res.add(sch_item2);
//                res.add(sch_item2);
                assert schDataObj != null;
                if (!schDataObj.getDataForWidget().getToday().getIsEmpty()){
                    for (Lesson sch_les : schDataObj.getDataForWidget().getToday().getLessons()) {
                        if (!Objects.equals(sch_les.getType(), "DINNER")) {
                            res.add(new WidgetSchItem(sch_les.getLessonIndex(), sch_les.getLessonType(), sch_les.getCabinet(), sch_les.getName(), sch_les.getTeacher().getName()));
                        }
                    }
                }
            } else if (Objects.equals(day, "yesterday")){
                assert schDataObj != null;
                if (!schDataObj.getDataForWidget().getYesterday().getIsEmpty()){
                    for (Lesson sch_les : schDataObj.getDataForWidget().getYesterday().getLessons()) {
                        if (!Objects.equals(sch_les.getType(), "DINNER")) {
                            res.add(new WidgetSchItem(sch_les.getLessonIndex(), sch_les.getLessonType(), sch_les.getCabinet(), sch_les.getName(), sch_les.getTeacher().getName()));
                        }
                    }
                }
            } else if (Objects.equals(day, "tomorrow")){
                assert schDataObj != null;
                if (!schDataObj.getDataForWidget().getTomorrow().getIsEmpty()){
                    for (Lesson sch_les : schDataObj.getDataForWidget().getTomorrow().getLessons()) {
                        if (!Objects.equals(sch_les.getType(), "DINNER")) {
                            res.add(new WidgetSchItem(sch_les.getLessonIndex(), sch_les.getLessonType(), sch_les.getCabinet(), sch_les.getName(), sch_les.getTeacher().getName()));
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
