// Preserve the tested iOS interface while sharing its data contract with Android.
export {
  serializeScheduleWidget as serializeIOSSchedule,
  createScheduleWidgetPublisher as createIOSWidgetPublisher,
  type ScheduleWidgetBridge as IOSScheduleWidgetBridge,
} from './ScheduleWidgetData';
