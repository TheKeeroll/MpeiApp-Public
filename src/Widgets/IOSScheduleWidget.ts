import type {BARSSchedule} from '../API/DataTypes';

export interface IOSScheduleWidgetBridge {
  setSchedule(json: string): Promise<void>;
  clearSchedule(): Promise<void>;
}

// Keep only the student's schedule fields used by the extension, never auth data.
export function serializeIOSSchedule(schedule: BARSSchedule): string {
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  return JSON.stringify({
    schemaVersion: 1,
    days: (Array.isArray(schedule.days) ? schedule.days : []).filter(day => day && typeof day.date === 'string').map(day => ({
      date: day.date,
      lessons: (Array.isArray(day.lessons) ? day.lessons : []).filter(Boolean).map(lesson => ({
        name: text(lesson.name),
        lessonIndex: String(lesson.lessonIndex ?? ''),
        lessonType: text(lesson.lessonType),
        cabinet: text(lesson.cabinet),
        teacher: {name: text(lesson.teacher?.name)},
        type: lesson.type,
      })),
    })),
  });
}

/** Serialize native writes so logout/another account cannot be overtaken by an old update. */
export function createIOSWidgetPublisher(bridge: IOSScheduleWidgetBridge) {
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
