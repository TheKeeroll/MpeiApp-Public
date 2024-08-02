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
