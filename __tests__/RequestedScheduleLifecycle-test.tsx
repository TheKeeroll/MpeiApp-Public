import React from 'react';
import Renderer, {act} from 'react-test-renderer';
import type {BARSSchedule} from '../src/API/DataTypes';
let mockFocused = true;
const mockFetch = jest.fn();
const mockRecord = jest.fn();
const mockRemember = jest.fn();
jest.mock('@react-navigation/native', () => ({useIsFocused: () => mockFocused}));
jest.mock('react-redux', () => ({useSelector: jest.fn()}));
jest.mock('react-native-paper', () => ({useTheme: () => ({colors: {background: '#111111', text: '#ffffff'}})}));
jest.mock('../src/Themes/Themes', () => ({withOpacity: (value: string) => value}));
jest.mock('../src/Screens/CommonComponents/DrawerHeader', () => ({NavigationHeader: () => null}));
jest.mock('../src/Screens/LoadingScreen/LoadingScreen', () => () => null);
jest.mock('../src/Screens/Schedule/ScheduleSearchPanel', () => () => null);
jest.mock('../src/Common/Globals', () => ({__esModule: true, default: {TestMode: false, FetchRequestedSchedule: (...args: unknown[]) => mockFetch(...args)}}));
jest.mock('../src/Loyalty/LoyaltyProvider', () => ({useLoyalty: () => ({recordSuccessfulFeatureUse: mockRecord})}));
jest.mock('../src/Schedule/useScheduleSearchLibrary', () => ({getScheduleSearchLibrary: () => ({remember: mockRemember})}));
jest.mock('../src/Vpn/useDragoNetPromo', () => ({useDragoNetPromo: () => ({viewportRef: require('react').createRef(), refreshVisibility: jest.fn(), banner: null})}));
jest.mock('../src/Ads/useDeferredInlineAd', () => ({useDeferredInlineAd: () => ({})}));
jest.mock('lottie-react-native', () => () => null);
const Screen = require('../src/Screens/Schedule/ScheduleScreen').default;
const navigation = {goBack: jest.fn()};
const result = (name: string, id = '1'): BARSSchedule => ({days: [], todayIndex: -1, scheduleName: name, scheduleTarget: {id, type: 'group'}});
const deferred = () => {
  let resolve!: (value: BARSSchedule) => void;
  const promise = new Promise<BARSSchedule>(next => { resolve = next; });
  return {promise, resolve};
};
let tree: Renderer.ReactTestRenderer;
const render = async (query: string) => {
  await act(() => {
    const screen = <Screen navigation={navigation} route={{params: {searchQuery: query}}}/>;
    if (tree) tree.update(screen); else tree = Renderer.create(screen);
  });
  await act(async () => { await jest.advanceTimersByTimeAsync(200); });
};
beforeEach(() => {jest.useFakeTimers(); jest.clearAllMocks(); mockFocused = true; tree = undefined!;});
afterEach(async () => {if (tree) await act(() => tree.unmount()); jest.useRealTimers();});
test('new query cancels previous HTTP and late results cannot overwrite history or charge a use', async () => {
  const first = deferred(); const second = deferred();
  mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  await render('ГП-04-24');
  const firstSignal = mockFetch.mock.calls[0]![1].signal as AbortSignal;
  await render('ГП-04-26');
  expect(firstSignal.aborted).toBe(true);
  await act(async () => second.resolve(result('ГП-04-26', '2')));
  await act(async () => first.resolve(result('ГП-04-24')));
  expect(mockRecord).toHaveBeenCalledTimes(1);
  expect(mockRemember).toHaveBeenCalledTimes(1);
  expect(mockRemember).toHaveBeenCalledWith({id: '2', type: 'group', name: 'ГП-04-26'});
});
test('unmount cancels the network operation before a late result', async () => {
  const pending = deferred(); mockFetch.mockReturnValueOnce(pending.promise);
  await render('ГП-04-26');
  const signal = mockFetch.mock.calls[0]![1].signal as AbortSignal;
  await act(() => tree.unmount()); tree = undefined!;
  await act(async () => pending.resolve(result('ГП-04-26')));
  expect(signal.aborted).toBe(true);
  expect(mockRecord).not.toHaveBeenCalled(); expect(mockRemember).not.toHaveBeenCalled();
});
test('focus changes do not charge or refetch an already loaded result', async () => {
  mockFetch.mockResolvedValueOnce(result('ГП-04-26'));
  await render('ГП-04-26');
  mockFocused = false; await render('ГП-04-26');
  mockFocused = true; await render('ГП-04-26');
  expect(mockFetch).toHaveBeenCalledTimes(1); expect(mockRecord).toHaveBeenCalledTimes(1);
});
test('invalid routes and request failures do not record a search', async () => {
  await render('К-');
  expect(mockFetch).not.toHaveBeenCalled();
  mockFetch.mockRejectedValueOnce(new Error('Сервер недоступен'));
  await render('К-202');
  expect(mockRecord).not.toHaveBeenCalled(); expect(mockRemember).not.toHaveBeenCalled();
});
