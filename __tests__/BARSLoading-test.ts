import {loadingProgressService} from '../src/Loading/LoadingProgressService';

const mockDispatch = jest.fn();
let mockState: Record<string, {status: 'LOADING' | 'LOADED' | 'OFFLINE' | 'FAILED'}>;
const mockStore = {
  dispatch: mockDispatch,
  getState: () => mockState,
};

jest.mock('../src/Common/Globals', () => ({
  cheerio: {load: jest.fn()},
  Compare: (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second),
}));
jest.mock('../src/API/Redux/Store', () => ({Store: mockStore}));
jest.mock('../src/API/Redux/Slices', () => {
  const action = (type: string) => (payload: unknown) => ({type, payload});
  return {
    updateAdditionalData: action('additional'),
    updateBooks: action('books'),
    updateMail: action('mail'),
    updateMarkTable: action('marks'),
    updateOrders: action('orders'),
    updateQuestionnaires: action('questionnaires'),
    updateRecordBook: action('recordBook'),
    updateReports: action('reports'),
    updateSchedule: action('schedule'),
    updateSkippedClasses: action('skippedClasses'),
    updateStipends: action('stipends'),
    updateTasks: action('tasks'),
  };
});
jest.mock('../src/Themes/Themes', () => ({THEME_DARK: {}, THEME_LIGHT: {}}));
jest.mock('fast-html-parser', () => ({}));

const BARS = require('../src/API/BARS').default;
const {changeIcon} = require('react-native-change-icon');

const createState = (status: 'LOADING' | 'LOADED' | 'OFFLINE' | 'FAILED' = 'LOADED') => ({
  MarkTable: {status},
  Schedule: {status},
  Mail: {status},
  SkippedClasses: {status},
  RecordBook: {status},
  Tasks: {status},
  Reports: {status},
  Stipends: {status},
  Orders: {status},
  Books: {status},
  Questionnaires: {status},
});

const deferred = <Value,>() => {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>(nextResolve => {
    resolve = nextResolve;
  });
  return {promise, resolve};
};

const setResolvedBackgroundFetches = (bars: any) => {
  for (const method of [
    'FetchMail',
    'FetchSkippedClasses',
    'FetchRecordBook',
    'FetchTasks',
    'FetchReports',
    'FetchStipends',
    'FetchOrders',
    'FetchBooks',
    'FetchQuestionnaires',
  ]) {
    bars[method] = jest.fn(async () => undefined);
  }
};

