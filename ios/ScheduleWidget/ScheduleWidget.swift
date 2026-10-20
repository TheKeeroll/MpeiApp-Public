import Foundation
import WidgetKit
import SwiftUI

struct SimpleEntry: TimelineEntry {
    let date: Date
    let payload: WidgetSchedulePayload?
    let selection: WidgetDayChoice
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry { previewEntry() }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(context.isPreview ? previewEntry() : readEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let now = Date()
        let entry = readEntry(at: now)
        let calendar = Calendar.current
        var entries = [entry] // Show current data immediately, not five minutes later.
        for offset in 1...3 {
            if let midnight = calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: now)) {
                entries.append(SimpleEntry(date: midnight, payload: entry.payload, selection: entry.selection))
            }
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func readEntry(at date: Date) -> SimpleEntry {
        let defaults = UserDefaults(suiteName: ScheduleWidgetContract.appGroup)
        return SimpleEntry(date: date,
                           payload: WidgetSchedulePayload.decode(defaults?.string(forKey: ScheduleWidgetContract.dataKey)),
                           selection: .restored(defaults?.string(forKey: ScheduleWidgetContract.dayKey)))
    }

    fileprivate func previewEntry() -> SimpleEntry {
        let now = Date()
        let days = WidgetDayChoice.allCases.compactMap { choice -> [String: Any]? in
            guard let date = Calendar.current.date(byAdding: .day, value: choice.offset, to: now) else { return nil }
            return ["date": WidgetSchedulePayload.dateString(date), "lessons": [
                ["name": "Математический анализ", "lessonIndex": "09:20 – 10:55", "lessonType": "Лекция", "cabinet": "Б-302", "type": "COMMON"],
                ["name": "Физика", "lessonIndex": "11:10 – 12:45", "lessonType": "Практическое занятие", "cabinet": "Г-210", "type": "COMMON"]
            ]]
        }
        let example: [String: Any] = ["schemaVersion": 1, "days": days]
        let data = try? JSONSerialization.data(withJSONObject: example)
        let payload = data.flatMap { try? JSONDecoder().decode(WidgetSchedulePayload.self, from: $0) }
        return SimpleEntry(date: now, payload: payload, selection: .today)
    }
}

@available(iOSApplicationExtension 17.0, *)
struct ScheduleWidgetEntryView: View {
    let entry: SimpleEntry
    @ScaledMetric(relativeTo: .caption) private var lessonHeight: CGFloat = 52

    var body: some View {
        GeometryReader { geometry in
            let day = entry.payload?.day(entry.selection, relativeTo: entry.date)
            let lessons = day?.visibleLessons ?? []
            let limit = max(1, min(4, Int(max(0, geometry.size.height - 148) / lessonHeight)))
            VStack(alignment: .leading, spacing: 7) {
                Label("Расписание", systemImage: "calendar").font(.headline).foregroundStyle(.primary)
                if let payload = entry.payload, !payload.days.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(WidgetDayChoice.allCases, id: \.self) { choice in
                            DayTab(choice: choice, selected: entry.selection == choice)
                        }
                    }
                    Text(dayHeading(day))
                        .font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.8)
                    if day == nil {
                        Text("На эту дату нет загруженного расписания.").font(.subheadline).foregroundStyle(.primary)
                    } else if lessons.isEmpty {
                        Text("Занятий нет").font(.subheadline).foregroundStyle(.primary)
                    } else {
                        ForEach(Array(lessons.prefix(limit).enumerated()), id: \.offset) { _, lesson in
                            LessonView(item: lesson)
                        }
                        if lessons.count > limit {
                            Text("Ещё занятий: \(lessons.count - limit)").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                } else {
                    Text("Расписание ещё не загружено").font(.subheadline).foregroundStyle(.primary)
                }
                Spacer(minLength: 0)
                // A read-only notice replaces the editable configuration parameter.
                Text(ScheduleWidgetContract.notice)
                    .font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private func dayHeading(_ day: WidgetScheduleDay?) -> String {
        let date = Calendar.current.date(byAdding: .day, value: entry.selection.offset, to: entry.date) ?? entry.date
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ru_RU")
        formatter.dateFormat = "EEE, d MMM"
        let title = formatter.string(from: date).capitalized
        return day.map { "\(title) · Пар: \($0.lessonCount)" } ?? title
    }
}

@available(iOSApplicationExtension 17.0, *)
private struct DayTab: View {
    let choice: WidgetDayChoice
    let selected: Bool
    private var label: some View {
        Text(choice.title)
            .font(.caption).fontWeight(selected ? .bold : .regular).lineLimit(1).minimumScaleFactor(0.75)
            .frame(maxWidth: .infinity, minHeight: 32)
            .foregroundStyle(.primary).padding(.horizontal, 2)
            .background(Color.primary.opacity(selected ? 0.18 : 0.07), in: RoundedRectangle(cornerRadius: 8))
            .widgetAccentable(selected)
    }
    var body: some View {
        Group {
            switch choice {
            case .yesterday: Button(intent: YesterdayClickHandler()) { label }
            case .today: Button(intent: TodayClickHandler()) { label }
            case .tomorrow: Button(intent: TomorrowClickHandler()) { label }
            }
        }
        .buttonStyle(.plain)
    }
}

private struct LessonView: View {
    let item: WidgetLesson
    private var typeColor: Color {
        let type = item.lessonType ?? ""
        if type.contains("абота") || type.contains("кзамен") { return .red }
        return type.contains("екция") ? .green : .orange
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 5) {
                Text(item.lessonIndex ?? "Время не указано").foregroundStyle(.primary)
                Text(item.lessonType ?? "Занятие").foregroundStyle(typeColor)
            }
            .font(.caption2).lineLimit(1)
            Text(item.name?.isEmpty == false ? item.name ?? "Занятие" : "Занятие")
                .font(.caption).fontWeight(.semibold).foregroundStyle(.primary).lineLimit(1)
            HStack(spacing: 5) {
                Text(item.cabinet == "Спортзал" ? "Стадион" : item.cabinet ?? "")
                if let teacher = item.teacher?.name, !teacher.isEmpty, teacher != "-" { Text(teacher) }
            }
            .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 7).padding(.vertical, 4)
        .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
    }
}

@available(iOSApplicationExtension 17.0, *)
struct ScheduleWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: ScheduleWidgetContract.kind, provider: Provider()) { entry in
            ScheduleWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) { Color(uiColor: .systemBackground) }
        }
        .configurationDisplayName("Виджет расписания")
        .description("Откройте MpeiApp, чтобы загрузить или обновить расписание в виджете.")
        .supportedFamilies([.systemLarge])
    }
}

@available(iOSApplicationExtension 17.0, *)
struct ScheduleWidget_Previews: PreviewProvider {
    static var previews: some View {
        ScheduleWidgetEntryView(entry: Provider().previewEntry())
            .containerBackground(for: .widget) { Color(uiColor: .systemBackground) }
            .previewContext(WidgetPreviewContext(family: .systemLarge))
    }
}
