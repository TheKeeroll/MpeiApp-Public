import {Store} from '../src/API/Redux/Store';
import {BARS_BROWSER_PROFILES, STORAGE_KEYS} from '../src/Common/Constants';
import {ScheduleRequestError} from '../src/API/ScheduleClient';
const mockSearch = jest.fn();
let mockScheduleState: any = {status: 'LOADED', data: null};
jest.mock('../src/API/Redux/Store', () => ({Store: {
  dispatch: jest.fn(action => { if (action.type === 'updateSchedule') mockScheduleState = action.payload; }),
  getState: () => ({Schedule: mockScheduleState}),
}}));
jest.mock('../src/API/Redux/Slices', () => Object.fromEntries([
  'updateAdditionalData', 'updateBooks', 'updateMail', 'updateMarkTable', 'updateOrders',
  'updateQuestionnaires', 'updateRecordBook', 'updateReports', 'updateSchedule', 'updateSkippedClasses',
  'updateStipends', 'updateTasks',
].map(type => [type, (payload: unknown) => ({type, payload})])));

jest.mock('../src/API/ScheduleClient', () => ({...jest.requireActual('../src/API/ScheduleClient'), searchSchedule: (...args: unknown[]) => mockSearch(...args)}));
jest.mock('../src/Common/Globals', () => ({cheerio: {load: jest.fn()}, Compare: () => false}));
jest.mock('../src/Themes/Themes', () => ({THEME_DARK: {}, THEME_LIGHT: {}}));
jest.mock('fast-html-parser', () => ({}));
const BARS = require('../src/API/BARS').default;
beforeEach(() => jest.clearAllMocks());
test('public timetable bypasses authenticated BARS transport and uses the chosen profile', async () => {
  const bars = new BARS(); bars.mBARSBrowserProfile = BARS_BROWSER_PROFILES[2];
  bars.FetchUniversity = jest.fn(() => { throw new Error('must not authenticate for a public schedule'); });
  const schedule = {days: [], todayIndex: -1, scheduleName: 'Искомое'};
  mockSearch.mockResolvedValueOnce(schedule);
  await expect(bars.FetchRequestedSchedule('Иванов Иван')).resolves.toBe(schedule);
  expect(mockSearch.mock.calls[0]![0]).toMatchObject({query: 'Иванов Иван', browserProfile: BARS_BROWSER_PROFILES[2], personal: false});
  expect(bars.FetchUniversity).not.toHaveBeenCalled();
});
test('personal schedule never substitutes a different group and preserves offline data on a failure', async () => {
  const bars = new BARS(); bars.mCurrentData.student = {group: 'ГП-04-24'};
  const cached = {days: [], todayIndex: -1, fullTeacherName: 'ГП-04-24'};
  bars.mStorage.set(STORAGE_KEYS.SCHEDULE, JSON.stringify(cached));
  mockSearch.mockRejectedValueOnce(new ScheduleRequestError('network'));
  await bars.FetchSchedule();
  expect(mockSearch.mock.calls[0]![0]).toMatchObject({query: 'ГП-04-24', personal: true});
  expect(Store.getState().Schedule).toMatchObject({status: 'OFFLINE', data: {scheduleName: 'ГП-04-24'}});
  expect(bars.mStorage.getString(STORAGE_KEYS.SCHEDULE)).toBe(JSON.stringify(cached));
});
test('logout aborts public and personal work and prevents a late result from updating the cache', async () => {
  const bars = new BARS(); bars.mCurrentData.student = {group: 'ГП-04-24'};
  const resolvers: ((value: unknown) => void)[] = [];
  mockSearch.mockImplementation(() => new Promise(resolve => resolvers.push(resolve)));
  const publicResult = expect(bars.FetchRequestedSchedule('ГП-04-26')).rejects.toMatchObject({kind: 'cancelled'});
  const personalResult = bars.FetchSchedule();
  const signals = mockSearch.mock.calls.map(call => call[0].signal as AbortSignal);
  bars.Logout();
  signals.forEach(signal => expect(signal.aborted).toBe(true));
  resolvers.forEach(resolve => resolve({days: [], todayIndex: -1, scheduleName: 'ГП-04-26'}));
  await publicResult; await personalResult;
  expect(bars.mStorage.getString(STORAGE_KEYS.SCHEDULE)).toBeUndefined();
  expect(Store.getState().Schedule.data).toBeNull();
});
