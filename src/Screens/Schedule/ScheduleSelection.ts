import type {BARSSchedule} from '../../API/DataTypes';

export const clampScheduleIndex = (index: number, count: number): number => {
  if (count <= 0 || !Number.isInteger(index) || index < 0) return 0;
  return Math.min(index, count - 1);
};

/** BARS may return -1 when today is absent, or keep an index from an older range. */
export const getInitialScheduleIndex = (schedule: BARSSchedule | null | undefined, today: string): number => {
  if (!schedule?.days.length) return 0;
  const todayIndex = schedule.days.findIndex(day => day.date === today);
  return todayIndex >= 0 ? todayIndex : clampScheduleIndex(schedule.todayIndex, schedule.days.length);
};
