import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AppState, NativeModules, Platform} from 'react-native';
import {useSelector} from 'react-redux';
import type {BARSSchedule} from '../src/API/DataTypes';
import type {LoginState} from '../src/API/BARS';
import {createIOSWidgetPublisher, serializeIOSSchedule} from '../src/Widgets/IOSScheduleWidget';
import {useIOSScheduleWidgetSync} from '../src/Widgets/useIOSScheduleWidgetSync';

jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
  NativeModules: {ScheduleWidgetBridge: {setSchedule: jest.fn(async () => {}), clearSchedule: jest.fn(async () => {})}},
  AppState: {addEventListener: jest.fn(() => ({remove: jest.fn()}))},
}));
jest.mock('react-redux', () => ({useSelector: jest.fn()}));

const schedule: BARSSchedule = {
  todayIndex: 0,
  days: [{date: '20.10.2026', isEmpty: false, isToday: true, lessons: [{
    name: 'Физика', lessonIndex: '09:20 – 10:55', lessonType: 'Лекция', cabinet: 'Б-302',
    teacher: {name: 'Преподаватель', lec_oid: 'private-unneeded-id'}, group: 'private-group', place: '', type: 'COMMON',
  }]}],
};

const bridge = NativeModules.ScheduleWidgetBridge as {
  setSchedule: jest.Mock<Promise<void>, [string]>;
  clearSchedule: jest.Mock<Promise<void>, []>;
};
let state: {status: string; data: BARSSchedule | null};
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
const Probe = ({loginState = 'LOGGED_IN'}: {loginState?: LoginState}) => {
  useIOSScheduleWidgetSync(loginState);
  return null;
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-20T09:00:00Z'));
  jest.clearAllMocks();
  Platform.OS = 'ios';
  bridge.setSchedule.mockResolvedValue(undefined);
  bridge.clearSchedule.mockResolvedValue(undefined);
  state = {status: 'LOADED', data: schedule};
  jest.mocked(useSelector).mockImplementation(selector => selector({Schedule: state}));
});
afterEach(async () => {
  if (renderer) await act(() => renderer?.unmount());
  renderer = undefined;
  jest.useRealTimers();
});

test('payload includes exactly this and next week, excludes unused personal fields and does not mutate Redux data', () => {
  const before = JSON.stringify(schedule);
  const extended = {...schedule, days: [
    {...schedule.days[0]!, date: '18.10.2026'}, ...schedule.days,
    {...schedule.days[0]!, date: '01.11.2026'}, {...schedule.days[0]!, date: '02.11.2026'},
  ]};
  const payload = JSON.parse(serializeIOSSchedule(extended));
  expect(payload.schemaVersion).toBe(1);
  expect(payload.days).toHaveLength(14);
  expect(payload.days[0].date).toBe('19.10.2026');
  expect(payload.days[13]).toMatchObject({date: '01.11.2026', isLoaded: true});
  expect(payload.days.map((day: {date: string}) => day.date)).not.toContain('18.10.2026');
  expect(payload.days.map((day: {date: string}) => day.date)).not.toContain('02.11.2026');
  expect(payload.days[1].isLoaded).toBe(true);
  expect(payload.days[1].lessons[0].name).toBe('Физика');
  expect(payload.days[1].lessons[0].teacher).toEqual({name: 'Преподаватель'});
  expect(JSON.stringify(payload)).not.toMatch(/private-group|private-unneeded-id/);
  expect(JSON.stringify(schedule)).toBe(before);
});

test('partial cached schedule has a safe empty payload instead of throwing in the app', () => {
  const empty = JSON.parse(serializeIOSSchedule({days: null} as unknown as BARSSchedule));
  expect(empty.days).toHaveLength(14);
  expect(empty.days.every((day: {isLoaded: boolean; lessons: unknown[]}) => !day.isLoaded && !day.lessons.length)).toBe(true);
  const partial = {days: [null, {date: '20.10.2026', lessons: [null, {lessonIndex: 2}]}]} as unknown as BARSSchedule;
  expect(JSON.parse(serializeIOSSchedule(partial)).days[1].lessons).toEqual([
    {name: '', lessonIndex: '2', lessonType: '', cabinet: '', teacher: {name: ''}},
  ]);
});

test('a loaded empty day is distinguished from a missing or incomplete date', () => {
  const partial = {days: [{date: '20.10.2026', lessons: []}, {date: '21.10.2026'}]} as unknown as BARSSchedule;
  const payload = JSON.parse(serializeIOSSchedule(partial));
  expect(payload.days[1]).toEqual({date: '20.10.2026', isLoaded: true, lessons: []});
  expect(payload.days[2]).toEqual({date: '21.10.2026', isLoaded: false, lessons: []});
  expect(payload.days[3]).toEqual({date: '22.10.2026', isLoaded: false, lessons: []});
});

