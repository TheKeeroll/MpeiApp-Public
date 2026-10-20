import Foundation
import WidgetKit
import AppIntents

private enum WidgetDayChangeError: Error { case appGroupUnavailable }

private func selectWidgetDay(_ day: WidgetDayChoice) throws {
    guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: ScheduleWidgetContract.appGroup) != nil,
          let defaults = UserDefaults(suiteName: ScheduleWidgetContract.appGroup) else {
        throw WidgetDayChangeError.appGroupUnavailable
    }
    defaults.set(day.rawValue, forKey: ScheduleWidgetContract.dayKey)
    WidgetCenter.shared.reloadTimelines(ofKind: ScheduleWidgetContract.kind)
}

@available(iOSApplicationExtension 17.0, *)
struct YesterdayClickHandler: AppIntent {
    static var title: LocalizedStringResource = "Расписание на вчера"
    func perform() async throws -> some IntentResult {
        try selectWidgetDay(.yesterday)
        return .result()
    }
}

@available(iOSApplicationExtension 17.0, *)
struct TodayClickHandler: AppIntent {
    static var title: LocalizedStringResource = "Расписание на сегодня"
    func perform() async throws -> some IntentResult {
        try selectWidgetDay(.today)
        return .result()
    }
}

@available(iOSApplicationExtension 17.0, *)
struct TomorrowClickHandler: AppIntent {
    static var title: LocalizedStringResource = "Расписание на завтра"
    func perform() async throws -> some IntentResult {
        try selectWidgetDay(.tomorrow)
        return .result()
    }
}
