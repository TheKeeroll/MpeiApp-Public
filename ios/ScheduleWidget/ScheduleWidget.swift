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

struct Lesson: Decodable {
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
    let schObj = try? decoder.decode(DataForWidget.self, from: strangeData!)
    HStack {
      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .center) {
         // Image("streak")
         //   .resizable()
         //   .aspectRatio(contentMode: .fit)
         //   .frame(width: 37, height: 37)
          Text(schObj?.today.date as? String ?? " no data provided")
            .foregroundColor(Color(red: 1.00, green: 0.59, blue: 0.00))
            .font(Font.system(size: 18, weight: .bold, design: .rounded))
            .padding(.leading, -8.0)
          Text(schObj?.yesterday.date as? String ?? " no data provided")
            .foregroundColor(Color(red: 1.00, green: 0.59, blue: 0.00))
            .font(Font.system(size: 21, weight: .bold, design: .rounded))
            .padding(.leading, -8.0)
          if (schObj?.tomorrow.isEmpty == false) {
            Text(schObj?.tomorrow.lessons?[0].teacher as? String ?? " no data provided")
              .foregroundColor(Color(red: 1.00, green: 0.59, blue: 0.00))
              .font(Font.system(size: 18, weight: .bold, design: .rounded))
            .padding(.leading, -8.0)        }
        }
        .padding(.top, 10.0)
        .frame(maxWidth: .infinity)
        Text("В разработке...")
          .foregroundColor(Color(red: 0.69, green: 0.69, blue: 0.69))
          .font(Font.system(size: 16))
          .frame(maxWidth: .infinity)
       // Image("duo")
       //   .renderingMode(.original)
       //   .resizable()
       //   .aspectRatio(contentMode: .fit)
       //   .frame(maxWidth: .infinity)
        
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
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
