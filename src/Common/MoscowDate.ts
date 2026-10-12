import React from 'react';
import {AppState} from 'react-native';

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const getMoscowDate = (now = new Date()): string => {
  const local = new Date(now.getTime() + MOSCOW_OFFSET_MS);
  return `${String(local.getUTCDate()).padStart(2, '0')}.${String(local.getUTCMonth() + 1).padStart(2, '0')}.${local.getUTCFullYear()}`;
};

export const millisecondsUntilMoscowMidnight = (now = new Date()): number => (
  DAY_MS - ((now.getTime() + MOSCOW_OFFSET_MS) % DAY_MS + DAY_MS) % DAY_MS
);

export const isNonTodayScheduleDate = (date: string | undefined, today: string): boolean => {
  if (!date || !/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return false;
  const [day, month, year] = date.split('.').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));
  return parsed.getUTCDate() === day && parsed.getUTCMonth() === month! - 1 && parsed.getUTCFullYear() === year && date !== today;
};

export const useMoscowDate = (): string => {
  const [date, setDate] = React.useState(getMoscowDate);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      setDate(getMoscowDate());
      timer = setTimeout(refresh, millisecondsUntilMoscowMidnight() + 25);
    };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return date;
};
