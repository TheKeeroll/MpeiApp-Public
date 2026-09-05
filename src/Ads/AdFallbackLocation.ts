import mapPoints from '../Screens/Map/MapPoints.json';
import {INITIAL_MAP_REGION, isValidMapCoordinates, type MapCoordinates} from '../Common/MapRegion';

const MOSCOW_TIME_ZONE = 'Europe/Moscow';

const MOSCOW_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: MOSCOW_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const FALLBACK_LOCATION_CATEGORIES = {
  university: ['Корпуса'],
  lunch: ['Еда'],
  afternoon: ['Корпуса', 'Точки интереса'],
  dormitory: ['Общежития'],
} as const;

type FallbackLocationCategory = (
  typeof FALLBACK_LOCATION_CATEGORIES[keyof typeof FALLBACK_LOCATION_CATEGORIES][number]
);

type MapPoint = MapCoordinates & {category: string};

const FALLBACK_CATEGORY_SET = new Set<FallbackLocationCategory>([
  ...FALLBACK_LOCATION_CATEGORIES.university,
  ...FALLBACK_LOCATION_CATEGORIES.lunch,
  ...FALLBACK_LOCATION_CATEGORIES.afternoon,
  ...FALLBACK_LOCATION_CATEGORIES.dormitory,
]);

const isFallbackLocationCategory = (category: string): category is FallbackLocationCategory => (
  FALLBACK_CATEGORY_SET.has(category as FallbackLocationCategory)
);

const FALLBACK_MAP_POINTS: Array<MapPoint & {category: FallbackLocationCategory}> = (
  mapPoints as MapPoint[]
).filter((point): point is MapPoint & {category: FallbackLocationCategory} => (
  isValidMapCoordinates(point) && isFallbackLocationCategory(point.category)
));

const toMoscowMinutes = (now: Date): number => {
  const parts = MOSCOW_TIME_FORMATTER.formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  return hour * 60 + minute;
};

export const getAdFallbackLocationCategories = (
  moscowMinutes: number,
): readonly FallbackLocationCategory[] => {
  if (moscowMinutes >= 9 * 60 && moscowMinutes <= 12 * 60 + 45) {
    return FALLBACK_LOCATION_CATEGORIES.university;
  }

  if (moscowMinutes >= 12 * 60 + 46 && moscowMinutes <= 13 * 60 + 45) {
    return FALLBACK_LOCATION_CATEGORIES.lunch;
  }

  if (moscowMinutes >= 13 * 60 + 46 && moscowMinutes <= 19 * 60) {
    return FALLBACK_LOCATION_CATEGORIES.afternoon;
  }

  return FALLBACK_LOCATION_CATEGORIES.dormitory;
};

const getRandomIndex = (length: number, random: number): number => {
  const normalizedRandom = Number.isFinite(random)
    ? Math.min(Math.max(random, 0), 1 - Number.EPSILON)
    : 0;
  return Math.floor(normalizedRandom * length);
};

/**
 * Returns an approximate non-personal location based on Moscow time. The point
 * is randomly selected from the specified categories in MapPoints.json.
 */
export const getAdFallbackLocation = (
  now = new Date(),
  random = Math.random(),
): MapCoordinates => {
  const categories = getAdFallbackLocationCategories(toMoscowMinutes(now));
  const candidates = FALLBACK_MAP_POINTS.filter(point => categories.includes(point.category));

  if (candidates.length === 0) {
    return INITIAL_MAP_REGION;
  }

  const point = candidates[getRandomIndex(candidates.length, random)];
  return {lat: point.lat, lon: point.lon};
};
