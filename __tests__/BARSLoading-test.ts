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
const {BARS_BROWSER_PROFILES, STORAGE_KEYS} = require('../src/Common/Constants');
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

  it('uses one selected desktop browser profile in every BARS header', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const bars = new BARS() as any;
      const headers = [
        bars.GetBARSCommonHeaders(),
        bars.GetBARSLoginHeaders(),
        bars.GetBARSHeadersWithUserId('student-id'),
        bars.GetBARSQRPresenceHeaders('https://bars.mpei.ru/bars_web/'),
      ];

      expect(BARS_BROWSER_PROFILES).toHaveLength(10);
      expect(BARS_BROWSER_PROFILES).toContainEqual({
        'sec-ch-ua': `"Not;A=Brand";v="8", "Chromium";v="150", "YaBrowser";v="26.8", "Yowser";v="2.5"`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 YaBrowser/26.8.0.0 Safari/537.36',
      });
      expect(BARS_BROWSER_PROFILES).toContainEqual({
        'sec-ch-ua': `"Chromium";v="152", "Not?A_Brand";v="24", "Microsoft Edge";v="152"`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0',
      });

      for (const header of headers) {
        expect(header).toMatchObject(BARS_BROWSER_PROFILES[0]);
      }
    } finally {
      random.mockRestore();
    }
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
      .mockResolvedValueOnce({text: async () => `
        <form action="/bars_web/" method="post">
          <input name="__RequestVerificationToken" type="hidden" value="login-token">
          <input name="Password" type="password">
        </form>
      `})
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
      expect(fetchMock.mock.calls[0][1]).toMatchObject({method: 'GET', credentials: 'include'});

      const loginRequest = {
        Account: 'student',
        Password: 'password',
        RememberMe: true,
        StopOpenDefault: false,
        __RequestVerificationToken: 'login-token',
      };
      expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual(loginRequest);
      expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)).toEqual(loginRequest);

      bars.mLastRequested2FAProvider = 2;
      bars.HandleLoginResponse = jest.fn(async () => 'ONLINE');
      await expect(bars.Login2FA('1234')).resolves.toBe('ONLINE');

      const request = fetchMock.mock.calls[3][1] as RequestInit;
      expect(request.credentials).toBe('include');
      expect(JSON.parse(request.body as string)).toEqual({
        Account: 'student',
        AF2_Code: '1234',
        RememberMe: true,
        StopOpenDefault: false,
        __RequestVerificationToken: 'verification-token',
      });

      const initialHeaders = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      for (const [, currentRequest] of fetchMock.mock.calls.slice(1)) {
        expect((currentRequest as RequestInit).headers).toMatchObject({
          'sec-ch-ua': initialHeaders['sec-ch-ua'],
          'user-agent': initialHeaders['user-agent'],
        });
      }
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
      expect(request.credentials).toBe('include');
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

  it('skips the login-form request for saved credentials but keeps StopOpenDefault', async () => {
    const previousFetch = globalThis.fetch;
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({text: async () => '<html>password accepted</html>'})
      .mockResolvedValueOnce({text: async () => '<html>accepted</html>'});
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const bars = new BARS() as any;
      bars.mStorage.set('credentials', JSON.stringify({login: 'student', password: 'password'}));
      bars.HandleLoginResponse = jest.fn(async () => 'ONLINE');

      await expect(bars.Login({login: 'student', password: 'password'}, false)).resolves.toBe('ONLINE');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      for (const [, request] of fetchMock.mock.calls) {
        expect(request).toMatchObject({method: 'POST', credentials: 'include'});
        expect(JSON.parse((request as RequestInit).body as string)).toEqual({
          Account: 'student',
          Password: 'password',
          RememberMe: true,
          StopOpenDefault: false,
        });
      }

      const successfulHeaders = bars.GetBARSCommonHeaders();
      expect(JSON.parse(bars.mStorage.getString(STORAGE_KEYS.BARS_BROWSER_PROFILE))).toMatchObject({
        'sec-ch-ua': successfulHeaders['sec-ch-ua'],
        'user-agent': successfulHeaders['user-agent'],
      });

      bars.Logout();
      const logoutHeaders = bars.GetBARSCommonHeaders();
      expect(logoutHeaders['sec-ch-ua']).not.toBe(successfulHeaders['sec-ch-ua']);
      expect(logoutHeaders['user-agent']).not.toBe(successfulHeaders['user-agent']);
      expect(JSON.parse(bars.mStorage.getString(STORAGE_KEYS.BARS_BROWSER_PROFILE))).toMatchObject({
        'sec-ch-ua': logoutHeaders['sec-ch-ua'],
        'user-agent': logoutHeaders['user-agent'],
      });
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it('continues a fresh login when the login form has no verification token', async () => {
    const previousFetch = globalThis.fetch;
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({text: async () => '<form><input name="Password" type="password"></form>'})
      .mockResolvedValueOnce({text: async () => '<html>password accepted</html>'})
      .mockResolvedValueOnce({text: async () => '<html>accepted</html>'});
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const bars = new BARS() as any;
      bars.HandleLoginResponse = jest.fn(async () => 'ONLINE');

      await expect(bars.Login({login: 'student', password: 'password'})).resolves.toBe('ONLINE');

      expect(fetchMock).toHaveBeenCalledTimes(3);
      for (const [, request] of fetchMock.mock.calls.slice(1)) {
        expect(JSON.parse((request as RequestInit).body as string)).toEqual({
          Account: 'student',
          Password: 'password',
          RememberMe: true,
          StopOpenDefault: false,
        });
      }
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it('rotates the browser profile after a failed login', async () => {
    const previousFetch = globalThis.fetch;
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({text: async () => '<form><input name="Password" type="password"></form>'})
      .mockResolvedValueOnce({text: async () => '<html>password accepted</html>'})
      .mockResolvedValueOnce({text: async () => '<html>unexpected response</html>'});
    const random = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const bars = new BARS() as any;
      const beforeFailure = bars.GetBARSCommonHeaders();

      await expect(bars.Login({login: 'student', password: 'password'})).rejects.toBeDefined();

      const afterFailure = bars.GetBARSCommonHeaders();
      expect(afterFailure['sec-ch-ua']).not.toBe(beforeFailure['sec-ch-ua']);
      expect(afterFailure['user-agent']).not.toBe(beforeFailure['user-agent']);
      expect(JSON.parse(bars.mStorage.getString(STORAGE_KEYS.BARS_BROWSER_PROFILE))).toMatchObject({
        'sec-ch-ua': afterFailure['sec-ch-ua'],
        'user-agent': afterFailure['user-agent'],
      });
    } finally {
      globalThis.fetch = previousFetch;
      random.mockRestore();
    }
  });

  it('rotates the browser profile after a failed 2FA confirmation', async () => {
    const previousFetch = globalThis.fetch;
    const fetchMock = jest.fn().mockRejectedValue(new Error('network failure'));
    const random = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const bars = new BARS() as any;
      bars.mSessionGeneration = 1;
      bars.mStudentAccountLoginAttempt = {
        generation: 1,
        credentials: {login: 'student', password: 'password'},
        isPrimaryOnlineAttempt: false,
        authenticationPhase: 'AWAITING_2FA',
        hasStudentData: false,
      };
      const beforeFailure = bars.GetBARSLoginHeaders();

      await expect(bars.Login2FA('1234')).rejects.toBeDefined();

      const afterFailure = bars.GetBARSLoginHeaders();
      expect(afterFailure['sec-ch-ua']).not.toBe(beforeFailure['sec-ch-ua']);
      expect(afterFailure['user-agent']).not.toBe(beforeFailure['user-agent']);
    } finally {
      globalThis.fetch = previousFetch;
      random.mockRestore();
    }
  });
});
