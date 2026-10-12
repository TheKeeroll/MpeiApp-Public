import {getMoscowDate, isNonTodayScheduleDate, millisecondsUntilMoscowMidnight} from '../src/Common/MoscowDate';
import {initialDragoNetPromoState, isDragoNetPromoAllowed, shouldShowDragoNetPromo} from '../src/Vpn/DragoNetPromoPolicy';
import {DragoNetPromoService} from '../src/Vpn/DragoNetPromoService';
import {DragoNetPromoImpressionTracker, getVisibleAreaFraction, isDragoNetPromoRouteVisible} from '../src/Vpn/DragoNetPromoVisibility';

const storage = () => {
  const values = new Map<string, string>();
  return {values, getString: (key: string) => values.get(key), set: (key: string, value: string) => { values.set(key, value); }};
};

describe('DragoNet device-wide promotion cycle', () => {
  it('uses exact 50% and 15% boundaries and rejects invalid random values', () => {
    const primary = initialDragoNetPromoState();
    const reduced = {...primary, phase: 'reduced' as const};
    expect(shouldShowDragoNetPromo(primary, 0.499)).toBe(true);
    expect(shouldShowDragoNetPromo(primary, 0.5)).toBe(false);
    expect(shouldShowDragoNetPromo(reduced, 0.149)).toBe(true);
    expect(shouldShowDragoNetPromo(reduced, 0.15)).toBe(false);
    for (const value of [NaN, Infinity, -0.1, 1]) expect(shouldShowDragoNetPromo(primary, value)).toBe(false);
  });

  it('transitions after 10 actual impressions, then 25 more, and repeats after restart', () => {
    const data = storage();
    const service = new DragoNetPromoService(data);
    const miss = service.createOpportunity(0.9);
    expect(service.recordImpression(miss)).toBe(false);
    const unviewed = service.createOpportunity(0);
    expect(service.getState().impressions).toBe(0);
    for (let index = 0; index < 10; index++) service.recordImpression(service.createOpportunity(0));
    expect(service.getState()).toEqual({version: 1, phase: 'reduced', impressions: 0});
    expect(unviewed.selected).toBe(true);
    expect(service.createOpportunity(0.2).selected).toBe(false);
    const restored = new DragoNetPromoService(data);
    for (let index = 0; index < 15; index++) restored.recordImpression(restored.createOpportunity(0));
    expect(restored.getState()).toEqual({version: 1, phase: 'reduced', impressions: 15});
    for (let index = 0; index < 10; index++) restored.recordImpression(restored.createOpportunity(0));
    expect(restored.getState()).toEqual({version: 1, phase: 'primary', impressions: 0});
    expect(restored.createOpportunity(0.2).selected).toBe(true);
  });

  it('deduplicates one opportunity and preserves increments from independent consumers', () => {
    const data = storage();
    const first = new DragoNetPromoService(data);
    const second = new DragoNetPromoService(data);
    const opportunityA = first.createOpportunity(0);
    const opportunityB = second.createOpportunity(0);
    expect(first.recordImpression(opportunityA)).toBe(true);
    expect(second.recordImpression(opportunityB)).toBe(true);
    expect(second.recordImpression(opportunityA)).toBe(false);
    expect(new DragoNetPromoService(data).getState().impressions).toBe(2);
  });

  it.each([
    '{broken', '{"version":2,"phase":"reduced","impressions":1}',
    '{"version":1,"phase":"other","impressions":1}',
    '{"version":1,"phase":"primary","impressions":10}',
    '{"version":1,"phase":"reduced","impressions":25}',
    '{"version":1,"phase":"primary","impressions":-1}',
  ])('repairs malformed saved data: %s', raw => {
    const data = storage();
    data.values.set('cycle', raw);
    expect(new DragoNetPromoService(data).getState()).toEqual(initialDragoNetPromoState());
    expect(JSON.parse(data.values.get('cycle')!)).toEqual(initialDragoNetPromoState());
  });

  it('hides promotions for ACTIVE/GRACE access or purchased ad removal', () => {
    expect(isDragoNetPromoAllowed(false, false)).toBe(true);
    expect(isDragoNetPromoAllowed(true, false)).toBe(false);
    expect(isDragoNetPromoAllowed(false, true)).toBe(false);
    expect(isDragoNetPromoAllowed(true, true)).toBe(false);
  });
});

