package com.mpeiapp;

import java.util.HashSet;
import java.util.List;
import java.util.TimeZone;

/** Runs with a plain JDK, without Gradle, the Android SDK or an emulator. */
public final class ScheduleWidgetCoreTest {
    private static int checks;
    private static void check(boolean value, String message) {
        checks++;
        if (!value) throw new AssertionError(message);
    }
    private static long instant(String utc) { return java.time.Instant.parse(utc).toEpochMilli(); }

    public static void main(String[] args) {
        long tuesday = instant("2026-10-20T09:00:00Z");
        List<String> dates = ScheduleWidgetState.dates(tuesday);
        check(dates.size() == 14 && new HashSet<>(dates).size() == 14, "Exactly 14 distinct days");
        check(dates.get(0).equals("19.10.2026") && dates.get(13).equals("01.11.2026"), "Two complete Monday-Sunday weeks");
        check(ScheduleWidgetState.dates(instant("2026-10-25T20:59:59Z")).get(0).equals("19.10.2026"), "Sunday still belongs to current week");
        check(ScheduleWidgetState.dates(instant("2026-10-25T21:00:00Z")).get(0).equals("26.10.2026"), "Monday starts at Moscow midnight");
        check(ScheduleWidgetState.dates(instant("2027-01-01T12:00:00Z")).get(0).equals("28.12.2026"), "Year boundary");
        check(ScheduleWidgetState.dates(instant("2028-02-29T12:00:00Z")).get(13).equals("12.03.2028"), "Leap-day boundary");
        TimeZone previous = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Honolulu"));
            check(ScheduleWidgetState.dates(tuesday).equals(dates), "Device timezone cannot change schedule dates");
        } finally { TimeZone.setDefault(previous); }

        check(ScheduleWidgetState.normalize(null, tuesday).equals("today"), "Missing choice defaults to today");
        check(ScheduleWidgetState.normalize("31.02.2026", tuesday).equals("today"), "Invalid date is not selectable");
        check(ScheduleWidgetState.normalize("tomorrow", tuesday).equals("21.10.2026"), "Legacy choice migration");
        check(ScheduleWidgetState.normalize("yesterday", instant("2026-10-19T12:00:00Z")).equals("today"), "Migration cannot leave the two weeks");
        check(ScheduleWidgetState.normalize("01.11.2026", instant("2026-10-26T12:00:00Z")).equals("01.11.2026"), "Keep valid selection on next Monday");
        check(ScheduleWidgetState.normalize("01.11.2026", instant("2026-11-02T12:00:00Z")).equals("today"), "Expired choice resets");
        check(ScheduleWidgetState.selectedDate("today", instant("2026-10-20T21:00:00Z")).equals("21.10.2026"), "Today tracks midnight");
        check(ScheduleWidgetState.selectedDate("20.10.2026", instant("2026-10-20T21:00:00Z")).equals("20.10.2026"), "Explicit date stays fixed");
        check(ScheduleWidgetState.moveWeek("today", 1, tuesday).equals("27.10.2026"), "Week button keeps the weekday");
        check(ScheduleWidgetState.moveWeek("27.10.2026", -1, tuesday).equals("today"), "Back to current day");
        check(ScheduleWidgetState.moveWeek("today", -1, tuesday).equals("today"), "No third week before current");
        check(ScheduleWidgetState.moveWeek("27.10.2026", 1, tuesday).equals("27.10.2026"), "No third week after next");

        for (int size = 1; size <= 7; size++) {
            String selection = "19.10.2026";
            int previousIndex = -1;
            for (int guard = 0; guard < 7; guard++) {
                int selected = dates.indexOf(ScheduleWidgetState.selectedDate(selection, tuesday));
                int start = ScheduleWidgetState.dayPageStart(selected, size);
                check(selected >= start && selected < start + size, "Selected date stays visible");
                check(selected >= previousIndex && selected < 7, "Day paging never crosses the week");
                previousIndex = selected;
                selection = ScheduleWidgetState.moveDayPage(selection, 1, size, tuesday);
            }
            int start = ScheduleWidgetState.dayPageStart(dates.indexOf(ScheduleWidgetState.selectedDate(selection, tuesday)), size);
            check(start + size >= 7, "Every day page is reachable");
            for (int guard = 0; guard < 7; guard++) selection = ScheduleWidgetState.moveDayPage(selection, -1, size, tuesday);
            check(ScheduleWidgetState.dayPageStart(dates.indexOf(ScheduleWidgetState.selectedDate(selection, tuesday)), size) == 0, "Can return to first day page");
        }

