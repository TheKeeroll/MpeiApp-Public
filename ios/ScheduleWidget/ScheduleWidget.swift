//
//  ScheduleWidget.swift
//  ScheduleWidget
//
//  Created by DragonSavA on 02.08.2024.
//

import WidgetKit
import SwiftUI
import AppIntents
import Intents

extension Color {
    init(hex: String) {
        var cleanHexCode = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        cleanHexCode = cleanHexCode.replacingOccurrences(of: "#", with: "")
        // print(cleanHexCode)
        var rgb: UInt64 = 0
        
        Scanner(string: cleanHexCode).scanHexInt64(&rgb)
        
        let redValue = Double((rgb >> 16) & 0xFF) / 255.0
        let greenValue = Double((rgb >> 8) & 0xFF) / 255.0
        let blueValue = Double(rgb & 0xFF) / 255.0
        self.init(red: redValue, green: greenValue, blue: blueValue)
    }
}

struct Teacher: Decodable {
  var name: String = ""
  var lec_oid: String = ""
  var fullName: String?
}

struct Lesson: Decodable, Identifiable {
  var id: UUID = UUID()
  var name: String?
  var lessonIndex: String?
  var lessonType: String?
  var place: String?
  var cabinet: String?
  var teacher: Teacher?
  var group: String?
  var type: String?
}

struct Day: Decodable {
  var date: String = ""
  var lessons: [Lesson]?
  var isEmpty: Bool = true
  var isToday: Bool = false
}

struct DataForWidget: Decodable {
  var yesterday: Day = Day()
  var today: Day = Day()
  var tomorrow: Day = Day()
}

@available(iOSApplicationExtension 17, *)
struct Provider: AppIntentTimelineProvider {

  func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> SimpleEntry {
    return SimpleEntry(date: Date(), configuration: configuration, text: "Data goes here")
  }
  
  func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<SimpleEntry> {
    var entry = SimpleEntry(date: Date(), configuration: configuration, text: "Default sign")
    var timeline = Timeline(entries: [entry], policy: .atEnd)
    let userDefaults = UserDefaults.init(suiteName: "group.com.mpeiapp")
    if userDefaults != nil {
    // print("iOS Widget - userDefaults: ")
    // print(userDefaults?.object(forKey: "widgetKey") ?? "failed to obtain")
      let entryDate = Date()
      if let savedData = userDefaults!.object(forKey: "widgetKey") as? String {
        print("iOS Widget - Data obtained: " + savedData)
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 5, to: entryDate)!
        entry = SimpleEntry(date: nextRefresh, configuration: configuration, text: savedData)
        timeline = Timeline(entries: [entry], policy: .atEnd)
      } else {
        print("iOS Widget - No data obtained!")
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 5, to: entryDate)!
        entry = SimpleEntry(date: nextRefresh, configuration: configuration, text: "No data obtained")
        timeline = Timeline(entries: [entry], policy: .atEnd)
      }
    }
    return timeline
  }
  
  typealias Entry = SimpleEntry
  
  typealias Intent = ConfigurationAppIntent
  
   func placeholder(in context: Context) -> SimpleEntry {
      SimpleEntry(date: Date(), configuration: ConfigurationAppIntent(), text: "Placeholder")
  }
}

@available(iOSApplicationExtension 17, *)
struct SimpleEntry: TimelineEntry {
   let date: Date
      let configuration: ConfigurationAppIntent
      let text: String
}

@available(iOSApplicationExtension 17, *)
struct ScheduleWidgetEntryView : View {
  var entry: Provider.Entry?
  
  let calendar = Calendar.current
  let formatter = DateFormatter()
  
  func formatDate(from dateString: String) -> String? {
      let formatter = DateFormatter()
      formatter.dateFormat = "dd.MM.yyyy" // Формат исходной строки
      formatter.locale = Locale(identifier: "ru_RU") // Локализация для корректной работы с русскими датами
      
      if dateString == "NOT_SET" {
        return "Нет расписания."
      }
    
      // Преобразуем строку в дату
      guard let date = formatter.date(from: dateString) else {
          return nil // Если дата некорректна, возвращаем nil
      }

      // Настраиваем форматтер для нужного формата вывода
      formatter.dateFormat = "EE d MMM" // Требуемый формат вывода

      // Форматируем дату и возвращаем строку
      let formattedDate = formatter.string(from: date).capitalized // Делаем первую букву большой для дней недели
      return formattedDate
  }
  
