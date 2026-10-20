import Foundation

enum ScheduleWidgetContract {
    static let appGroup = "group.com.mpeiapp"
    static let dataKey = "widgetKey"
    static let dayKey = "widgetKeyDay"
    static let kind = "ScheduleWidget"
    static let notice = "Откройте MpeiApp, чтобы загрузить или обновить расписание в виджете."
}

enum WidgetDayChoice: String, CaseIterable, Hashable {
    case yesterday, today, tomorrow

    var offset: Int {
        switch self { case .yesterday: return -1; case .today: return 0; case .tomorrow: return 1 }
    }
    var title: String {
        switch self { case .yesterday: return "Вчера"; case .today: return "Сегодня"; case .tomorrow: return "Завтра" }
    }
    static func restored(_ rawValue: String?) -> Self {
        return rawValue.flatMap(Self.init(rawValue:)) ?? .today
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
    let lessons: [WidgetLesson]

    private enum CodingKeys: String, CodingKey { case date, lessons }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        date = try values.decodeIfPresent(String.self, forKey: .date) ?? "NOT_SET"
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

    static func dateString(_ date: Date, calendar: Calendar = .current) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "dd.MM.yyyy"
        return formatter.string(from: date)
    }

    func day(_ choice: WidgetDayChoice, relativeTo now: Date, calendar: Calendar = .current) -> WidgetScheduleDay? {
        guard let target = calendar.date(byAdding: .day, value: choice.offset, to: now) else { return nil }
        let date = Self.dateString(target, calendar: calendar)
        return days.first { $0.date == date }
    }
}