        check(new ScheduleWidgetState.Layout(340, 420, 1, 8).daysPerPage == 7, "Wide widget shows the complete week");
        check(new ScheduleWidgetState.Layout(180, 180, 1, 8).daysPerPage == 3, "Narrow widget pages days");
        check(new ScheduleWidgetState.Layout(180, 180, 1, 8).lessonsPerPage == 1, "Minimum size still shows a lesson");
        check(new ScheduleWidgetState.Layout(340, 640, 1, 8).lessonsPerPage > 1, "Taller widget shows more lessons");
        check(ScheduleWidgetState.lessonPageStart(7, 3, 2) == 2, "Shorter refreshed schedule clamps its page");
        check(ScheduleWidgetState.lessonPageStart(7, 10, 3) == 6, "Resize retains an aligned page");
        check(ScheduleWidgetState.lessonPageStart(7, 0, 3) == 0, "Empty day has no stale page");

        for (int width : new int[]{180, 220, 280, 340, 500}) for (int height : new int[]{180, 220, 260, 340, 500}) {
            for (float scale : new float[]{1, 1.3f, 1.8f, 2}) for (int total : new int[]{0, 1, 2, 5, 13}) {
                ScheduleWidgetState.Layout layout = new ScheduleWidgetState.Layout(width, height, scale, total);
                check(layout.daysPerPage >= 1 && layout.daysPerPage <= 7, "Bounded day capacity");
                check(layout.lessonsPerPage >= 0 && layout.lessonsPerPage <= 12, "Bounded lesson capacity");
                if (layout.lessonsPerPage > 0) {
                    check(12 + layout.topHeight + layout.daysHeight + layout.headingHeight + layout.noticeHeight
                            + layout.pagerHeight + layout.lessonsPerPage * layout.rowHeight <= height, "Rows fit the allocated height");
                    HashSet<Integer> seen = new HashSet<>();
                    int offset = 0;
                    for (int guard = 0; guard <= total; guard++) {
                        int start = ScheduleWidgetState.lessonPageStart(offset, total, layout.lessonsPerPage);
                        for (int item = start; item < Math.min(total, start + layout.lessonsPerPage); item++) seen.add(item);
                        offset = ScheduleWidgetState.moveLessonPage(offset, 1, total, layout.lessonsPerPage);
                    }
                    check(seen.size() == total, "Every lesson is reachable at this size and font scale");
                    for (int guard = 0; guard <= total; guard++) offset = ScheduleWidgetState.moveLessonPage(offset, -1, total, layout.lessonsPerPage);
                    check(offset == 0, "Can page lessons back to the start");
                }
            }
        }
        ScheduleWidgetData.Day day = new ScheduleWidgetData.Day("20.10.2026", true);
        day.lessons.add(new ScheduleWidgetData.Lesson("A", "09:20", "", "", ""));
        day.lessons.add(new ScheduleWidgetData.Lesson("B", "09:20", "", "", ""));
        day.lessons.add(new ScheduleWidgetData.Lesson("C", "11:10", "", "", ""));
        check(day.lessonCount() == 2, "Alternatives count as a single time slot");
        ScheduleWidgetData data = new ScheduleWidgetData();
        data.days.put(day.date, day);
        data.days.put("21.10.2026", new ScheduleWidgetData.Day("21.10.2026", true));
        data.days.put("22.10.2026", new ScheduleWidgetData.Day("22.10.2026", false));
        check(data.day("21.10.2026") != null && data.day("21.10.2026").lessonCount() == 0, "Confirmed empty day");
        check(data.day("22.10.2026") == null && data.day("23.10.2026") == null, "Unavailable is different from empty");
        System.out.println("Android widget core: " + checks + " assertions passed (calendar, migration, paging, resize, data)");
    }
}
