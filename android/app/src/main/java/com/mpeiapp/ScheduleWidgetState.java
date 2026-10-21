package com.mpeiapp;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/** Calendar and pagination policy, independent of Android and testable on a JDK. */
public final class ScheduleWidgetState {
    private ScheduleWidgetState() {}

    static Calendar calendar(long now) {
        Calendar value = new GregorianCalendar(TimeZone.getTimeZone("Europe/Moscow"), Locale.ROOT);
        value.setTimeInMillis(now);
        return value;
    }

    public static String format(long instant, String pattern) {
        SimpleDateFormat formatter = new SimpleDateFormat(pattern, Locale.forLanguageTag("ru-RU"));
        formatter.setTimeZone(TimeZone.getTimeZone("Europe/Moscow"));
        return formatter.format(instant);
    }

    public static List<String> dates(long now) {
        Calendar monday = calendar(now);
        monday.set(Calendar.HOUR_OF_DAY, 0);
        monday.set(Calendar.MINUTE, 0);
        monday.set(Calendar.SECOND, 0);
        monday.set(Calendar.MILLISECOND, 0);
        monday.add(Calendar.DAY_OF_MONTH, -((monday.get(Calendar.DAY_OF_WEEK) + 5) % 7));
        List<String> result = new ArrayList<>();
        for (int index = 0; index < 14; index++) {
            result.add(format(monday.getTimeInMillis(), "dd.MM.yyyy"));
            monday.add(Calendar.DAY_OF_MONTH, 1);
        }
        return result;
    }

    public static String normalize(String selection, long now) {
        if ("today".equals(selection)) return "today";
        if ("yesterday".equals(selection) || "tomorrow".equals(selection)) {
            Calendar date = calendar(now);
            date.add(Calendar.DAY_OF_MONTH, "yesterday".equals(selection) ? -1 : 1);
            selection = format(date.getTimeInMillis(), "dd.MM.yyyy");
        }
        return dates(now).contains(selection) ? selection : "today";
    }

    public static String selectedDate(String selection, long now) {
        String key = normalize(selection, now);
        return "today".equals(key) ? format(now, "dd.MM.yyyy") : key;
    }

    public static String select(String date, long now) {
        return format(now, "dd.MM.yyyy").equals(date) ? "today" : normalize(date, now);
    }

    public static String moveWeek(String selection, int direction, long now) {
        List<String> dates = dates(now);
        int index = dates.indexOf(selectedDate(selection, now));
        int target = index + (direction < 0 ? -7 : 7);
        return target >= 0 && target < 14 ? select(dates.get(target), now) : normalize(selection, now);
    }

    public static int dayPageStart(int weekday, int capacity) {
        int size = Math.max(1, Math.min(7, capacity));
        return Math.max(0, Math.min(6, weekday)) / size * size;
    }

    public static String moveDayPage(String selection, int direction, int capacity, long now) {
        List<String> dates = dates(now);
        int index = dates.indexOf(selectedDate(selection, now));
        int size = Math.max(1, Math.min(7, capacity));
        int weekday = index % 7;
        int nextStart = dayPageStart(weekday, size) + (direction < 0 ? -size : size);
        if (nextStart < 0 || nextStart > 6) return normalize(selection, now);
        return select(dates.get(index / 7 * 7 + Math.min(6, nextStart + weekday % size)), now);
    }

    public static int lessonPageStart(int offset, int total, int capacity) {
        if (total <= 0 || capacity <= 0) return 0;
        int lastStart = (total - 1) / capacity * capacity;
        return Math.min(lastStart, Math.max(0, offset) / capacity * capacity);
    }

    public static int moveLessonPage(int offset, int direction, int total, int capacity) {
        int current = lessonPageStart(offset, total, capacity);
        return lessonPageStart(current + (direction < 0 ? -capacity : capacity), total, capacity);
    }

    public static final class Layout {
        public final boolean compact;
        public final int daysPerPage, lessonsPerPage, topHeight, daysHeight, headingHeight, noticeHeight, rowHeight, pagerHeight;

        public Layout(float width, float height, float fontScale, int lessonCount) {
            float scale = Float.isNaN(fontScale) || fontScale < 1 ? 1 : fontScale;
            compact = height < 260 * scale;
            topHeight = (int) Math.ceil(28 * scale);
            daysHeight = (int) Math.ceil((compact ? 36 : 54) * scale + 4);
            int heading = (int) Math.ceil(18 * scale);
            int notice = (int) Math.ceil((compact ? 12 : 24) * scale);
            if (12 + topHeight + daysHeight + heading + notice > height - 20 * scale) notice = 0;
            if (12 + topHeight + daysHeight + heading + notice > height - 20 * scale) heading = 0;
            headingHeight = heading;
            noticeHeight = notice;
            rowHeight = (int) Math.ceil((compact ? 40 : 64) * scale);
            int available = Math.max(0, (int) height - 12 - topHeight - daysHeight - heading - notice);
            int allCapacity = Math.min(12, available / rowHeight);
            boolean needsPager = lessonCount > allCapacity;
            int pager = needsPager ? (int) Math.ceil(28 * scale) : 0;
            lessonsPerPage = Math.max(0, Math.min(12, (available - pager) / rowHeight));
            pagerHeight = needsPager && lessonsPerPage > 0 ? pager : 0;
            float usable = Math.max(0, width - 12);
            int minimumDayWidth = (int) Math.ceil(38 * scale);
            daysPerPage = usable >= minimumDayWidth * 7 ? 7 : Math.max(1, Math.min(7, (int) (usable - 48) / minimumDayWidth));
        }
    }
}
