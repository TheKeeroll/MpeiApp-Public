import type {BARSSchedule} from '../src/API/DataTypes';
import {clampScheduleIndex, getInitialScheduleIndex} from '../src/Screens/Schedule/ScheduleSelection';

describe('schedule date bounds', () => {
  it.each([[-1, 113, 0], [999, 113, 112], [NaN, 113, 0], [1.5, 113, 0], [4, 0, 0]])(
    'normalizes index %s for %s dates to %s', (index, count, expected) => {
      expect(clampScheduleIndex(index, count)).toBe(expected);
    },
  );
  const schedule: BARSSchedule = {todayIndex: -1, days: ['11.10.2026', '12.10.2026'].map(date => ({
    date, lessons: [], isEmpty: false, isToday: false,
  }))};
  it('selects the actual Moscow date before mounting, ignoring -1 and stale isToday flags', () => {
    expect(getInitialScheduleIndex(schedule, '12.10.2026')).toBe(1);
  });
  it('falls back safely when today is absent and the cached index is negative or out of range', () => {
    expect(getInitialScheduleIndex(schedule, '13.10.2026')).toBe(0);
    expect(getInitialScheduleIndex({...schedule, todayIndex: 999}, '13.10.2026')).toBe(1);
  });
  it('keeps a valid cached date when today is absent', () => {
    expect(getInitialScheduleIndex({...schedule, todayIndex: 1}, '13.10.2026')).toBe(1);
  });
  it('handles unavailable and empty schedules before data arrives', () => {
    expect(getInitialScheduleIndex(undefined, '13.10.2026')).toBe(0);
    expect(getInitialScheduleIndex({days: [], todayIndex: -1}, '13.10.2026')).toBe(0);
  });
});
