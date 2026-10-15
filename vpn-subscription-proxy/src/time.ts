const MOSCOW_TIME_ZONE = 'Europe/Moscow';

type MoscowDateParts = Readonly<{
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}>;

const moscowFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: MOSCOW_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const getPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number => {
  const value = parts.find(part => part.type === type)?.value;
  if (!value) {
    throw new Error(`Missing Moscow date part: ${type}`);
  }
  return Number.parseInt(value, 10);
};

export const getMoscowDateParts = (now = new Date()): MoscowDateParts => {
  const parts = moscowFormatter.formatToParts(now);
  return {
    year: getPart(parts, 'year'),
    month: getPart(parts, 'month'),
    day: getPart(parts, 'day'),
    hour: getPart(parts, 'hour'),
    minute: getPart(parts, 'minute'),
    second: getPart(parts, 'second'),
  };
};

const pad = (value: number): string => value.toString().padStart(2, '0');

export const getMoscowRequestDate = (now = new Date()): string => {
  const {year, month, day} = getMoscowDateParts(now);
  return `${pad(day)}-${pad(month)}-${year}`;
};
