import Foundation
import WidgetKit
import SwiftUI

struct SimpleEntry: TimelineEntry {
    let date: Date
    let payload: WidgetSchedulePayload?
    let selection: WidgetDaySelection

    var selectedDate: Date { selection.date(relativeTo: date) }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry { previewEntry() }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(context.isPreview ? previewEntry() : readEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let now = Date()
        let entry = readEntry(at: now)
        let calendar = ScheduleWidgetContract.calendar
        var entries = [entry] // Show current data immediately, not five minutes later.
        for offset in 1...14 {
            if let midnight = calendar.date(byAdding: .day, value: offset, to: calendar.startOfDay(for: now)) {
                let selection = WidgetDaySelection.restored(entry.selection.rawValue, relativeTo: midnight)
                entries.append(SimpleEntry(date: midnight, payload: entry.payload, selection: selection))
            }
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func readEntry(at date: Date) -> SimpleEntry {
        let defaults = UserDefaults(suiteName: ScheduleWidgetContract.appGroup)
        let rawSelection = defaults?.string(forKey: ScheduleWidgetContract.dayKey)
        let selection = WidgetDaySelection.restored(rawSelection, relativeTo: date)
        if rawSelection == "yesterday" || rawSelection == "tomorrow" {
            defaults?.set(selection.rawValue, forKey: ScheduleWidgetContract.dayKey)
        }
        return SimpleEntry(date: date,
                           payload: WidgetSchedulePayload.decode(defaults?.string(forKey: ScheduleWidgetContract.dataKey)),
                           selection: selection)
    }

    fileprivate func previewEntry() -> SimpleEntry {
        let now = Date()
        let days = WidgetScheduleWindow(containing: now).dates.map { date -> [String: Any] in
            let weekday = ScheduleWidgetContract.calendar.component(.weekday, from: date)
            let lessons: [[String: String]] = weekday == 1 ? [] : [
                ["name": "Математический анализ", "lessonIndex": "09:20 – 10:55", "lessonType": "Лекция", "cabinet": "Б-302", "type": "COMMON"],
                ["name": "Физика", "lessonIndex": "11:10 – 12:45", "lessonType": "Практическое занятие", "cabinet": "Г-210", "type": "COMMON"]
            ]
            return ["date": WidgetSchedulePayload.dateString(date), "isLoaded": true, "lessons": lessons]
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
    @ScaledMetric(relativeTo: .caption2) private var dayTileHeight: CGFloat = 66
    @ScaledMetric(relativeTo: .headline) private var headerHeight: CGFloat = 28
    @ScaledMetric(relativeTo: .caption) private var headingHeight: CGFloat = 20
    @ScaledMetric(relativeTo: .caption2) private var noticeHeight: CGFloat = 32

    var body: some View {
        GeometryReader { geometry in
            let window = WidgetScheduleWindow(containing: entry.date)
            let week = window.week(containing: entry.selectedDate)
            let day = entry.payload?.day(on: entry.selectedDate)
            let lessons = day?.visibleLessons ?? []
            let fixedHeight = dayTileHeight + headerHeight + headingHeight + noticeHeight + 28
            let limit = max(0, min(4, Int(max(0, geometry.size.height - fixedHeight) / (lessonHeight + 7))))
            VStack(alignment: .leading, spacing: 7) {
                weekHeader(window: window, week: week)
                daySelector(week, maxCircleSize: max(12, (geometry.size.width - 24) / 7 - 4))
                selectedDayHeading(day)
                lessonList(day: day, lessons: lessons, limit: limit).invalidatableContent()
                Spacer(minLength: 0)
                // A read-only notice replaces the editable configuration parameter.
                Text(ScheduleWidgetContract.notice)
                    .font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private func weekHeader(window: WidgetScheduleWindow, week: [Date]) -> some View {
        HStack(spacing: 5) {
            Label("Расписание", systemImage: "calendar")
                .font(.headline).foregroundStyle(.primary).lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 0)
            WeekArrow(target: window.adjacentWeek(to: entry.selectedDate, offset: -1), forward: false)
            Text(weekTitle(week)).font(.caption2).foregroundStyle(.secondary)
                .lineLimit(1).minimumScaleFactor(0.75).invalidatableContent()
            WeekArrow(target: window.adjacentWeek(to: entry.selectedDate, offset: 1), forward: true)
        }
        .frame(minHeight: headerHeight)
    }

    private func daySelector(_ week: [Date], maxCircleSize: CGFloat) -> some View {
        HStack(spacing: 4) {
            ForEach(week, id: \.self) { date in
                DayTab(date: date,
                       selected: ScheduleWidgetContract.calendar.isDate(date, inSameDayAs: entry.selectedDate),
                       isToday: ScheduleWidgetContract.calendar.isDate(date, inSameDayAs: entry.date),
                       day: entry.payload?.day(on: date), maxCircleSize: maxCircleSize)
                    .frame(height: dayTileHeight)
            }
        }
        .invalidatableContent()
    }

    private func selectedDayHeading(_ day: WidgetScheduleDay?) -> some View {
        HStack(spacing: 5) {
            Text(dayHeading(day))
                .font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 0)
            if !ScheduleWidgetContract.calendar.isDate(entry.selectedDate, inSameDayAs: entry.date) {
                Button(intent: SelectScheduleDayIntent(date: "today")) { Text("Сегодня").font(.caption).fontWeight(.semibold) }
                    .buttonStyle(.plain).foregroundStyle(.primary).accessibilityLabel("Вернуться к сегодняшнему дню")
            }
        }
        .frame(minHeight: headingHeight).invalidatableContent()
    }

    @ViewBuilder
    private func lessonList(day: WidgetScheduleDay?, lessons: [WidgetLesson], limit: Int) -> some View {
        if entry.payload == nil {
            Text("Расписание ещё не загружено").font(.subheadline).foregroundStyle(.primary)
        } else if day == nil {
            Text("На этот день расписание не загружено.").font(.subheadline).foregroundStyle(.primary)
        } else if lessons.isEmpty {
            Text("Занятий нет").font(.subheadline).foregroundStyle(.primary)
        } else {
            ForEach(Array(lessons.prefix(limit).enumerated()), id: \.offset) { _, lesson in
                LessonView(item: lesson)
            }
            if lessons.count > limit {
                Text(limit == 0 ? "Занятий: \(lessons.count). Подробнее в приложении." : "Ещё занятий: \(lessons.count - limit)")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
    }

    private func dayHeading(_ day: WidgetScheduleDay?) -> String {
        let title = formattedWidgetDate(entry.selectedDate, format: "EEE, d MMM").capitalized
        return day.map { "\(title) · Пар: \($0.lessonCount)" } ?? title
    }

    private func weekTitle(_ dates: [Date]) -> String {
        guard let first = dates.first, let last = dates.last else { return "" }
        let calendar = ScheduleWidgetContract.calendar
        let format = calendar.component(.month, from: first) == calendar.component(.month, from: last) ? "d" : "d MMM"
        return "\(formattedWidgetDate(first, format: format))–\(formattedWidgetDate(last, format: "d MMM"))"
    }
}

private func formattedWidgetDate(_ date: Date, format: String) -> String {
    let formatter = DateFormatter()
    formatter.calendar = ScheduleWidgetContract.calendar
    formatter.timeZone = ScheduleWidgetContract.calendar.timeZone
    formatter.locale = Locale(identifier: "ru_RU")
    formatter.dateFormat = format
    return formatter.string(from: date)
}

@available(iOSApplicationExtension 17.0, *)
private struct WeekArrow: View {
    let target: Date?
    let forward: Bool

    var body: some View {
        Button(intent: SelectScheduleDayIntent(date: target.map { WidgetSchedulePayload.dateString($0) } ?? "today")) {
            Image(systemName: forward ? "chevron.right" : "chevron.left")
                .font(.caption).fontWeight(.semibold).frame(width: 26, height: 28).contentShape(Rectangle())
        }
        .buttonStyle(.plain).foregroundStyle(.primary).disabled(target == nil)
        .opacity(target == nil ? 0.25 : 1)
        .accessibilityLabel(forward ? "Следующая неделя" : "Предыдущая неделя")
    }
}

@available(iOSApplicationExtension 17.0, *)
private struct DayTab: View {
    let date: Date
    let selected: Bool
    let isToday: Bool
    let day: WidgetScheduleDay?
    let maxCircleSize: CGFloat
    @Environment(\.widgetRenderingMode) private var renderingMode
    @ScaledMetric(relativeTo: .caption2) private var circleSize: CGFloat = 26

    private var dateBackground: Color {
        if isToday { return renderingMode == .fullColor ? Color(red: 1, green: 0.337, blue: 0.4) : Color.accentColor.opacity(0.3) }
        return selected ? Color.accentColor.opacity(0.22) : Color.primary.opacity(0.07)
    }

    var body: some View {
        Button(intent: SelectScheduleDayIntent(date: isToday ? "today" : WidgetSchedulePayload.dateString(date))) {
            VStack(spacing: 2) {
                Text(formattedWidgetDate(date, format: "EE").capitalized)
                    .font(.caption2).fontWeight(isToday || selected ? .semibold : .regular)
                Text(formattedWidgetDate(date, format: "d"))
                    .font(.caption).fontWeight(isToday || selected ? .bold : .regular).monospacedDigit()
                    .frame(width: min(circleSize, maxCircleSize), height: min(circleSize, maxCircleSize))
                    .background(dateBackground, in: Circle())
                    .foregroundStyle(isToday && renderingMode == .fullColor ? Color.white : Color.primary)
                    .widgetAccentable(isToday || selected)
                Text(formattedWidgetDate(date, format: "MMM")).font(.caption2).foregroundStyle(.secondary)
            }
            .lineLimit(1).minimumScaleFactor(0.7)
            .frame(maxWidth: .infinity, maxHeight: .infinity).padding(.horizontal, 2).padding(.vertical, 4)
            .background(Color.primary.opacity(selected ? 0.12 : 0.04), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(selected ? Color.primary.opacity(0.6) : .clear, lineWidth: 1.5))
        }
        .buttonStyle(.plain).foregroundStyle(.primary)
        .opacity(day == nil && !isToday && !selected ? 0.45 : 1)
        .accessibilityLabel(accessibilityText)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var accessibilityText: String {
        let title = formattedWidgetDate(date, format: "EEEE, d MMMM")
        let today = isToday ? ", сегодня" : ""
        let status = day.map { "пар: \($0.lessonCount)" } ?? "расписание не загружено"
        return "\(title)\(today), \(status)"
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
