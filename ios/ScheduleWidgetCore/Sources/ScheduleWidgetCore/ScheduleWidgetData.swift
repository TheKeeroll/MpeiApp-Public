import Foundation

enum ScheduleWidgetContract {
    static let appGroup = "group.com.mpeiapp"
    static let dataKey = "widgetKey"
    static let dayKey = "widgetKeyDay"
    static let kind = "ScheduleWidget"
    static let notice = "Откройте MpeiApp, чтобы загрузить или обновить расписание в виджете."

    // Match the Moscow date used by the app's schedule, including when travelling.
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Moscow") ?? TimeZone(secondsFromGMT: 10800) ?? .current
        calendar.firstWeekday = 2
        return calendar
    }
}

struct WidgetScheduleWindow {
    let dates: [Date]

    init(containing now: Date, calendar: Calendar = ScheduleWidgetContract.calendar) {
        let today = calendar.startOfDay(for: now)
        let offset = (calendar.component(.weekday, from: today) + 5) % 7
        let monday = calendar.date(byAdding: .day, value: -offset, to: today) ?? today
        dates = (0..<14).compactMap { calendar.date(byAdding: .day, value: $0, to: monday) }
    }

    func date(for key: String, calendar: Calendar = ScheduleWidgetContract.calendar) -> Date? {
        dates.first { WidgetSchedulePayload.dateString($0, calendar: calendar) == key }
    }

    func week(containing date: Date, calendar: Calendar = ScheduleWidgetContract.calendar) -> [Date] {
        let index = dates.firstIndex { calendar.isDate($0, inSameDayAs: date) } ?? 0
        return Array(dates.dropFirst(index / 7 * 7).prefix(7))
    }

    func adjacentWeek(to date: Date, offset: Int, calendar: Calendar = ScheduleWidgetContract.calendar) -> Date? {
        guard offset == -1 || offset == 1,
              let index = dates.firstIndex(where: { calendar.isDate($0, inSameDayAs: date) }),
              dates.indices.contains(index + offset * 7) else { return nil }
        return dates[index + offset * 7]
    }
}

enum WidgetDaySelection: Equatable {
    case today
    case date(String)

    var rawValue: String {
        switch self { case .today: return "today"; case .date(let key): return key }
    }

    static func restored(_ rawValue: String?, relativeTo now: Date,
                         calendar: Calendar = ScheduleWidgetContract.calendar) -> Self {
        let window = WidgetScheduleWindow(containing: now, calendar: calendar)
        var key = rawValue ?? "today"
        // Migrate the old relative choices to an actual date on the first read.
        if key == "yesterday" || key == "tomorrow" {
            guard let date = calendar.date(byAdding: .day, value: key == "yesterday" ? -1 : 1, to: now) else { return .today }
            key = WidgetSchedulePayload.dateString(date, calendar: calendar)
        }
        guard window.date(for: key, calendar: calendar) != nil else { return .today }
        return .date(key)
    }

    func date(relativeTo now: Date, calendar: Calendar = ScheduleWidgetContract.calendar) -> Date {
        if case .date(let key) = self,
           let date = WidgetScheduleWindow(containing: now, calendar: calendar).date(for: key, calendar: calendar) {
            return date
        }
        return calendar.startOfDay(for: now)
    }
}

struct WidgetTeacher: Decodable { let name: String? }

struct WidgetLesson: Decodable {
    let name: String?
    let lessonIndex: String?
    let lessonType: String?
    let cabinet: String?
    let teacher: WidgetTeacher?
    let type: String?
}

struct WidgetScheduleDay: Decodable {
    let date: String
    let isLoaded: Bool
    let lessons: [WidgetLesson]

    private enum CodingKeys: String, CodingKey { case date, isLoaded, lessons }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        date = try values.decodeIfPresent(String.self, forKey: .date) ?? "NOT_SET"
        isLoaded = try values.decodeIfPresent(Bool.self, forKey: .isLoaded) ?? true
        lessons = try values.decodeIfPresent([WidgetLesson].self, forKey: .lessons) ?? []
    }

    var visibleLessons: [WidgetLesson] {
        lessons.filter { $0.type != "DINNER" && $0.type != "PLACEHOLDER" }
    }
    var lessonCount: Int {
        Set(visibleLessons.enumerated().map { index, lesson in
            let time = lesson.lessonIndex ?? ""
            return time.isEmpty ? "row:\(index)" : "time:\(time)"
        }).count
    }
}

struct WidgetSchedulePayload: Decodable {
    let days: [WidgetScheduleDay]

    private enum CodingKeys: String, CodingKey { case schemaVersion, days, yesterday, today, tomorrow }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        if values.contains(.days) {
            let version = try values.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? 1
            guard version == 1 else {
                throw DecodingError.dataCorruptedError(forKey: .schemaVersion, in: values, debugDescription: "Unsupported widget schema")
            }
            days = try values.decode([WidgetScheduleDay].self, forKey: .days)
        } else {
            // Preserve the three-day payload already saved by MpeiApp 2.5.0.
            let legacy = try [CodingKeys.yesterday, .today, .tomorrow].compactMap {
                try values.decodeIfPresent(WidgetScheduleDay.self, forKey: $0)
            }
            guard !legacy.isEmpty else {
                throw DecodingError.dataCorruptedError(forKey: .days, in: values, debugDescription: "No schedule in widget payload")
            }
            days = legacy
        }
    }

    static func decode(_ raw: String?) -> Self? {
        guard let data = raw?.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Self.self, from: data)
    }

    static func dateString(_ date: Date, calendar: Calendar = ScheduleWidgetContract.calendar) -> String {
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.timeZone = calendar.timeZone
        let parts = gregorian.dateComponents([.day, .month, .year], from: date)
        guard let day = parts.day, let month = parts.month, let year = parts.year else { return "" }
        return String(format: "%02d.%02d.%04d", day, month, year)
    }

    func day(on date: Date, calendar: Calendar = ScheduleWidgetContract.calendar) -> WidgetScheduleDay? {
        let key = Self.dateString(date, calendar: calendar)
        return days.first { $0.date == key && $0.isLoaded }
    }
}
