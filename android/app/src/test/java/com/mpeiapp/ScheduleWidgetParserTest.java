package com.mpeiapp;

/** Optional JVM parser checks use a supplied org.json runtime, never an app dependency. */
public final class ScheduleWidgetParserTest {
    private static int checks;
    private static void check(boolean value, String message) {
        checks++;
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) throws Exception {
        ScheduleWidgetData legacy = JsonParser.parseJson("{\"dataForWidget\":{\"today\":{\"date\":\"20.10.2026\",\"isEmpty\":false,\"lessons\":[{\"name\":\"Физика\",\"lessonIndex\":\"09:20\",\"teacher\":{\"name\":\"-\"}}]},\"yesterday\":{\"date\":\"NOT_SET\"},\"tomorrow\":{\"date\":\"21.10.2026\",\"lessons\":[]}}}");
        check(legacy.day("20.10.2026") != null, "Legacy wrapper survives upgrade");
        check(legacy.days.size() == 2, "Legacy placeholders are ignored");
        check(legacy.day("20.10.2026").lessons.size() == 1, "Legacy lesson is retained");
        check(legacy.day("20.10.2026").lessons.get(0).teacher.isEmpty(), "Unknown teacher is hidden");
        check(legacy.day("21.10.2026").lessons.isEmpty(), "Legacy confirmed empty day");
        ScheduleWidgetData current = JsonParser.parseJson("{\"schemaVersion\":1,\"days\":[null,{}, {\"date\":\"20.10.2026\",\"isLoaded\":true,\"lessons\":[null,{\"type\":\"DINNER\"},{\"type\":\"PLACEHOLDER\"},{\"name\":\"Физика\",\"cabinet\":\"Спортзал\",\"teacher\":null},{}]}, {\"date\":\"21.10.2026\",\"isLoaded\":false,\"lessons\":[{\"name\":\"Stale\"}]}, {\"date\":\"22.10.2026\",\"lessons\":null}]}");
        check(current.days.size() == 3, "Malformed entries do not break other days");
        check(current.day("20.10.2026").lessons.size() == 2, "Lunch, placeholders and nulls are excluded");
        check(current.day("20.10.2026").lessons.get(0).cabinet.equals("Стадион"), "Sports location is preserved");
        check(current.day("20.10.2026").lessons.get(0).teacher.isEmpty(), "Null teacher does not crash");
        check(current.day("20.10.2026").lessons.get(1).name.equals("Занятие"), "Partial lesson has a safe title");
        check(current.day("21.10.2026") == null, "isLoaded false does not become a free day");
        check(current.day("22.10.2026") == null, "Missing lessons are not confirmed empty");
        for (String invalid : new String[]{"", "null", "[]", "{}", "{\"schemaVersion\":2,\"days\":[]}", "{\"days\":null}"}) {
            boolean failed = false;
            try { JsonParser.parseJson(invalid); } catch (org.json.JSONException expected) { failed = true; }
            check(failed, "Invalid payload must be rejected");
        }
        System.out.println("Android widget parser: " + checks + " assertions passed (legacy, empty data, malformed fields, filtering)");
    }
}