describe('DragoNet actual impressions', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('uses visible area on both axes and rejects zero or invalid geometry', () => {
    const viewport = {x: 0, y: 100, width: 200, height: 400};
    expect(getVisibleAreaFraction({x: 0, y: 0, width: 200, height: 200}, viewport)).toBe(0.5);
    expect(getVisibleAreaFraction({x: 100, y: 0, width: 200, height: 200}, viewport)).toBe(0.25);
    expect(getVisibleAreaFraction({x: 0, y: 100, width: 200, height: 200}, viewport)).toBe(1);
    expect(getVisibleAreaFraction({x: 0, y: 600, width: 200, height: 200}, viewport)).toBe(0);
    expect(getVisibleAreaFraction({x: 0, y: 100, width: 0, height: 200}, viewport)).toBe(0);
    expect(getVisibleAreaFraction({x: NaN, y: 100, width: 200, height: 200}, viewport)).toBe(0);
  });

  it('counts at 500ms, once, including after footer remount', () => {
    const service = new DragoNetPromoService(storage());
    const opportunity = service.createOpportunity(0);
    const tracker = new DragoNetPromoImpressionTracker(service, opportunity, () => true);
    tracker.updateVisibility(0.5);
    jest.advanceTimersByTime(499);
    expect(service.getState().impressions).toBe(0);
    tracker.updateVisibility(0.8);
    jest.advanceTimersByTime(1);
    expect(service.getState().impressions).toBe(1);
    tracker.updateVisibility(0);
    tracker.updateVisibility(1);
    jest.advanceTimersByTime(1000);
    tracker.dispose();
    const remounted = new DragoNetPromoImpressionTracker(service, opportunity, () => true);
    remounted.updateVisibility(1);
    jest.advanceTimersByTime(500);
    expect(service.getState().impressions).toBe(1);
    remounted.dispose();
  });

  it('requires continuous visibility and cancels on background, blur or removal', () => {
    const service = new DragoNetPromoService(storage());
    let active = true;
    const tracker = new DragoNetPromoImpressionTracker(service, service.createOpportunity(0), () => active);
    tracker.updateVisibility(0.7);
    jest.advanceTimersByTime(300);
    tracker.updateVisibility(0.49);
    tracker.updateVisibility(0.7);
    jest.advanceTimersByTime(300);
    expect(service.getState().impressions).toBe(0);
    active = false;
    tracker.updateVisibility(0.7);
    jest.advanceTimersByTime(500);
    expect(service.getState().impressions).toBe(0);
    active = true;
    tracker.updateVisibility(0.7);
    jest.advanceTimersByTime(499);
    tracker.dispose();
    tracker.updateVisibility(1);
    jest.advanceTimersByTime(500);
    expect(service.getState().impressions).toBe(0);
  });

  it('rechecks focus/app activity at the deadline and never counts an unselected opportunity', () => {
    const service = new DragoNetPromoService(storage());
    let active = true;
    const tracker = new DragoNetPromoImpressionTracker(service, service.createOpportunity(0), () => active);
    tracker.updateVisibility(1);
    active = false;
    jest.advanceTimersByTime(500);
    expect(service.getState().impressions).toBe(0);
    const missed = new DragoNetPromoImpressionTracker(service, service.createOpportunity(0.9), () => true);
    missed.updateVisibility(1);
    jest.advanceTimersByTime(500);
    expect(service.getState().impressions).toBe(0);
    tracker.dispose();
    missed.dispose();
  });

  it('waits for the latest native measurement at the deadline instead of counting stale visibility', () => {
    const service = new DragoNetPromoService(storage());
    const tracker = new DragoNetPromoImpressionTracker(service, service.createOpportunity(0), () => true);
    tracker.updateVisibility(1);
    jest.advanceTimersByTime(450);
    tracker.beginMeasurement();
    jest.advanceTimersByTime(100);
    expect(service.getState().impressions).toBe(0);
    tracker.updateVisibility(0.3);
    tracker.updateVisibility(1);
    jest.advanceTimersByTime(450);
    tracker.beginMeasurement();
    jest.advanceTimersByTime(100);
    expect(service.getState().impressions).toBe(0);
    tracker.updateVisibility(0.8);
    expect(service.getState().impressions).toBe(1);
    tracker.dispose();
  });

  it('excludes a screen covered by an open Drawer and resumes after it closes', () => {
    expect(isDragoNetPromoRouteVisible({type: 'drawer', default: 'closed', history: [{type: 'drawer', status: 'open'}]})).toBe(false);
    expect(isDragoNetPromoRouteVisible({type: 'drawer', default: 'open', history: [{type: 'drawer', status: 'closed'}]})).toBe(true);
    expect(isDragoNetPromoRouteVisible({type: 'stack'})).toBe(true);
  });
});

describe('Moscow schedule date', () => {
  it('excludes today by date across UTC/Moscow midnight and calendar year boundaries', () => {
    expect(getMoscowDate(new Date('2026-10-12T20:59:59Z'))).toBe('12.10.2026');
    expect(getMoscowDate(new Date('2026-10-12T21:00:00Z'))).toBe('13.10.2026');
    expect(getMoscowDate(new Date('2026-12-31T21:00:00Z'))).toBe('01.01.2027');
    expect(millisecondsUntilMoscowMidnight(new Date('2026-10-12T20:59:59Z'))).toBe(1000);
    expect(isNonTodayScheduleDate('13.10.2026', '13.10.2026')).toBe(false);
    expect(isNonTodayScheduleDate('12.10.2026', '13.10.2026')).toBe(true);
    for (const date of [undefined, '', '31.02.2026', '2026-10-13']) expect(isNonTodayScheduleDate(date, '13.10.2026')).toBe(false);
  });
});