  var body: some View {
    let decoder = JSONDecoder()
    let strangeData = entry?.text.data(using: .utf8)
    let schObj = try? decoder.decode(DataForWidget.self, from: strangeData!)
    // let placeholderForTest = DataForWidget(yesterday: Day(date: "08.08.2024", lessons: [Lesson(name: "Test name", lessonIndex: "10:00 - 12:00", lessonType: "Лабораторная работа", teacher: Teacher(name: "Test teacher name", lec_oid: ""), type: "COMMON")], isEmpty: false, isToday: false), today: Day(date: "09.08.2024", lessons: [Lesson(lessonType: "Практическое занятие", type: "COMMON"), Lesson(lessonType: "Практическое занятие", type: "DINNER"), Lesson(name: "Test name 2", lessonIndex: "10:00 - 14:00", lessonType: "Лекция", teacher: Teacher(name: "Test teacher name 2", lec_oid: ""), type: "COMBINED"), Lesson(name: "Test lesson name very very long to check how this will be shown in widget - is it okay? If not, I have to do something, right? Right... ", lessonIndex: "10:00 - 14:00", lessonType: "test lesson type", cabinet: "Test-100", teacher: Teacher(name: "Test teacher name 2", lec_oid: ""), type: "COMMON"), Lesson(name: "Test name 3", lessonIndex: "10:00 - 14:00", lessonType: "Практическое занятие", cabinet: "Test-100", teacher: Teacher(name: "Test teacher name 3", lec_oid: ""), type: "COMMON")], isEmpty: false, isToday: true), tomorrow: Day(date: "10.08.2024", lessons: [], isEmpty: true, isToday: false))
    
    let userDefaults = UserDefaults.init(suiteName: "group.com.mpeiapp")
    
    let savedDay = userDefaults!.object(forKey: "widgetKeyDay") as? String
    
    VStack(spacing: 8) {
      
      HStack {
        
        Button(intent:
                YesterdayClickHandler()
        ) {
          Text(formatDate(from: schObj?.yesterday.date ?? "") ?? "Нет данных")
            .frame(width: 80, height: 30)
            .background(Color(hex: "#2B2B2B"))
            .foregroundColor(savedDay == "yesterday" ? Color(hex: "#00FF00") : .white)
            .cornerRadius(8)
            .bold()
        }
        Button(intent:
                TodayClickHandler()
        ) {
          Text(formatDate(from: schObj?.today.date ?? "") ?? "Нет данных")
            .frame(width: 80, height: 30)
            .background(Color(hex: "#FF5666"))
            .foregroundColor(savedDay == "today" ? Color(hex: "#6600CC") : .white)
            .cornerRadius(8)
            .bold()
        }
        Button(intent:
                TomorrowClickHandler()
        ) {
          Text(formatDate(from: schObj?.tomorrow.date ?? "") ?? "Нет данных")
            .frame(width: 80, height: 30)
            .background(Color(hex: "#2B2B2B"))
            .foregroundColor(savedDay == "tomorrow" ? Color(hex: "#00FF00") : .white)
            .cornerRadius(8)
            .bold()
        }
      }
      .padding(.bottom, 4)
      
      if savedDay == "yesterday" {
          // Отфильтровываем занятия, исключая те, где type == "DINNER"
        let filteredLessons = schObj?.yesterday.lessons?.filter { $0.type != "DINNER" }
          // Подсчитываем количество отфильтрованных занятий
          let lessonCount = filteredLessons?.count ?? 0

          // Отображаем дату и количество занятий
        Text((formatDate(from: schObj?.yesterday.date ?? "") ?? "") + " Пар - " + lessonCount.formatted())
              .font(.subheadline)
              .padding(.top, 8)
              .foregroundColor(.white)
              .bold()

          // Отображаем отфильтрованные занятия
          ForEach(filteredLessons?.prefix(4) ?? []) { item in
              if (item.lessonType!.contains("абота") || item.lessonType!.contains("кзамен")) {
                  LessonView(item: item, typeColor: Color(hex: "#FF0500"))
              } else if item.lessonType!.contains("екция") {
                  LessonView(item: item, typeColor: Color(hex: "#00FF00"))
              } else {
                  LessonView(item: item, typeColor: Color(hex: "#F7EF02"))
              }
          }
      } else if savedDay == "today" {
          let filteredLessons = schObj?.today.lessons?.filter { $0.type != "DINNER" }
          let lessonCount = filteredLessons?.count ?? 0

        Text((formatDate(from: schObj?.today.date ?? "") ?? "") + " Пар - " + lessonCount.formatted())
              .font(.subheadline)
              .padding(.top, 8)
              .foregroundColor(.white)
              .bold()

          ForEach(filteredLessons?.prefix(4) ?? []) { item in
              if (item.lessonType!.contains("абота") || item.lessonType!.contains("кзамен")) {
                  LessonView(item: item, typeColor: Color(hex: "#FF0500"))
              } else if item.lessonType!.contains("екция") {
                  LessonView(item: item, typeColor: Color(hex: "#00FF00"))
              } else {
                  LessonView(item: item, typeColor: Color(hex: "#F7EF02"))
              }
          }
      } else if savedDay == "tomorrow" {
        let filteredLessons = schObj?.tomorrow.lessons?.filter { $0.type != "DINNER" }
        let lessonCount = filteredLessons?.count ?? 0
        
        Text((formatDate(from: schObj?.tomorrow.date ?? "") ?? "") + " Пар - " + lessonCount.formatted())
          .font(.subheadline)
          .padding(.top, 8)
          .foregroundColor(.white)
          .bold()
        
        ForEach(filteredLessons?.prefix(4) ?? []) { item in
          if (item.lessonType!.contains("абота") || item.lessonType!.contains("кзамен")) {
            LessonView(item: item, typeColor: Color(hex: "#FF0500"))
          } else if item.lessonType!.contains("екция") {
            LessonView(item: item, typeColor: Color(hex: "#00FF00"))
          } else {
            LessonView(item: item, typeColor: Color(hex: "#F7EF02"))
          }
        }
      }
      
    }
    .padding()
    .background(Color.black)
    .cornerRadius(12)
  }
}

