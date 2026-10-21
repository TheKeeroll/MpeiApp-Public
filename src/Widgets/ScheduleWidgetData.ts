import type {BARSSchedule} from '../API/DataTypes';
import {getMoscowDate} from '../Common/MoscowDate';

export interface ScheduleWidgetBridge {
  setSchedule(json: string): Promise<void>;
  clearSchedule(): Promise<void>;
}

function widgetDates(now: Date): string[] {
  const [day, month, year] = getMoscowDate(now).split('.').map(Number);
  const monday = new Date(Date.UTC(year!, month! - 1, day));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return Array.from({length: 14}, (_, offset) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + offset);
    return `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`;
  });
}

// The same two-week payload for both platforms; no authentication/account IDs.
export function serializeScheduleWidget(schedule: BARSSchedule, now = new Date()): string {
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  const days = new Map((Array.isArray(schedule.days) ? schedule.days : [])
    .filter(day => day && typeof day.date === 'string').map(day => [day.date, day]));
  return JSON.stringify({
    schemaVersion: 1,
    days: widgetDates(now).map(date => {
      const day = days.get(date);
      return {
        date,
        isLoaded: !!day && Array.isArray(day.lessons),
        lessons: (Array.isArray(day?.lessons) ? day.lessons : []).filter(Boolean).map(lesson => ({
          name: text(lesson.name),
          lessonIndex: String(lesson.lessonIndex ?? ''),
          lessonType: text(lesson.lessonType),
          cabinet: text(lesson.cabinet),
          teacher: {name: text(lesson.teacher?.name)},
          type: lesson.type,
        })),
      };
    }),
  });
}

/** Do not let an older write restore another account's schedule after logout. */
export function createScheduleWidgetPublisher(bridge: ScheduleWidgetBridge) {
  let previous: string | null | undefined;
  let queue: Promise<void> = Promise.resolve();
  return {
    publish(json: string | null, force = false): Promise<void> {
      if (!force && previous === json) return queue;
      previous = json;
      queue = queue.catch(() => {}).then(() => json === null ? bridge.clearSchedule() : bridge.setSchedule(json)).catch(error => {
        if (previous === json) previous = undefined;
        throw error;
      });
      return queue;
    },
  };
}
