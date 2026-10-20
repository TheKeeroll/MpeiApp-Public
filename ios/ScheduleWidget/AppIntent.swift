import Foundation
import WidgetKit
import AppIntents

private enum WidgetDayChangeError: Error { case appGroupUnavailable }

private func selectWidgetDay(_ rawValue: String) throws {
    guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: ScheduleWidgetContract.appGroup) != nil,
          let defaults = UserDefaults(suiteName: ScheduleWidgetContract.appGroup) else {
        throw WidgetDayChangeError.appGroupUnavailable
    }
    let now = Date()
    let key = rawValue == WidgetSchedulePayload.dateString(now) ? "today" : rawValue
    let selection = WidgetDaySelection.restored(key, relativeTo: now)
    defaults.set(selection.rawValue, forKey: ScheduleWidgetContract.dayKey)
    WidgetCenter.shared.reloadTimelines(ofKind: ScheduleWidgetContract.kind)
}

@available(iOSApplicationExtension 17.0, *)
struct SelectScheduleDayIntent: AppIntent {
    static var title: LocalizedStringResource = "Выбрать день расписания"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Дата") var date: String

    init() { date = "today" }
    init(date: String) { self.date = date }

    func perform() async throws -> some IntentResult {
        try selectWidgetDay(date)
        return .result()
    }
}

// Keep the old intent names for taps on a timeline archived before the update.
@available(iOSApplicationExtension 17.0, *)
struct YesterdayClickHandler: AppIntent {
    static var title: LocalizedStringResource = "Расписание на вчера"
    func perform() async throws -> some IntentResult {
        try selectWidgetDay("yesterday")
        return .result()
    }
}

@available(iOSApplicationExtension 17.0, *)
struct TodayClickHandler: AppIntent {
    static var title: LocalizedStringResource = "Расписание на сегодня"
    func perform() async throws -> some IntentResult {
        try selectWidgetDay("today")
        return .result()
    }
}

@available(iOSApplicationExtension 17.0, *)
struct TomorrowClickHandler: AppIntent {
    static var title: LocalizedStringResource = "Расписание на завтра"
    func perform() async throws -> some IntentResult {
        try selectWidgetDay("tomorrow")
        return .result()
    }
}
