import Foundation
import React
import WidgetKit

@objc(ScheduleWidgetBridge)
final class ScheduleWidgetBridge: NSObject {
    @objc static func requiresMainQueueSetup() -> Bool { false }

    private func sharedDefaults() -> UserDefaults? {
        guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: ScheduleWidgetContract.appGroup) != nil else { return nil }
        return UserDefaults(suiteName: ScheduleWidgetContract.appGroup)
    }

    @objc(setSchedule:resolver:rejecter:)
    func setSchedule(_ json: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        guard WidgetSchedulePayload.decode(json) != nil else {
            reject("E_WIDGET_DATA", "Invalid schedule widget payload", nil)
            return
        }
        guard let defaults = sharedDefaults() else {
            reject("E_WIDGET_APP_GROUP", "Schedule widget App Group is unavailable; check signing capabilities", nil)
            return
        }
        defaults.set(json, forKey: ScheduleWidgetContract.dataKey)
        let day = WidgetDayChoice.restored(defaults.string(forKey: ScheduleWidgetContract.dayKey))
        defaults.set(day.rawValue, forKey: ScheduleWidgetContract.dayKey)
        WidgetCenter.shared.reloadTimelines(ofKind: ScheduleWidgetContract.kind)
        resolve(nil)
    }

    @objc(clearSchedule:rejecter:)
    func clearSchedule(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        guard let defaults = sharedDefaults() else {
            reject("E_WIDGET_APP_GROUP", "Schedule widget App Group is unavailable; check signing capabilities", nil)
            return
        }
        defaults.removeObject(forKey: ScheduleWidgetContract.dataKey)
        defaults.removeObject(forKey: ScheduleWidgetContract.dayKey)
        WidgetCenter.shared.reloadTimelines(ofKind: ScheduleWidgetContract.kind)
        resolve(nil)
    }
}
