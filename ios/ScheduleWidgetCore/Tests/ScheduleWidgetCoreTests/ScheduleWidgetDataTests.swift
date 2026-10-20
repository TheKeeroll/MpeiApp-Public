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

    func testMissingOrInvalidSelectedDayDefaultsToToday() {
        XCTAssertEqual(WidgetDayChoice.restored(nil), .today)
        XCTAssertEqual(WidgetDayChoice.restored("invalid"), .today)
        XCTAssertEqual(WidgetDayChoice.restored("tomorrow"), .tomorrow)
    }

    func testLegacyThreeDayDataSurvivesUpgradeAndIncompleteLessonsDoNotCrash() throws {
        let payload = try XCTUnwrap(WidgetSchedulePayload.decode(#"{"yesterday":{"date":"19.10.2026","lessons":null},"today":{"date":"20.10.2026","lessons":[{}, {"name":null,"lessonType":null}]},"tomorrow":{"date":"21.10.2026"}}"#))
        let today = try XCTUnwrap(payload.day(.today, relativeTo: date(2026, 10, 20), calendar: calendar))
        XCTAssertEqual(today.visibleLessons.count, 2)
        XCTAssertEqual(today.lessonCount, 2)
        XCTAssertEqual(payload.days.first?.lessons.count, 0)
    }

    func testNewPayloadSelectsCalendarDaysAndHandlesMidnightYearBoundary() throws {
        let payload = try XCTUnwrap(WidgetSchedulePayload.decode(#"{"schemaVersion":1,"days":[{"date":"31.12.2026","lessons":[]},{"date":"01.01.2027","lessons":[]},{"date":"02.01.2027","lessons":[]}]}"#))
        XCTAssertEqual(payload.day(.tomorrow, relativeTo: try date(2026, 12, 31), calendar: calendar)?.date, "01.01.2027")
        XCTAssertEqual(payload.day(.today, relativeTo: try date(2027, 1, 1), calendar: calendar)?.date, "01.01.2027")
        XCTAssertEqual(payload.day(.yesterday, relativeTo: try date(2027, 1, 1), calendar: calendar)?.date, "31.12.2026")
        XCTAssertNil(payload.day(.tomorrow, relativeTo: try date(2027, 1, 2), calendar: calendar))
    }

    func testLunchAndPlaceholdersAreExcludedAndAlternativeSlotsCountOnce() throws {
        let payload = try XCTUnwrap(WidgetSchedulePayload.decode(#"{"days":[{"date":"20.10.2026","lessons":[{"type":"DINNER"},{"type":"PLACEHOLDER"},{"name":"По выбору A","lessonIndex":"09:20"},{"name":"По выбору B","lessonIndex":"09:20"},{"name":"По выбору C","lessonIndex":"11:10"}]}]}"#))
        let day = try XCTUnwrap(payload.days.first)
        XCTAssertEqual(day.visibleLessons.count, 3)
        XCTAssertEqual(day.lessonCount, 2)
    }

    func testEmptyDayAndUnloadedDayAreDifferentStates() throws {
        let payload = try XCTUnwrap(WidgetSchedulePayload.decode(#"{"days":[{"date":"20.10.2026","lessons":[]}]}"#))
        XCTAssertEqual(payload.day(.today, relativeTo: try date(2026, 10, 20), calendar: calendar)?.visibleLessons.count, 0)
        XCTAssertNil(payload.day(.tomorrow, relativeTo: try date(2026, 10, 20), calendar: calendar))
    }
}
