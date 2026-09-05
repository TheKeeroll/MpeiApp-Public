import mapPoints from '../src/Screens/Map/MapPoints.json';
import {
  getAdFallbackLocation,
  getAdFallbackLocationCategories,
} from '../src/Ads/AdFallbackLocation';

const hasPointInCategories = (
  location: {lat: number, lon: number},
  categories: readonly string[],
): boolean => mapPoints.some(point => (
  categories.includes(point.category)
  && point.lat === location.lat
  && point.lon === location.lon
));

describe('ad fallback location', () => {
  it.each([
    [9 * 60, ['Корпуса']],
    [12 * 60 + 45, ['Корпуса']],
    [12 * 60 + 46, ['Еда']],
    [13 * 60 + 45, ['Еда']],
    [13 * 60 + 46, ['Корпуса', 'Точки интереса']],
    [19 * 60, ['Корпуса', 'Точки интереса']],
    [19 * 60 + 1, ['Общежития']],
    [8 * 60 + 59, ['Общежития']],
  ])('uses the expected categories at %i Moscow minutes', (moscowMinutes, categories) => {
    expect(getAdFallbackLocationCategories(moscowMinutes)).toEqual(categories);
  });

  it('selects a point from the applicable Moscow-time category', () => {
    const lunchtime = new Date('2026-01-01T09:46:00.000Z');
    const location = getAdFallbackLocation(lunchtime, 0.5);

    expect(hasPointInCategories(location, ['Еда'])).toBe(true);
  });

  it.each([
    [new Date('2026-01-01T11:00:00.000Z'), ['Корпуса', 'Точки интереса']],
    [new Date('2026-01-01T20:00:00.000Z'), ['Общежития']],
  ])('selects a map point from every remaining time-window category', (now, categories) => {
    const location = getAdFallbackLocation(now, 0.5);

    expect(hasPointInCategories(location, categories)).toBe(true);
  });

  it('interprets input time in Moscow rather than the device time zone', () => {
    const morningAtMoscow = new Date('2026-01-01T06:00:00.000Z');
    const location = getAdFallbackLocation(morningAtMoscow, 0);

    expect(hasPointInCategories(location, ['Корпуса'])).toBe(true);
  });
});