@available(iOSApplicationExtension 16.0, *)
struct LessonView: View {
          var item: Lesson
          var typeColor: Color

          var body: some View {
            
              HStack {
                  VStack(alignment: .leading, spacing: 2) {
                    HStack {
                      Text(item.lessonIndex ?? " ? ")
                        .padding(.horizontal, 4)
                        .font(.caption)
                        .foregroundColor(.white)
                        .background(Color(hex: "#464646"))
                        .cornerRadius(5)
                        .bold()
                      Text(item.lessonType ?? " ? ")
                        .font(.caption)
                        .foregroundColor(typeColor)
                        .bold()
                    }
                      Text(item.name ?? " ")
                          .padding(.horizontal, 4)
                          .font(.subheadline)
                          .foregroundColor(.white)
                          .background(Color(hex: "#464646"))
                          .cornerRadius(5)
                          .bold()
                    HStack {
                      Text(item.cabinet ?? " ? ")
                        .font(.caption)
                        .foregroundColor(Color(hex: "#BB86FC"))
                        .bold()
                      Text(item.teacher?.name ?? " ")
                        .padding(.horizontal, 4)
                        .font(.caption)
                        .foregroundColor(.white)
                        .background(Color(hex: "#464646"))
                        .cornerRadius(5)
                        .bold()
                    }
                  }
                  Spacer()
              }
              .padding(.vertical, 4)
              .padding(.horizontal, 8)
              .background(Color(hex: "#2B2B2B"))
              .cornerRadius(8)
              .padding(.horizontal, 4)
          }
      }

@available(iOSApplicationExtension 17.0, *)
struct ScheduleWidget: Widget {
  let kind: String = "ScheduleWidget"
  
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: Provider()) { entry in
      ScheduleWidgetEntryView(entry: entry)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(Color.black, for: .widget)
    }
    .configurationDisplayName("Виджет расписания")
    .description("Виджет расписания MpeiApp от DragonSavA")
    .supportedFamilies([.systemLarge])
  }
}

@available(iOSApplicationExtension 17, *)
struct ScheduleWidget_Previews: PreviewProvider {
  static var previews: some View {
    ScheduleWidgetEntryView(entry: SimpleEntry(date: Date(), configuration: ConfigurationAppIntent(), text: "Предпоказ виджета"))
      .previewContext(WidgetPreviewContext(family: .systemExtraLarge))
  }
}
