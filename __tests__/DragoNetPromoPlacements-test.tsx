import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {FlatList} from 'react-native';
import type {BARSSchedule} from '../src/API/DataTypes';

let mockStatus = 'LOADED';
let mockSchedule: BARSSchedule;
const mockRecordUse = jest.fn();
const mockFetchRequestedSchedule = jest.fn();
const mockPromo = jest.fn((key: string, eligible: boolean) => ({
  viewportRef: React.createRef(), refreshVisibility: jest.fn(),
  banner: eligible ? React.createElement('DragoNetPromoMock', {placement: key}) : null,
}));
jest.mock('../src/Vpn/useDragoNetPromo', () => ({useDragoNetPromo: (key: string, eligible: boolean) => mockPromo(key, eligible)}));
jest.mock('react-redux', () => ({useSelector: (selector: (state: unknown) => unknown) => selector({
  Tasks: {status: mockStatus, data: []}, Reports: {status: mockStatus, data: []}, Orders: {status: mockStatus, data: []},
  Books: {status: mockStatus, data: {books: [], library_card: 'empty'}}, Schedule: {status: mockStatus, data: mockSchedule},
})}));
jest.mock('react-native-paper', () => ({useTheme: () => ({colors: {background: '#111111', primary: '#222222', surface: '#333333', text: '#ffffff', textUnderline: '#00ffff', accent: '#ffffff'}})}));
jest.mock('react-native-safe-area-context', () => ({SafeAreaView: ({children}: {children: React.ReactNode}) => <>{children}</>, useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})}));
jest.mock('../src/Themes/Themes', () => ({withOpacity: (color: string) => color}));
jest.mock('../src/Screens/CommonComponents/DrawerHeader', () => ({__esModule: true, default: () => null, NavigationHeader: () => null}));
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({})}));
jest.mock('../src/Common/Globals', () => ({__esModule: true, default: {TestMode: false, FetchRequestedSchedule: (...args: unknown[]) => mockFetchRequestedSchedule(...args)}}));
jest.mock('../src/Screens/BARS/Marks/BARSMainScreen', () => ({convertDate: () => new Date()}));
jest.mock('../src/Screens/LoadingScreen/LoadingScreen', () => () => null);
jest.mock('../src/Screens/CommonComponents/FetchFailed', () => () => null);
jest.mock('../src/Screens/CommonComponents/OfflineDataNotification', () => () => null);
jest.mock('../src/Screens/CommonComponents/Holidays', () => () => null);
jest.mock('../src/Screens/Schedule/ScheduleSearchPanel', () => () => null);
jest.mock('../src/Loyalty/LoyaltyProvider', () => ({useLoyalty: () => ({recordSuccessfulFeatureUse: mockRecordUse})}));
jest.mock('../src/Loading/LoadingProgressService', () => ({loadingProgressService: {start: () => ({}), advance: jest.fn(), complete: jest.fn(), fail: jest.fn()}}));
jest.mock('../src/Ads/InlineBannerAd', () => (props: Record<string, unknown>) => require('react').createElement('InlineBannerAdMock', props));
jest.mock('lottie-react-native', () => () => null);

const Tasks = require('../src/Screens/BARS/Tasks/TasksScreen').default;
const Reports = require('../src/Screens/BARS/Reports/ReportsScreen').default;
const Orders = require('../src/Screens/BARS/Orders/OrdersScreen').default;
const Books = require('../src/Screens/BARS/Books/BooksScreen').default;
const Schedule = require('../src/Screens/Schedule/ScheduleScreen').default;
const navigation = {push: jest.fn(), goBack: jest.fn()};