describe('BARS core and background loading', () => {
  let consoleLog: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    mockState = createState();
    mockDispatch.mockClear();
    changeIcon.mockClear();
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
  });

  it('unlocks navigation after core data while secondary tasks still run', async () => {
    const bars = new BARS() as any;
    bars.mCredentials = {login: 'student', password: 'password'};
    bars.BeginSessionGeneration();
    const schedule = deferred<void>();
    const postOnlineTask = jest.fn(() => Promise.resolve());
    bars.FetchCurrentWeek = jest.fn(async () => undefined);
    bars.FetchMarkTable = jest.fn(async () => undefined);
    bars.FetchSchedule = jest.fn(() => schedule.promise);
    setResolvedBackgroundFetches(bars);
    bars.RegisterPostOnlineDataTask('test-post-online', postOnlineTask);

    await bars.LoadOnlineData();

    expect(bars.LoginState).toBe('LOGGED_IN');
    expect(bars.FetchSchedule).toHaveBeenCalledTimes(1);
    expect(postOnlineTask).toHaveBeenCalledTimes(1);
    expect(bars.mBackgroundDataLoadPromise).toBeDefined();

    schedule.resolve();
    await bars.mBackgroundDataLoadPromise;
  });

  it('finishes the core flow and records a terminal failure when a core request fails', async () => {
    const bars = new BARS() as any;
    bars.mCredentials = {login: 'student', password: 'password'};
    bars.BeginSessionGeneration();
    bars.FetchCurrentWeek = jest.fn(async () => undefined);
    bars.FetchMarkTable = jest.fn(async () => {
      throw new Error('marks unavailable');
    });
    bars.FetchSchedule = jest.fn(async () => undefined);
    setResolvedBackgroundFetches(bars);

    await bars.LoadOnlineData();

    expect(bars.LoginState).toBe('LOGGED_IN');
    expect(loadingProgressService.getSnapshot('authenticated-data')).toMatchObject({
      previous: {status: 'failed'},
    });
    await bars.mBackgroundDataLoadPromise;
  });

  it('does not dispatch a stale cached section after a newer generation starts', async () => {
    const bars = new BARS() as any;
    const response = deferred<string>();
    const update = jest.fn();
    bars.BeginSessionGeneration();

    const fetchPromise = bars.FetchCachedDataSection({
      section: 'schedule',
      storageKey: 'test-schedule',
      timeoutMs: 5_000,
      request: () => response.promise,
      parse: (raw: string) => ({raw}),
      update,
    });
    bars.BeginSessionGeneration();
    response.resolve('new-data');

    await fetchPromise;
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps logout credentials cleared and confirms a native icon change once', async () => {
    const bars = new BARS() as any;
    bars.mCredentials = {login: 'student', password: 'password'};
    bars.mStorage.set('credentials', JSON.stringify(bars.mCredentials));

    expect(await bars.ChangeIcon('dragons')).toBe(true);
    expect(await bars.ChangeIcon('dragons')).toBe(false);
    expect(changeIcon).toHaveBeenCalledTimes(1);

    bars.Logout();
    expect(bars.GetCreds()).toEqual({login: '', password: ''});
    expect(bars.LoginState).toBe('NOT_LOGGED_IN');
  });

  it('retains credentials when an accepted 2FA login enters STUDENTS_NOT_FOUND', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));
    try {
      const bars = new BARS() as any;
      bars.mSessionGeneration = 7;
      bars.mStudentAccountLoginAttempt = {
        generation: 7,
        credentials: {login: 'student', password: 'password'},
        isPrimaryOnlineAttempt: true,
        authenticationPhase: 'TWO_FACTOR_ACCEPTED',
        hasStudentData: false,
      };

      expect(bars.EnterStudentsNotFoundState()).toBe(true);
      expect(bars.GetCreds()).toEqual({login: 'student', password: 'password'});
      expect(bars.LoginState).toBe('STUDENTS_NOT_FOUND');
    } finally {
      jest.useRealTimers();
    }
  });

  it('carries the two-factor page token into the confirmation request', async () => {
    const previousFetch = globalThis.fetch;
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({text: async () => '<html>password accepted</html>'})
      .mockResolvedValueOnce({text: async () => `
        <form action="/bars_web/Auth/LoginCode" method="post">
          <input name="__RequestVerificationToken" type="hidden" value="verification-token">
          <input id="AF2_Code" name="AF2_Code" type="text">
          Введите код подтверждения
        </form>
      `})
      .mockResolvedValueOnce({text: async () => '<html>accepted</html>'});
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const bars = new BARS() as any;
      bars.HandleTwoFactorChallenge = jest.fn(async () => 'NEED_2FA');

      await expect(bars.Login({login: 'student', password: 'password'})).resolves.toBe('NEED_2FA');
      expect(bars.mStudentAccountLoginAttempt.twoFactorRequestVerificationToken).toBe('verification-token');

      bars.mLastRequested2FAProvider = 2;
      bars.HandleLoginResponse = jest.fn(async () => 'ONLINE');
      await expect(bars.Login2FA('1234')).resolves.toBe('ONLINE');

      const request = fetchMock.mock.calls[2][1] as RequestInit;
      expect(JSON.parse(request.body as string)).toEqual({
        Account: 'student',
        AF2_Code: '1234',
        RememberMe: true,
        StopOpenDefault: false,
        __RequestVerificationToken: 'verification-token',
      });
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it('submits the two-factor form without a token when the page did not provide one', async () => {
    const previousFetch = globalThis.fetch;
    const fetchMock = jest.fn().mockResolvedValue({text: async () => '<html>accepted</html>'});
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const bars = new BARS() as any;
      bars.mSessionGeneration = 1;
      bars.mStudentAccountLoginAttempt = {
        generation: 1,
        credentials: {login: 'student', password: 'password'},
        isPrimaryOnlineAttempt: true,
        authenticationPhase: 'AWAITING_2FA',
        hasStudentData: false,
      };
      bars.mLastRequested2FAProvider = 2;
      bars.HandleLoginResponse = jest.fn(async () => 'ONLINE');

      await expect(bars.Login2FA('1234')).resolves.toBe('ONLINE');

      const request = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(request.body as string)).toEqual({
        Account: 'student',
        AF2_Code: '1234',
        RememberMe: true,
        StopOpenDefault: false,
      });
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
