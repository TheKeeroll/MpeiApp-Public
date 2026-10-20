#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ScheduleWidgetBridge, NSObject)
RCT_EXTERN_METHOD(setSchedule:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearSchedule:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
