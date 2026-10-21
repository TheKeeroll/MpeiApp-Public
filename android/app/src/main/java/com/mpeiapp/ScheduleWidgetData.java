package com.mpeiapp;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class ScheduleWidgetData {
    final Map<String, Day> days = new LinkedHashMap<>();

    Day day(String date) {
        Day day = days.get(date);
        return day != null && day.loaded ? day : null;
    }

    static final class Day {
        final String date;
        final boolean loaded;
        final List<Lesson> lessons = new ArrayList<>();

        Day(String date, boolean loaded) { this.date = date; this.loaded = loaded; }

        int lessonCount() {
            Set<String> times = new HashSet<>();
            for (int index = 0; index < lessons.size(); index++) {
                String time = lessons.get(index).time;
                times.add(time.isEmpty() ? "row:" + index : "time:" + time);
            }
            return times.size();
        }
    }

    static final class Lesson {
        final String name, time, type, cabinet, teacher;
        Lesson(String name, String time, String type, String cabinet, String teacher) {
            this.name = name.isEmpty() ? "Занятие" : name;
            this.time = time;
            this.type = type;
            this.cabinet = "Спортзал".equals(cabinet) ? "Стадион" : cabinet;
            this.teacher = "-".equals(teacher) ? "" : teacher;
        }
    }
}
