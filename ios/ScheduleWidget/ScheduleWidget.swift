//
//  ScheduleWidget.swift
//  ScheduleWidget
//
//  Created by DragonSavA on 02.08.2024.
//

import WidgetKit
import SwiftUI
import Intents


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
  var body: some View {
    //var schObj = entry?.text.toJSON() as? [String:AnyObject]?
    let decoder = JSONDecoder()
    let strangeData = entry?.text.data(using: .utf8)
    var schObj = try? decoder.decode(DataForWidget.self, from: strangeData!)
    var placeholderForTest = DataForWidget(yesterday: Day(date: "", lessons: [Lesson(name: "Test name", lessonIndex: "10:00 - 12:00", teacher: Teacher(name: "Test teacher name", lec_oid: "")), Lesson()], isEmpty: false, isToday: false), today: Day(date: "", lessons: [Lesson(),Lesson(name: "Test name 2", lessonIndex: "10:00 - 14:00", teacher: Teacher(name: "Test teacher name 2", lec_oid: ""))], isEmpty: false, isToday: true), tomorrow: Day(date: "", lessons: [], isEmpty: true, isToday: false))
    //var selectedDay = schObj?.today
    var selectedDay = placeholderForTest.today
    VStack {
      HStack {
        Button(action: {
          // Action for yesterday's schedule
          //selectedDay = schObj?.yesterday
          selectedDay = placeholderForTest.yesterday
        }) {
          Text("Вчера")
            .padding()
            .background(Color.gray)
            .foregroundColor(.white)
            .cornerRadius(8)
        }
        Button(action: {
          // Action for today's schedule
          //selectedDay = schObj?.today
          selectedDay = placeholderForTest.today
        }) {
          Text("Сегодня")
            .padding()
            .background(Color.pink)
            .foregroundColor(.white)
            .cornerRadius(8)
        }
        Button(action: {
          // Action for tomorrow's schedule
          //selectedDay = schObj?.tomorrow
          selectedDay = placeholderForTest.tomorrow
        }) {
          Text("Завтра")
            .padding()
            .background(Color.gray)
            .foregroundColor(.white)
            .cornerRadius(8)
        }
      }
      
      Text("День и кол-во пар - в разработке...")
        .font(.headline)
        .padding(.top, 8)
      if selectedDay.isEmpty == false {
        ForEach(selectedDay.lessons ?? []) { item in
          HStack {
            VStack(alignment: .leading) {
              Text(item.lessonIndex ?? " ")
                .font(.subheadline)
                .foregroundColor(.secondary)
              Text(item.name ?? " ")
                .font(.headline)
                .foregroundColor(.white)
              Text(item.teacher?.name ?? " ")
                .font(.subheadline)
                .foregroundColor(.gray)
            }
            Spacer()
          }
          .padding(.vertical, 4)
          .padding(.horizontal)
          .background(Color.black.opacity(0.1))
          .cornerRadius(8)
          .padding(.horizontal)
        }
      }
      
    }
    .padding()
  }
}

@available(iOSApplicationExtension 17.0, *)
struct ScheduleWidget: Widget {
  let kind: String = "ScheduleWidget"
  
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: ConfigurationAppIntent.self, provider: Provider()) { entry in
      ScheduleWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("My Widget")
    .description("This is DragonSavA widget.")
  }
}

@available(iOSApplicationExtension 17, *)
struct ScheduleWidget_Previews: PreviewProvider {
  static var previews: some View {
    ScheduleWidgetEntryView(entry: SimpleEntry(date: Date(), configuration: ConfigurationAppIntent(), text: "Widget preview"))
      .previewContext(WidgetPreviewContext(family: .systemSmall))
  }
}
