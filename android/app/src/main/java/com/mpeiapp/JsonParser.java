package com.mpeiapp;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class JsonParser {
    private JsonParser() {}

    static ScheduleWidgetData parseJson(String raw) throws JSONException {
        JSONObject root = new JSONObject(raw);
        ScheduleWidgetData data = new ScheduleWidgetData();
        if (root.has("days")) {
            JSONArray days = root.optJSONArray("days");
            if (root.optInt("schemaVersion", 1) != 1 || days == null) throw new JSONException("Unsupported widget payload");
            for (int index = 0; index < days.length(); index++) readDay(days.optJSONObject(index), data);
        } else {
            // Keep the cache written by 2.5.0 until the app publishes two weeks.
            JSONObject legacy = root.optJSONObject("dataForWidget");
            if (legacy == null) throw new JSONException("No widget schedule");
            for (String key : new String[]{"yesterday", "today", "tomorrow"}) readDay(legacy.optJSONObject(key), data);
        }
        return data;
    }

    private static String text(JSONObject object, String key) {
        Object value = object == null ? null : object.opt(key);
        return value instanceof String ? (String) value : "";
    }

    private static void readDay(JSONObject object, ScheduleWidgetData data) {
        if (object == null) return;
        String date = text(object, "date");
        if (!date.matches("\\d{2}\\.\\d{2}\\.\\d{4}")) return;
        JSONArray lessons = object.optJSONArray("lessons");
        ScheduleWidgetData.Day day = new ScheduleWidgetData.Day(date, object.optBoolean("isLoaded", lessons != null));
        if (lessons != null && day.loaded) {
            for (int index = 0; index < lessons.length(); index++) {
                JSONObject lesson = lessons.optJSONObject(index);
                if (lesson == null) continue;
                String type = text(lesson, "type");
                if ("DINNER".equals(type) || "PLACEHOLDER".equals(type)) continue;
                day.lessons.add(new ScheduleWidgetData.Lesson(text(lesson, "name"), text(lesson, "lessonIndex"),
                        text(lesson, "lessonType"), text(lesson, "cabinet"), text(lesson.optJSONObject("teacher"), "name")));
            }
        }
        data.days.put(date, day);
    }
}
