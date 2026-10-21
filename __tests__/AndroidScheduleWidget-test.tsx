import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AppState, NativeModules, Platform} from 'react-native';
import {useSelector} from 'react-redux';
import type {LoginState} from '../src/API/BARS';
import type {BARSSchedule} from '../src/API/DataTypes';
import {serializeScheduleWidget} from '../src/Widgets/ScheduleWidgetData';
import {useAndroidScheduleWidgetSync} from '../src/Widgets/useAndroidScheduleWidgetSync';

jest.mock('react-native', () => ({
  Platform: {OS: 'android'},
  NativeModules: {SharedStorage: {setSchedule: jest.fn(async () => {}), clearSchedule: jest.fn(async () => {})}},
  AppState: {addEventListener: jest.fn(() => ({remove: jest.fn()}))},
}));
jest.mock('react-redux', () => ({useSelector: jest.fn()}));

const schedule: BARSSchedule = {
  todayIndex: 0,
  days: [{date: '21.10.2026', isEmpty: true, isToday: true, lessons: []}],
};
const bridge = NativeModules.SharedStorage as {
  setSchedule: jest.Mock<Promise<void>, [string]>;
  clearSchedule: jest.Mock<Promise<void>, []>;
};
let state: {status: string; data: BARSSchedule | null};
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
const Probe = ({loginState = 'LOGGED_IN'}: {loginState?: LoginState}) => {
  useAndroidScheduleWidgetSync(loginState);
  return null;
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-21T09:00:00Z'));
  jest.clearAllMocks();
  Platform.OS = 'android';
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

test('publishes two weeks from the application root without visiting marks', async () => {
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  expect(bridge.setSchedule).toHaveBeenCalledWith(serializeScheduleWidget(schedule));
  const payload = JSON.parse(bridge.setSchedule.mock.calls[0]![0]);
  expect(payload.days).toHaveLength(14);
  expect(payload.days[0].date).toBe('19.10.2026');
  expect(payload.days[13].date).toBe('01.11.2026');
});

test('startup and second-factor screens preserve the previously shared cache', async () => {
  state = {status: 'LOADING', data: null};
  await act(() => { renderer = ReactTestRenderer.create(<Probe loginState="NOT_INITIATED" />); });
  await act(() => { renderer?.update(<Probe loginState="NEED_2FA" />); });
  expect(bridge.setSchedule).not.toHaveBeenCalled();
  expect(bridge.clearSchedule).not.toHaveBeenCalled();
});

test('cached offline data is shared, but an empty failed refresh does not erase it', async () => {
  state = {status: 'OFFLINE', data: schedule};
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  state = {status: 'FAILED', data: null};
  await act(() => { renderer?.update(<Probe />); });
  expect(bridge.setSchedule).toHaveBeenCalledTimes(1);
  expect(bridge.clearSchedule).not.toHaveBeenCalled();
});

test.each(['NOT_LOGGED_IN', 'STUDENTS_NOT_FOUND', 'AUTHENTICATED_LOADING_DATA'] as LoginState[])(
  '%s clears data and widget selections when account data is reset', async loginState => {
    state = {status: 'LOADING', data: null};
    await act(() => { renderer = ReactTestRenderer.create(<Probe loginState={loginState} />); });
    expect(bridge.clearSchedule).toHaveBeenCalledTimes(1);
    expect(bridge.setSchedule).not.toHaveBeenCalled();
  },
);

test('foreground forces a refresh and recomputes the new calendar week', async () => {
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  jest.setSystemTime(new Date('2026-10-26T09:00:00Z'));
  const callback = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
  await act(() => callback('active'));
  expect(JSON.parse(bridge.setSchedule.mock.calls[1]![0]).days[0].date).toBe('26.10.2026');
});

test('an open app updates at Moscow Monday midnight and cleans up its timer', async () => {
  jest.setSystemTime(new Date('2026-10-25T20:59:59Z'));
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(1100); });
  expect(bridge.setSchedule).toHaveBeenCalledTimes(2);
  expect(JSON.parse(bridge.setSchedule.mock.calls[1]![0]).days[0].date).toBe('26.10.2026');
  const subscription = (AppState.addEventListener as jest.Mock).mock.results[0].value;
  await act(() => { renderer?.unmount(); renderer = undefined; });
  expect(subscription.remove).toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('iOS does not call Android storage or add Android listeners', async () => {
  Platform.OS = 'ios';
  await act(() => { renderer = ReactTestRenderer.create(<Probe />); });
  expect(bridge.setSchedule).not.toHaveBeenCalled();
  expect(bridge.clearSchedule).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
});
