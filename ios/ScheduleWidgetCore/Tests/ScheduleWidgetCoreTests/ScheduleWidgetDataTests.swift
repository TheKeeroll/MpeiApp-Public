import XCTest
@testable import ScheduleWidgetCore

final class ScheduleWidgetDataTests: XCTestCase {
    private var calendar: Calendar {
        var result = Calendar(identifier: .gregorian)
        result.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return result
    }
    private func date(_ year: Int, _ month: Int, _ day: Int) throws -> Date {
        try XCTUnwrap(calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)))
    }

    func testMissingCorruptAndUnknownPayloadsRemainEmpty() {
        for raw in [nil, "", "Placeholder", "No data obtained", "{}", "[]", "null", "{\"schemaVersion\":2,\"days\":[]}"] as [String?] {
            XCTAssertNil(WidgetSchedulePayload.decode(raw))
        }
    }

    func testMissingOrInvalidSelectedDayDefaultsToTodayAndLegacyChoicesMigrate() throws {
        let now = try date(2026, 10, 20)
        XCTAssertEqual(WidgetDaySelection.restored(nil, relativeTo: now, calendar: calendar), .today)
        XCTAssertEqual(WidgetDaySelection.restored("invalid", relativeTo: now, calendar: calendar), .today)
        XCTAssertEqual(WidgetDaySelection.restored("today", relativeTo: now, calendar: calendar), .today)
        XCTAssertEqual(WidgetDaySelection.restored("20.10.2026", relativeTo: now, calendar: calendar), .date("20.10.2026"))
        XCTAssertEqual(WidgetDaySelection.restored("tomorrow", relativeTo: now, calendar: calendar), .date("21.10.2026"))
        XCTAssertEqual(WidgetDaySelection.restored("yesterday", relativeTo: now, calendar: calendar), .date("19.10.2026"))
        XCTAssertEqual(WidgetDaySelection.restored("yesterday", relativeTo: try date(2026, 10, 19), calendar: calendar), .today)
    }

    func testLegacyThreeDayDataSurvivesUpgradeAndIncompleteLessonsDoNotCrash() throws {
        let payload = try XCTUnwrap(WidgetSchedulePayload.decode(#"{"yesterday":{"date":"19.10.2026","lessons":null},"today":{"date":"20.10.2026","lessons":[{}, {"name":null,"lessonType":null}]},"tomorrow":{"date":"21.10.2026"}}"#))
        let today = try XCTUnwrap(payload.day(on: date(2026, 10, 20), calendar: calendar))
        XCTAssertEqual(today.visibleLessons.count, 2)
        XCTAssertEqual(today.lessonCount, 2)
        XCTAssertEqual(payload.days.first?.lessons.count, 0)
    }

    func testWindowContainsTwoFullWeeksAndPagesToSameWeekday() throws {
        let now = try date(2026, 10, 20)
        let window = WidgetScheduleWindow(containing: now, calendar: calendar)
        XCTAssertEqual(window.dates.count, 14)
        XCTAssertEqual(window.dates.first.map { WidgetSchedulePayload.dateString($0, calendar: calendar) }, "19.10.2026")
        XCTAssertEqual(window.dates.last.map { WidgetSchedulePayload.dateString($0, calendar: calendar) }, "01.11.2026")
        XCTAssertEqual(window.week(containing: now, calendar: calendar).count, 7)
        let next = try XCTUnwrap(window.adjacentWeek(to: now, offset: 1, calendar: calendar))
        XCTAssertEqual(WidgetSchedulePayload.dateString(next, calendar: calendar), "27.10.2026")
        XCTAssertEqual(window.week(containing: next, calendar: calendar).first.map { WidgetSchedulePayload.dateString($0, calendar: calendar) }, "26.10.2026")
        let previous = try XCTUnwrap(window.adjacentWeek(to: next, offset: -1, calendar: calendar))
        XCTAssertEqual(WidgetSchedulePayload.dateString(previous, calendar: calendar), "20.10.2026")
        XCTAssertNil(window.adjacentWeek(to: now, offset: -1, calendar: calendar))
        XCTAssertNil(window.adjacentWeek(to: next, offset: 1, calendar: calendar))
        XCTAssertNil(window.adjacentWeek(to: now, offset: 2, calendar: calendar))
    }

    func testWeekStartsOnMondayEvenWithSundayFirstInDeviceCalendar() throws {
        let sunday = WidgetScheduleWindow(containing: try date(2026, 10, 25), calendar: calendar)
        let monday = WidgetScheduleWindow(containing: try date(2026, 10, 26), calendar: calendar)
        XCTAssertEqual(sunday.dates.first.map { WidgetSchedulePayload.dateString($0, calendar: calendar) }, "19.10.2026")
        XCTAssertEqual(monday.dates.first.map { WidgetSchedulePayload.dateString($0, calendar: calendar) }, "26.10.2026")
        XCTAssertEqual(monday.dates.last.map { WidgetSchedulePayload.dateString($0, calendar: calendar) }, "08.11.2026")
    }

    func testWindowCrossesYearAndLeapDay() throws {
        let newYear = WidgetScheduleWindow(containing: try date(2027, 1, 1), calendar: calendar)
        XCTAssertEqual(newYear.dates.first.map { WidgetSchedulePayload.dateString($0, calendar: calendar) }, "28.12.2026")
        XCTAssertEqual(newYear.dates.last.map { WidgetSchedulePayload.dateString($0, calendar: calendar) }, "10.01.2027")
        let leap = WidgetScheduleWindow(containing: try date(2028, 2, 29), calendar: calendar)
        XCTAssertEqual(leap.dates.count, 14)
        XCTAssertNotNil(leap.date(for: "29.02.2028", calendar: calendar))
        XCTAssertEqual(leap.dates.last.map { WidgetSchedulePayload.dateString($0, calendar: calendar) }, "12.03.2028")
    }

    func testCalendarDayArithmeticDoesNotSkipDatesAtDSTTransition() throws {
        var dstCalendar = calendar
        dstCalendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        let now = try XCTUnwrap(dstCalendar.date(from: DateComponents(year: 2027, month: 3, day: 10, hour: 12)))
        let window = WidgetScheduleWindow(containing: now, calendar: dstCalendar)
        let keys = window.dates.map { WidgetSchedulePayload.dateString($0, calendar: dstCalendar) }
        XCTAssertEqual(keys.count, 14)
        XCTAssertEqual(Set(keys).count, 14)
        XCTAssertEqual(keys.first, "08.03.2027")
        XCTAssertEqual(keys.last, "21.03.2027")
        let before = try XCTUnwrap(window.date(for: "14.03.2027", calendar: dstCalendar))
        let after = try XCTUnwrap(window.date(for: "15.03.2027", calendar: dstCalendar))
        XCTAssertEqual(after.timeIntervalSince(before), 23 * 60 * 60)
    }

    func testDefaultWindowUsesMoscowMidnightRatherThanUTCOrDeviceCalendar() throws {
        let now = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 10, day: 25, hour: 21)))
        let window = WidgetScheduleWindow(containing: now)
        XCTAssertEqual(window.dates.first.map { WidgetSchedulePayload.dateString($0) }, "26.10.2026")
        XCTAssertEqual(window.dates.last.map { WidgetSchedulePayload.dateString($0) }, "08.11.2026")
        XCTAssertEqual(WidgetSchedulePayload.dateString(WidgetDaySelection.today.date(relativeTo: now)), "26.10.2026")
    }

    func testExplicitDatePersistsUntilItLeavesTheCurrentTwoWeeks() throws {
        let key = "01.11.2026"
        XCTAssertEqual(WidgetDaySelection.restored(key, relativeTo: try date(2026, 10, 20), calendar: calendar), .date(key))
        XCTAssertEqual(WidgetDaySelection.restored(key, relativeTo: try date(2026, 10, 26), calendar: calendar), .date(key))
        XCTAssertEqual(WidgetDaySelection.restored(key, relativeTo: try date(2026, 11, 2), calendar: calendar), .today)
        XCTAssertEqual(WidgetDaySelection.restored("31.02.2026", relativeTo: try date(2026, 2, 25), calendar: calendar), .today)
    }

    func testTodayTracksMidnightWhileAnotherSelectedDateStaysFixed() throws {
        let before = try date(2026, 10, 20)
        let after = try date(2026, 10, 21)
        XCTAssertEqual(WidgetSchedulePayload.dateString(WidgetDaySelection.today.date(relativeTo: before, calendar: calendar), calendar: calendar), "20.10.2026")
        XCTAssertEqual(WidgetSchedulePayload.dateString(WidgetDaySelection.today.date(relativeTo: after, calendar: calendar), calendar: calendar), "21.10.2026")
        let selected = WidgetDaySelection.restored("22.10.2026", relativeTo: before, calendar: calendar)
        XCTAssertEqual(WidgetSchedulePayload.dateString(selected.date(relativeTo: after, calendar: calendar), calendar: calendar), "22.10.2026")
        XCTAssertEqual(WidgetDaySelection.restored(selected.rawValue, relativeTo: try date(2026, 10, 22), calendar: calendar), .date("22.10.2026"))
    }

    func testPayloadLooksUpActualDatesAcrossTheYearBoundary() throws {
        let payload = try XCTUnwrap(WidgetSchedulePayload.decode(#"{"schemaVersion":1,"days":[{"date":"31.12.2026","lessons":[]},{"date":"01.01.2027","lessons":[]},{"date":"02.01.2027","lessons":[]}]}"#))
        XCTAssertEqual(payload.day(on: try date(2026, 12, 31), calendar: calendar)?.date, "31.12.2026")
        XCTAssertEqual(payload.day(on: try date(2027, 1, 1), calendar: calendar)?.date, "01.01.2027")
        XCTAssertNil(payload.day(on: try date(2027, 1, 3), calendar: calendar))
    }

    func testLunchAndPlaceholdersAreExcludedAndAlternativeSlotsCountOnce() throws {
        let payload = try XCTUnwrap(WidgetSchedulePayload.decode(#"{"days":[{"date":"20.10.2026","lessons":[{"type":"DINNER"},{"type":"PLACEHOLDER"},{"name":"По выбору A","lessonIndex":"09:20"},{"name":"По выбору B","lessonIndex":"09:20"},{"name":"По выбору C","lessonIndex":"11:10"}]}]}"#))
        let day = try XCTUnwrap(payload.days.first)
        XCTAssertEqual(day.visibleLessons.count, 3)
        XCTAssertEqual(day.lessonCount, 2)
    }

    func testEmptyDayAndUnloadedDayAreDifferentStates() throws {
        let payload = try XCTUnwrap(WidgetSchedulePayload.decode(#"{"days":[{"date":"20.10.2026","isLoaded":true,"lessons":[]},{"date":"21.10.2026","isLoaded":false,"lessons":[]}]}"#))
        XCTAssertEqual(payload.day(on: try date(2026, 10, 20), calendar: calendar)?.visibleLessons.count, 0)
        XCTAssertNil(payload.day(on: try date(2026, 10, 21), calendar: calendar))
        XCTAssertNil(payload.day(on: try date(2026, 10, 22), calendar: calendar))
    }
}
