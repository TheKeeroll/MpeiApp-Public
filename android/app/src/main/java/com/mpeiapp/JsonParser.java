package com.mpeiapp;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class JsonParser {
    public static ScheduleWidget.Root parseJson(String jsonString) throws Exception {
        ScheduleWidget.Root root = new ScheduleWidget.Root();

        JSONObject rootJsonObject = new JSONObject(jsonString);
        JSONObject dataForWidgetJsonObject = rootJsonObject.getJSONObject("dataForWidget");

        ScheduleWidget.DataForWidget dataForWidget = new ScheduleWidget.DataForWidget();

        // Parsing each day: yesterday, today, tomorrow
        dataForWidget.setYesterday(parseDay(dataForWidgetJsonObject.getJSONObject("yesterday")));
        dataForWidget.setToday(parseDay(dataForWidgetJsonObject.getJSONObject("today")));
        dataForWidget.setTomorrow(parseDay(dataForWidgetJsonObject.getJSONObject("tomorrow")));

        root.setDataForWidget(dataForWidget);

        return root;
    }

    private static ScheduleWidget.Day parseDay(JSONObject dayJsonObject) throws Exception {
        ScheduleWidget.Day day = new ScheduleWidget.Day();

        day.setDate(dayJsonObject.getString("date"));
        day.setIsEmpty(dayJsonObject.getBoolean("isEmpty"));
        day.setIsToday(dayJsonObject.getBoolean("isToday"));

        JSONArray lessonsJsonArray = dayJsonObject.getJSONArray("lessons");
        List<ScheduleWidget.Lesson> lessons = new ArrayList<>();
        if (!day.getIsEmpty()) {
            for (int i = 0; i < lessonsJsonArray.length(); i++) {
                JSONObject lessonJsonObject = lessonsJsonArray.getJSONObject(i);
                ScheduleWidget.Lesson lesson = new ScheduleWidget.Lesson();

                lesson.setType(lessonJsonObject.getString("type"));
                if (!lesson.getType().contains("DINNER")) {
                    lesson.setName(lessonJsonObject.getString("name"));
                    lesson.setLessonIndex(lessonJsonObject.getString("lessonIndex"));
                    lesson.setLessonType(lessonJsonObject.getString("lessonType"));
                    lesson.setPlace(lessonJsonObject.getString("place"));
                    if (lessonJsonObject.getString("cabinet").contains("Спортзал")) {
                        lesson.setCabinet("Стадион");
                    } else {
                        lesson.setCabinet(lessonJsonObject.getString("cabinet"));
                    }
                    lesson.setGroup(lessonJsonObject.getString("group"));

                    // Parsing teacher object
                    JSONObject teacherJsonObject = lessonJsonObject.getJSONObject("teacher");
                    ScheduleWidget.Teacher teacher = new ScheduleWidget.Teacher();
                    if (teacherJsonObject.getString("name").equals("-")){
                        teacher.setName("");
                    } else {
                        teacher.setName(teacherJsonObject.getString("name"));
                    }
                    try {
                        teacher.setLec_oid(teacherJsonObject.getString("lec_oid"));
                        teacher.setFullName(teacherJsonObject.getString("fullName"));
                    } catch (Exception e) {
                        teacher.setLec_oid("-");
                        teacher.setFullName("-");
                    }
                    lesson.setTeacher(teacher);
                }
                lessons.add(lesson);
            }
        }

        day.setLessons(lessons);

        return day;
    }
}
