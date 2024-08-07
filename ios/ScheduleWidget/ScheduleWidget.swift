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
      print("iOS Widget - userDefaults: ")
      print(userDefaults?.object(forKey: "widgetKey") ?? "failed to obtain")
      let entryDate = Date()
      if let savedData = userDefaults!.object(forKey: "widgetKey") as? String {
        print("iOS Widget - Data obtained: " + savedData)
        //let testSavedData = userDefaults!.object(forKey: "widgetKey") as? Data ?? Data()
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
  
  func yesterdayClick(clickedDay: String) -> Bool {
    if clickedDay == "yesterday"{
      return true
    } else {
      return false
    }
  }
  
  func todayClick(clickedDay: String) -> Bool {
    if clickedDay == "today"{
      return true
    } else {
      return false
    }
  }
  
  func tomorrowClick(clickedDay: String) -> Bool {
    if clickedDay == "tomorrow"{
      return true
    } else {
      return false
    }
  }
  
  func formatDate(offsetBy days: Int) -> String {
          let date = calendar.date(byAdding: .day, value: days, to: Date())!
          formatter.dateFormat = "EE d MMM"
          formatter.locale = Locale(identifier: "ru_RU")
          let formattedDate = formatter.string(from: date)
          return formattedDate
      }
  
  var body: some View {
    //var schObj = entry?.text.toJSON() as? [String:AnyObject]?
    let decoder = JSONDecoder()
    let strangeData = entry?.text.data(using: .utf8)
    var schObj = try? decoder.decode(DataForWidget.self, from: strangeData!)
    var placeholderForTest = DataForWidget(yesterday: Day(date: "", lessons: [Lesson(name: "Test name", lessonIndex: "10:00 - 12:00", lessonType: "Лабораторная работа", teacher: Teacher(name: "Test teacher name", lec_oid: ""))], isEmpty: false, isToday: false), today: Day(date: "", lessons: [Lesson(lessonType: "Практическое занятие"),Lesson(name: "Test name 2", lessonIndex: "10:00 - 14:00", lessonType: "Лекция", teacher: Teacher(name: "Test teacher name 2", lec_oid: "")), Lesson(lessonType: "Экзамен"), Lesson(name: "Test lesson name very very long to check how this will be shown in widget - is it okay? If not, I have to do something, right? Right... ", lessonIndex: "10:00 - 14:00", lessonType: "test lesson type", cabinet: "Test-100", teacher: Teacher(name: "Test teacher name 2", lec_oid: "")),Lesson(name: "Test name 3", lessonIndex: "10:00 - 14:00", lessonType: "Практическое занятие", cabinet: "Test-100", teacher: Teacher(name: "Test teacher name 3", lec_oid: ""))], isEmpty: false, isToday: true), tomorrow: Day(date: "", lessons: [], isEmpty: true, isToday: false))
    //var selectedDay = schObj?.today
    
    let userDefaults = UserDefaults.init(suiteName: "group.com.mpeiapp")
    
    let savedDay = userDefaults!.object(forKey: "widgetKeyDay") as? String
    
    VStack(spacing: 8) {
      
      HStack {
        
        Button(intent:
                YesterdayClickHandler()
        ) {
          Text(formatDate(offsetBy: -1))
            .padding(4)
            .background(Color(hex: "#2B2B2B"))
            .foregroundColor(.white)
            .cornerRadius(8)
            .bold()
        }
        Button(intent:
                TodayClickHandler()
        ) {
          Text(formatDate(offsetBy: 0))
            .padding(4)
            .background(Color(hex: "#FF5666"))
            .foregroundColor(Color(hex: "#6600CC"))
            .cornerRadius(8)
            .bold()
        }
        Button(intent:
                TomorrowClickHandler()
        ) {
          Text(formatDate(offsetBy: 1))
            .padding(4)
            .background(Color(hex: "#2B2B2B"))
            .foregroundColor(.white)
            .cornerRadius(8)
            .bold()
        }
      }
      .padding(.bottom, 4)
      
      if savedDay == "yesterday" {
        Text(formatDate(offsetBy: -1) + " Пар - " + (placeholderForTest.yesterday.lessons?.count.formatted() ?? "нет!"))
          .font(.subheadline)
          .padding(.top, 8)
          .foregroundColor(.white)
          .bold()
        ForEach(placeholderForTest.yesterday.lessons?.prefix(4) ?? []) { item in
          if (item.lessonType!.contains("абота") || item.lessonType!.contains("замен")) {
            LessonView(item: item, typeColor: Color.red)
          } else if item.lessonType!.contains("екция") {
            LessonView(item: item, typeColor: Color.green)
          } else {
            LessonView(item: item, typeColor: Color.yellow)
          }
        }
      } else if savedDay == "today" {
        Text(formatDate(offsetBy: 0) + " Пар - " + (placeholderForTest.today.lessons?.count.formatted() ?? "нет!"))
          .font(.subheadline)
          .padding(.top, 8)
          .foregroundColor(.white)
          .bold()
        ForEach(placeholderForTest.today.lessons?.prefix(4) ?? []) { item in
          if (item.lessonType!.contains("абота") || item.lessonType!.contains("кзамен")) {
            LessonView(item: item, typeColor: Color(hex: "#FF0500"))
          } else if item.lessonType!.contains("екция") {
            LessonView(item: item, typeColor: Color(hex: "#00FF00"))
          } else {
            LessonView(item: item, typeColor: Color(hex: "#F7EF02"))
          }
        }
      } else if savedDay == "tomorrow" {
        Text(formatDate(offsetBy: 1) + " Пар - " + (placeholderForTest.tomorrow.lessons?.count.formatted() ?? "нет!"))
          .font(.subheadline)
          .padding(.top, 8)
          .foregroundColor(.white)
          .bold()
        ForEach(placeholderForTest.tomorrow.lessons?.prefix(4) ?? []) { item in
          if (item.lessonType!.contains("абота") || item.lessonType!.contains("кзамен")) {
            LessonView(item: item, typeColor: Color.red)
          } else if item.lessonType!.contains("екция") {
            LessonView(item: item, typeColor: Color(red: 0, green: 255, blue:0))
          } else {
            LessonView(item: item, typeColor: Color.yellow)
          }
        }
      }
      
    }
    .padding()
    .background(Color.black)
    .cornerRadius(12)
  }
}

      struct LessonView: View {
          var item: Lesson
          var typeColor: Color

          var body: some View {
            
              HStack {
                  VStack(alignment: .leading, spacing: 2) {
                    HStack {
                      Text(item.lessonIndex ?? " ? ")
                        .font(.caption)
                        .foregroundColor(.white)
                        .bold()
                      Text(item.lessonType ?? " ? ")
                        .font(.caption)
                        .foregroundColor(typeColor)
                        .bold()
                    }
                      Text(item.name ?? " ")
                          .font(.subheadline)
                          .foregroundColor(.white)
                          .bold()
                    HStack {
                      Text(item.cabinet ?? " ? ")
                        .font(.caption)
                        .foregroundColor(Color(hex: "#BB86FC"))
                        .bold()
                      Text(item.teacher?.name ?? " ")
                        .font(.caption)
                        .foregroundColor(.white)
                        .bold()
                    }
                  }
                  Spacer()
              }
              .padding(.vertical, 4)
              .padding(.horizontal, 8)
              .background(Color.black.opacity(0.2))
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
