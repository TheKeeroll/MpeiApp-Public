//
//  AppIntent.swift
//  ScheduleWidget
//
//  Created by DragonSavA on 02.08.2024.
//

import WidgetKit
import AppIntents


@available(iOSApplicationExtension 17.0, *)
struct ConfigurationAppIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Configuration"
    static var description = IntentDescription("This is an example widget.")

    // An example configurable parameter.
    @Parameter(title: "Favorite Emoji", default: "😃")
    var favoriteEmoji: String
}

@available(iOS 16.0, macOS 13.0, watchOS 9.0, tvOS 16.0, *)
struct YesterdayClickHandler: AppIntent {
  
  static var title: LocalizedStringResource = "Emoji Ranger SuperCharger"
  static var description = IntentDescription("All heroes get instant 100% health.")
  
  func perform() async throws -> some IntentResult {
    let targetDay: String = "yesterday"
    let userDefaults = UserDefaults.init(suiteName: "group.com.mpeiapp")
    if userDefaults != nil {
      print("iOS Widget - previous userDefaultsDay: ")
      let savedData = userDefaults!.object(forKey: "widgetKeyDay") as? String
      print(savedData ?? "failed to obtain")
      userDefaults?.set(targetDay, forKey: "widgetKeyDay")
      print("iOS Widget - updated userDefaultsDay: " + targetDay)
    }
    return .result()
  }
}

@available(iOS 16.0, macOS 13.0, watchOS 9.0, tvOS 16.0, *)
struct TodayClickHandler: AppIntent {
  
  static var title: LocalizedStringResource = "Emoji Ranger SuperCharger"
  static var description = IntentDescription("All heroes get instant 100% health.")
  
  func perform() async throws -> some IntentResult {
    let targetDay: String = "today"
    let userDefaults = UserDefaults.init(suiteName: "group.com.mpeiapp")
    if userDefaults != nil {
      print("iOS Widget - previous userDefaultsDay: ")
      let savedData = userDefaults!.object(forKey: "widgetKeyDay") as? String
      print(savedData ?? "failed to obtain")
      userDefaults?.set(targetDay, forKey: "widgetKeyDay")
      print("iOS Widget - updated userDefaultsDay: " + targetDay)
    }
    return .result()
  }
}

@available(iOS 16.0, macOS 13.0, watchOS 9.0, tvOS 16.0, *)
struct TomorrowClickHandler: AppIntent {
  
  static var title: LocalizedStringResource = "Emoji Ranger SuperCharger"
  static var description = IntentDescription("All heroes get instant 100% health.")
  
  func perform() async throws -> some IntentResult {
    let targetDay: String = "tomorrow"
    let userDefaults = UserDefaults.init(suiteName: "group.com.mpeiapp")
    if userDefaults != nil {
      print("iOS Widget - previous userDefaultsDay: ")
      let savedData = userDefaults!.object(forKey: "widgetKeyDay") as? String
      print(savedData ?? "failed to obtain")
      userDefaults?.set(targetDay, forKey: "widgetKeyDay")
      print("iOS Widget - updated userDefaultsDay: " + targetDay)
    }
    return .result()
  }
}
