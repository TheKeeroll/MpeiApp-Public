//
//  ScheduleWidget.swift
//  ScheduleWidget
//
//  Created by DragonSavA on 02.08.2024.
//

import WidgetKit
import SwiftUI
import Intents

import os.log

//extension OSLog {
//    private static var subsystem = Bundle.main.bundleIdentifier!

    /// Logs the view cycles like viewDidLoad.
//    static let viewCycle = OSLog(subsystem: subsystem, category: "viewcycle")
//}

struct WidgetData: Decodable {
   var text: String
}

@available(iOSApplicationExtension 17, *)
struct Provider: AppIntentTimelineProvider {

  func snapshot(for configuration: ConfigurationAppIntent, in context: Context) async -> SimpleEntry {
    return SimpleEntry(date: Date(), configuration: configuration, text: "Data goes here")
  }
  
  func timeline(for configuration: ConfigurationAppIntent, in context: Context) async -> Timeline<SimpleEntry> {
    var entry = SimpleEntry(date: Date(), configuration: configuration, text: "Default sign")
    var timeline = Timeline(entries: [entry], policy: .atEnd)
    print("iOS Widget - default timeline")
    let userDefaults = UserDefaults.init(suiteName: "group.com.mpeiapp")
    if userDefaults != nil {
      print("iOS Widget - userDefaults: ")
      print(userDefaults?.object(forKey: "widgetKey"))
      let entryDate = Date()
      if let savedData = userDefaults!.object(forKey: "widgetKey") as? Data {
        print("iOS Widget - Data obtained: " + savedData.description)
        let decoder = JSONDecoder()
        if let parsedData = try? decoder.decode(WidgetData.self, from: savedData) {
          let nextRefresh = Calendar.current.date(byAdding: .minute, value: 5, to: entryDate)!
          entry = SimpleEntry(date: nextRefresh, configuration: configuration, text: parsedData.text)
          timeline = Timeline(entries: [entry], policy: .atEnd)
        } else {
          print("Could not parse data")
        }
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
  
  // func getSnapshot(for configuration: ConfigurationAppIntent, in context: Context, completion: @escaping (SimpleEntry) -> ()) {
  //    let entry = SimpleEntry(date: Date(), configuration: configuration, text: "Data goes here")
  //    completion(entry)
  // }
  
  // func getTimeline(for configuration: ConfigurationAppIntent, in context: Context, completion: @escaping
  // (Timeline<SimpleEntry>) -> Void) {
    //  let userDefaults = UserDefaults.init(suiteName: "group.schedule")
    //  if userDefaults != nil {
      //  let entryDate = Date()
       // if let savedData = userDefaults!.value(forKey: "widgetKey") as? String {
        //  print("iOS Widget - Data obtained: " + savedData)
        //    let decoder = JSONDecoder()
        //    let data = savedData.data(using: .utf8)
        //    if let parsedData = try? decoder.decode(WidgetData.self, from: data!) {
         //       let nextRefresh = Calendar.current.date(byAdding: .minute, value: 5, to: entryDate)!
         //       let entry = SimpleEntry(date: nextRefresh, configuration: configuration, text: parsedData.text)
         //       let timeline = Timeline(entries: [entry], policy: .atEnd)
        //        completion(timeline)
        //    } else {
        //        print("Could not parse data")
       //     }
       // } else {
       //     let nextRefresh = Calendar.current.date(byAdding: .minute, value: 5, to: entryDate)!
      //      let entry = SimpleEntry(date: nextRefresh, configuration: configuration, text: "No data obtained")
    //        let timeline = Timeline(entries: [entry], policy: .atEnd)
   //         completion(timeline)
  //      }
 //     }
 // }
}

@available(iOSApplicationExtension 17, *)
struct SimpleEntry: TimelineEntry {
   let date: Date
      let configuration: ConfigurationAppIntent
      let text: String
}

@available(iOSApplicationExtension 17, *)
struct ScheduleWidgetEntryView : View {
  var entry: Provider.Entry
  
  var body: some View {
    HStack {
      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .center) {
          Image("streak")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 37, height: 37)
          Text(entry.text)
            .foregroundColor(Color(red: 1.00, green: 0.59, blue: 0.00))
            .font(Font.system(size: 21, weight: .bold, design: .rounded))
            .padding(.leading, -8.0)
        }
        .padding(.top, 10.0)
        .frame(maxWidth: .infinity)
        Text("В разработке...")
          .foregroundColor(Color(red: 0.69, green: 0.69, blue: 0.69))
          .font(Font.system(size: 14))
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