test.each([
  ['2026-10-25T20:59:59Z', '19.10.2026', '01.11.2026'], // Sunday in Moscow.
  ['2026-10-25T21:00:00Z', '26.10.2026', '08.11.2026'], // Monday, still Sunday in UTC.
  ['2026-12-31T09:00:00Z', '28.12.2026', '10.01.2027'],
  ['2028-02-29T09:00:00Z', '28.02.2028', '12.03.2028'],
])('week window for %s is calendar based, including year/leap-day boundaries', (now, start, end) => {
  const payload = JSON.parse(serializeIOSSchedule(schedule, new Date(now)));
  const dates = payload.days.map((day: {date: string}) => day.date);
  expect(dates).toHaveLength(14);
  expect(new Set(dates).size).toBe(14);
  expect(dates[0]).toBe(start);
  expect(dates[13]).toBe(end);
});

test('publisher deduplicates payloads but can explicitly request a foreground refresh', async () => {
  const publisher = createIOSWidgetPublisher(bridge);
  await publisher.publish('data');
  await publisher.publish('data');
  expect(bridge.setSchedule).toHaveBeenCalledTimes(1);
  await publisher.publish('data', true);
  expect(bridge.setSchedule).toHaveBeenCalledTimes(2);
});

test('logout waits for an in-flight update so an old account cannot overwrite the cleared widget', async () => {
  let release = () => {};
  let started = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  bridge.setSchedule.mockImplementationOnce(() => { started(); return pending; });
  const publisher = createIOSWidgetPublisher(bridge);
  const write = publisher.publish('old-account');
  const clear = publisher.publish(null);
  await entered;
  expect(bridge.clearSchedule).not.toHaveBeenCalled();
  release();
  await Promise.all([write, clear]);
  expect(bridge.clearSchedule).toHaveBeenCalledTimes(1);
});

test('a rejected native write can be retried and does not block subsequent updates', async () => {
  bridge.setSchedule.mockRejectedValueOnce(new Error('App Group unavailable'));
  const publisher = createIOSWidgetPublisher(bridge);
  await expect(publisher.publish('data')).rejects.toThrow('App Group unavailable');
  await publisher.publish('data');
  expect(bridge.setSchedule).toHaveBeenCalledTimes(2);
});

test('schedule publishes from the root hook without mounting the marks screen', async () => {
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  expect(bridge.setSchedule).toHaveBeenCalledWith(serializeIOSSchedule(schedule));
});

test('offline cached data publishes, but a failed refresh with no replacement preserves the widget', async () => {
  state = {status: 'OFFLINE', data: schedule};
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  state = {status: 'LOADING', data: null};
  await act(() => { renderer?.update(<Probe />); });
  state = {status: 'FAILED', data: null};
  await act(() => { renderer?.update(<Probe />); });
  expect(bridge.setSchedule).toHaveBeenCalledTimes(1);
  expect(bridge.clearSchedule).not.toHaveBeenCalled();
});

test('explicit logout clears shared data and selection', async () => {
  await act(() => { renderer = ReactTestRenderer.create(<Probe loginState="NOT_LOGGED_IN" />); });
  expect(bridge.clearSchedule).toHaveBeenCalledTimes(1);
  expect(bridge.setSchedule).not.toHaveBeenCalled();
});

test('startup does not erase a previously working widget before account restoration finishes', async () => {
  state = {status: 'LOADING', data: null};
  await act(() => { renderer = ReactTestRenderer.create(<Probe loginState="NOT_INITIATED" />); });
  expect(bridge.setSchedule).not.toHaveBeenCalled();
  expect(bridge.clearSchedule).not.toHaveBeenCalled();
});

test('account data reset clears the old schedule while authenticated data is loading', async () => {
  state = {status: 'LOADING', data: null};
  await act(() => { renderer = ReactTestRenderer.create(<Probe loginState="AUTHENTICATED_LOADING_DATA" />); });
  expect(bridge.clearSchedule).toHaveBeenCalledTimes(1);
});

test('foreground requests a refresh and removes its AppState listener on unmount', async () => {
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  const callback = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
  await act(() => callback('active'));
  expect(bridge.setSchedule).toHaveBeenCalledTimes(2);
  const subscription = (AppState.addEventListener as jest.Mock).mock.results[0].value;
  await act(() => { renderer?.unmount(); renderer = undefined; });
  expect(subscription.remove).toHaveBeenCalled();
});

test('returning to the app in a new week republishes the new two-week window', async () => {
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  jest.setSystemTime(new Date('2026-10-26T09:00:00Z'));
  const callback = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
  await act(() => callback('active'));
  const payload = JSON.parse(bridge.setSchedule.mock.calls[1]![0]);
  expect(payload.days[0].date).toBe('26.10.2026');
  expect(payload.days[13].date).toBe('08.11.2026');
});

test('the window updates at Moscow Monday midnight while the app stays open', async () => {
  jest.setSystemTime(new Date('2026-10-25T20:59:59Z'));
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(1100); });
  expect(bridge.setSchedule).toHaveBeenCalledTimes(2);
  expect(JSON.parse(bridge.setSchedule.mock.calls[0]![0]).days[0].date).toBe('19.10.2026');
  expect(JSON.parse(bridge.setSchedule.mock.calls[1]![0]).days[0].date).toBe('26.10.2026');
  await act(() => { renderer?.unmount(); renderer = undefined; });
  expect(jest.getTimerCount()).toBe(0);
});

test('Android does not use the iOS bridge or add iOS widget listeners', async () => {
  Platform.OS = 'android';
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  expect(bridge.setSchedule).not.toHaveBeenCalled();
  expect(bridge.clearSchedule).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
});