describe('DragoNet banner placements', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  const originalMonthName = Date.prototype.getMonthName;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-12T12:00:00Z'));
    jest.clearAllMocks();
    Date.prototype.getMonthName = () => 'Октябрь';
    mockStatus = 'LOADED';
    mockSchedule = {todayIndex: 0, days: [
      {date: '12.10.2026', lessons: [], isEmpty: false, isToday: false},
      {date: '13.10.2026', lessons: [], isEmpty: false, isToday: true},
    ]};
    mockFetchRequestedSchedule.mockResolvedValue(mockSchedule);
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    Date.prototype.getMonthName = originalMonthName;
    jest.useRealTimers();
  });
  const lastOpportunity = () => mockPromo.mock.calls.at(-1)!;

  it.each([['tasks', Tasks], ['reports', Reports], ['orders', Orders], ['books', Books]])(
    'offers a footer for an empty loaded/offline %s section, excluding loading/errors', async (key, Screen) => {
      await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Screen/>); });
      expect(lastOpportunity()).toEqual([key, true]);
      mockStatus = 'OFFLINE';
      await ReactTestRenderer.act(() => tree.update(<Screen/>));
      expect(lastOpportunity()).toEqual([key, true]);
      for (const status of ['LOADING', 'FAILED']) {
        mockStatus = status;
        await ReactTestRenderer.act(() => tree.update(<Screen/>));
        expect(lastOpportunity()).toEqual([key, false]);
      }
    },
  );

  it('excludes today by date instead of stale flags and enables another selected day', async () => {
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Schedule navigation={navigation} route={{}}/>); });
    expect(lastOpportunity()).toEqual(['personal:12.10.2026', false]);
    const selector = tree.root.find(node => typeof node.props.onDateSelect === 'function');
    await ReactTestRenderer.act(() => selector.props.onDateSelect(1));
    expect(lastOpportunity()).toEqual(['personal:13.10.2026', true]);
    mockStatus = 'OFFLINE';
    await ReactTestRenderer.act(() => tree.update(<Schedule navigation={navigation} route={{}}/>));
    expect(lastOpportunity()).toEqual(['personal:13.10.2026', true]);
  });

  it('keeps the today Yandex footer full-width and removes it for another day or an empty today', async () => {
    mockSchedule.days[0].lessons = [{name: 'Test lesson', lessonIndex: '1-2', lessonType: 'Lecture',
      place: 'A', cabinet: '101', group: 'A-01', type: 'COMMON', teacher: {name: '-', fullName: '-', lec_oid: ''}}];
    await ReactTestRenderer.act(() => {tree = ReactTestRenderer.create(<Schedule navigation={navigation} route={{}}/>);});
    expect(tree.root.findAllByType('InlineBannerAdMock' as React.ElementType)).toHaveLength(1);
    expect(tree.root.findByType('InlineBannerAdMock' as React.ElementType).props.placement).toBe('inlineBannerScheduleToday');
    const list = tree.root.findAllByType(FlatList).find(node => node.props.ListFooterComponentStyle?.width === '100%');
    expect(list).toBeDefined();
    const selector = tree.root.find(node => typeof node.props.onDateSelect === 'function');
    await ReactTestRenderer.act(() => selector.props.onDateSelect(1));
    expect(tree.root.findAllByType('InlineBannerAdMock' as React.ElementType)).toHaveLength(0);
    await ReactTestRenderer.act(() => selector.props.onDateSelect(0));
    expect(tree.root.findAllByType('InlineBannerAdMock' as React.ElementType)).toHaveLength(1);
    mockSchedule = {...mockSchedule, days: mockSchedule.days.map(day => ({...day, lessons: []}))};
    await ReactTestRenderer.act(() => tree.update(<Schedule navigation={navigation} route={{}}/>));
    expect(tree.root.findAllByType('InlineBannerAdMock' as React.ElementType)).toHaveLength(0);
  });

  it.each(['group', 'teacher', 'auditorium'])('applies the same rule to a requested %s schedule, including guest navigation', async query => {
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Schedule navigation={navigation} route={{params: {searchQuery: query}}}/>); });
    expect(lastOpportunity()[1]).toBe(false);
    await ReactTestRenderer.act(async () => { await jest.advanceTimersByTimeAsync(200); });
    expect(lastOpportunity()).toEqual([`requested:${query}:1:12.10.2026`, false]);
    const selector = tree.root.find(node => typeof node.props.onDateSelect === 'function');
    await ReactTestRenderer.act(() => selector.props.onDateSelect(1));
    expect(lastOpportunity()).toEqual([`requested:${query}:1:13.10.2026`, true]);
  });

  it('updates applicability at Moscow midnight without selecting another day', async () => {
    jest.setSystemTime(new Date('2026-10-12T20:59:59Z'));
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Schedule navigation={navigation} route={{}}/>); });
    expect(lastOpportunity()[1]).toBe(false);
    await ReactTestRenderer.act(async () => { await jest.advanceTimersByTimeAsync(1050); });
    expect(lastOpportunity()).toEqual(['personal:12.10.2026', true]);
  });

  it('does not offer a promotion for a requested result without a selected date', async () => {
    mockFetchRequestedSchedule.mockResolvedValue({todayIndex: -1, days: []});
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Schedule navigation={navigation} route={{params: {searchQuery: 'empty'}}}/>); });
    await ReactTestRenderer.act(async () => { await jest.advanceTimersByTimeAsync(200); });
    expect(lastOpportunity()[1]).toBe(false);
  });
});
