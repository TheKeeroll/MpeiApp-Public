/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ParseMandatoryQuestionnaires} from '../src/API/Parsers/MandatoryQuestionnairesParser';
import {QuestionnairesRequiredError} from '../src/Questionnaires/QuestionnaireErrors';

const mockDispatch = jest.fn();
jest.mock('../src/Common/Globals', () => ({cheerio: {load: jest.fn()}, Compare: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)}));
jest.mock('../src/API/Redux/Store', () => ({Store: {dispatch: mockDispatch, getState: () => ({MarkTable: {status: 'LOADED'}})}}));
jest.mock('../src/API/Redux/Slices', () => Object.fromEntries([
  'updateAdditionalData', 'updateBooks', 'updateMail', 'updateMarkTable', 'updateOrders', 'updateQuestionnaires',
  'updateRecordBook', 'updateReports', 'updateSchedule', 'updateSkippedClasses', 'updateStipends', 'updateTasks',
].map(name => [name, (payload: unknown) => ({type: name, payload})])));
jest.mock('../src/Themes/Themes', () => ({THEME_DARK: {}, THEME_LIGHT: {}}));
jest.mock('fast-html-parser', () => ({}));
const BARS = require('../src/API/BARS').default;
const {STORAGE_KEYS, URLS} = require('../src/Common/Constants');
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures/bars-questionnaires', name), 'utf8');
const reply = (html: string) => ({text: async () => html, status: 200, ok: true, url: URLS.BARS_QUESTIONNAIRES, headers: {get: () => 'text/html'}});
const credentials = {login: 'TestStudent', password: 'fixture-password'};
const formDataRuntime = globalThis as typeof globalThis & {FormData: typeof FormData};

describe('BARS mandatory questionnaire integration', () => {
  let previousFetch: typeof fetch;
  let previousFormData: typeof FormData;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  beforeEach(() => {
    previousFetch = globalThis.fetch;
    previousFormData = formDataRuntime.FormData;
    formDataRuntime.FormData = require('react-native/Libraries/Network/FormData').default;
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockDispatch.mockClear();
  });
  afterEach(() => { globalThis.fetch = previousFetch; formDataRuntime.FormData = previousFormData; log.mockRestore(); warn.mockRestore(); });
  const account = () => {
    const bars = new BARS() as any;
    bars.mCredentials = {...credentials};
    bars.PrepareMandatoryQuestionnaires = jest.fn(async () => undefined);
    return bars;
  };

  it('detects a redirected student list during login and preserves cookies, credentials and browser profile', async () => {
    const bars = account();
    bars.mStorage.set(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials));
    bars.mStorage.set(STORAGE_KEYS.MARKS, 'saved-marks');
    const profile = bars.GetBARSCommonHeaders();
    const fetchMock = jest.fn().mockResolvedValueOnce(reply('На главную')).mockResolvedValueOnce(reply('На главную')).mockResolvedValueOnce(reply(fixture('blocked-page-1.html')));
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(bars.Login(credentials, false)).resolves.toBe('QUESTIONNAIRES_REQUIRED');
    expect(bars.LoginState).toBe('QUESTIONNAIRES_REQUIRED');
    expect(bars.GetCreds()).toEqual(credentials);
    expect(bars.GetBARSCommonHeaders()).toMatchObject(profile);
    expect(bars.mStorage.getString(STORAGE_KEYS.MARKS)).toBe('saved-marks');
    expect(fetchMock.mock.calls[2]).toEqual([URLS.BARS_MULTI_ACCOUNT, expect.objectContaining({method: 'GET', credentials: 'include'})]);
  });

  it('keeps an accepted temporary 2FA code and gives the restriction priority over STUDENTS_NOT_FOUND', async () => {
    const bars = account();
    bars.BeginLoginAttempt(credentials, true);
    bars.mLastRequested2FAProvider = 4;
    globalThis.fetch = jest.fn().mockResolvedValue(reply(fixture('blocked-page-1.html')));
    const profile = bars.GetBARSCommonHeaders();
    await expect(bars.Login2FA('1234')).resolves.toBe('QUESTIONNAIRES_REQUIRED');
    expect(JSON.parse(bars.mStorage.getString(STORAGE_KEYS.TEMPORARY_2FA_CODE))).toEqual({account: credentials.login, code: '1234'});
    expect(bars.GetBARSCommonHeaders()).toMatchObject(profile);
    expect(bars.EnterStudentsNotFoundState()).toBe(false);
  });

  it('restores a restricted session without another password POST', async () => {
    const bars = account();
    bars.mStorage.set(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials));
    bars.mStorage.set(STORAGE_KEYS.STUDENT_INFO, JSON.stringify({id: 'student-id'}));
    const login = jest.spyOn(bars, 'Login');
    const fetchMock = jest.fn().mockResolvedValue(reply(fixture('blocked-page-1.html')));
    globalThis.fetch = fetchMock as typeof fetch;
    await bars.Init(false);
    expect(login).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bars.LoginState).toBe('QUESTIONNAIRES_REQUIRED');
  });

  it('guards unexpected HTML from a schedule JSON API, while exempting auth, QR and external services', async () => {
    const bars = account();
    globalThis.fetch = jest.fn().mockResolvedValue(reply(fixture('blocked-page-1.html')));
    await expect(bars.FetchUniversity('https://ts.mpei.ru/api/schedule/group/1')).rejects.toBeInstanceOf(QuestionnairesRequiredError);
    expect(bars.LoginState).toBe('QUESTIONNAIRES_REQUIRED');
    for (const [address, purpose] of [
      [URLS.BARS_MAIN, 'auth'], [URLS.BARS_LOGIN_CODE, '2FA'], [URLS.BARS_QR_PRESENCE + 'fixture', 'qr'], ['https://dragonservices.online/demo', 'data'],
    ]) await expect(bars.FetchUniversity(address, {}, {purpose})).resolves.toMatchObject({status: 200});
  });

  it('does not overwrite restored student data if a concurrent request discovers a restriction', async () => {
    const bars = account();
    const saved = JSON.stringify({id: 'student-id'});
    bars.mStorage.set(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials));
    bars.mStorage.set(STORAGE_KEYS.STUDENT_INFO, saved);
    let release: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>(resolve => { release = resolve; });
    globalThis.fetch = jest.fn(() => pending) as unknown as typeof fetch;
    const parser = jest.spyOn(require('../src/API/Parsers/StudentInfoParser'), 'ParseStudentInfo').mockReturnValue({id: 'late-student'});
    try {
      const restore = bars.Init(false);
      bars.RecordMandatoryQuestionnaires(ParseMandatoryQuestionnaires(fixture('blocked-page-1.html')));
      release(reply('<select id="ddl_StudyFilterSemester"><option value="1">Семестр</option></select>'));
      await restore;
      expect(parser).not.toHaveBeenCalled();
      expect(bars.mStorage.getString(STORAGE_KEYS.STUDENT_INFO)).toBe(saved);
      expect(bars.LoginState).toBe('QUESTIONNAIRES_REQUIRED');
    } finally { parser.mockRestore(); }
  });

  it('does not overwrite cached data or parse late data after another request discovers a restriction', async () => {
    const bars = account();
    bars.mStorage.set('cached', 'old-value');
    let release: (value: string) => void = () => undefined;
    const pending = new Promise<string>(resolve => { release = resolve; });
    const parser = jest.fn(() => []);
    const update = jest.fn();
    const section = bars.FetchCachedDataSection({section: 'books', storageKey: 'cached', timeoutMs: 5000, request: () => pending, parse: parser, update});
    globalThis.fetch = jest.fn().mockResolvedValue(reply(fixture('blocked-page-1.html')));
    await expect(bars.FetchUniversity(URLS.BARS_BOOKS + 'student')).rejects.toBeInstanceOf(QuestionnairesRequiredError);
    release('ordinary content');
    await section;
    expect(parser).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(bars.mStorage.getString('cached')).toBe('old-value');
  });

  it('does not let core finally or background loading override the required state', async () => {
    const bars = account();
    bars.FetchCurrentWeek = jest.fn(async () => undefined);
    bars.FetchSchedule = jest.fn(async () => undefined);
    globalThis.fetch = jest.fn().mockResolvedValue(reply(fixture('blocked-page-1.html')));
    bars.FetchMarkTable = () => bars.FetchUniversity(URLS.BARS_MAIN + 'ST_Study/Main/Main');
    await bars.LoadOnlineData();
    bars.SetLoginState('LOGGED_IN');
    expect(bars.LoginState).toBe('QUESTIONNAIRES_REQUIRED');
    expect(bars.FetchSchedule).not.toHaveBeenCalled();
  });

  it('collects all pages without student.id and retains partial names if the next page fails', async () => {
    const bars = account();
    const controller = new AbortController();
    const fetchMock = jest.fn().mockResolvedValueOnce(reply(fixture('blocked-page-1.html'))).mockResolvedValueOnce(reply(fixture('blocked-page-2.html')));
    globalThis.fetch = fetchMock as typeof fetch;
    const list = await bars.CollectQuestionnaires(controller.signal);
    expect(list.complete).toBe(true);
    expect(list.rows).toHaveLength(18);
    expect(list.rows.filter((row: {mandatory: boolean}) => row.mandatory)).toHaveLength(3);
    expect(decodeURIComponent(fetchMock.mock.calls[1][0])).toContain('"Page":"2"');
    fetchMock.mockResolvedValueOnce(reply(fixture('blocked-page-1.html'))).mockRejectedValueOnce(new Error('offline'));
    await expect(bars.CollectQuestionnaires(controller.signal)).rejects.toThrow('offline');
    expect(bars.MandatoryQuestionnairesSnapshot.questionnaires).toHaveLength(1);
    expect(bars.MandatoryQuestionnairesSnapshot.listComplete).toBe(false);
  });

  it('ignores a late restricted response after logout', async () => {
    const bars = account();
    let release: (value: unknown) => void = () => undefined;
    globalThis.fetch = jest.fn(() => new Promise<unknown>(resolve => { release = resolve; })) as unknown as typeof fetch;
    const request = bars.FetchUniversity(URLS.BARS_MAIN);
    bars.Logout();
    release(reply(fixture('blocked-page-1.html')));
    await expect(request).rejects.toThrow();
    expect(bars.LoginState).toBe('NOT_LOGGED_IN');
    expect(bars.GetCreds().login).toBe('');
    expect(bars.MandatoryQuestionnairesSnapshot.questionnaires).toHaveLength(0);
    expect(bars.MandatoryQuestionnairesSnapshot.generation).toBeUndefined();
  });

  it('rechecks the cabinet with cookies and reloads data without a password POST when the restriction is removed', async () => {
    const bars = account();
    bars.mStorage.set(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials));
    bars.RecordMandatoryQuestionnaires(ParseMandatoryQuestionnaires(fixture('blocked-page-1.html')));
    const profile = bars.GetBARSCommonHeaders();
    const fetchMock = jest.fn().mockResolvedValue(reply('Оценки в БАРС Рейтинг'));
    globalThis.fetch = fetchMock as typeof fetch;
    bars.HandleLoginResponse = jest.fn(async () => 'ONLINE');
    bars.LoadOnlineData = jest.fn(async () => bars.SetLoginState('LOGGED_IN'));
    await bars.RetryMandatoryQuestionnaires();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: 'GET', credentials: 'include'});
    expect(bars.LoadOnlineData).toHaveBeenCalledTimes(1);
    expect(bars.LoginState).toBe('LOGGED_IN');
    expect(bars.GetBARSCommonHeaders()).toMatchObject(profile);
    expect(bars.GetCreds()).toEqual(credentials);
    expect(bars.MandatoryQuestionnairesSnapshot.questionnaires).toHaveLength(0);
  });

  it('keeps the restricted account on a retry network failure but returns to login for an actual expired session', async () => {
    const bars = account();
    bars.RecordMandatoryQuestionnaires(ParseMandatoryQuestionnaires(fixture('blocked-page-1.html')));
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await bars.RetryMandatoryQuestionnaires();
    expect(bars.LoginState).toBe('QUESTIONNAIRES_REQUIRED');
    expect(bars.MandatoryQuestionnairesSnapshot.error).toBe('offline');
    expect(bars.GetCreds()).toEqual(credentials);
    globalThis.fetch = jest.fn().mockResolvedValue(reply(fixture('login-form.html')));
    await bars.RetryMandatoryQuestionnaires();
    expect(bars.LoginState).toBe('NOT_LOGGED_IN');
    expect(bars.GetCreds()).toEqual(credentials);
  });

  it('does not retry a failed automatic operation, and switching it off aborts further writes', async () => {
    const bars = account();
    const row = ParseMandatoryQuestionnaires(fixture('blocked-page-1.html')).questionnaires[0]!;
    bars.mRequiredQuestionnairesGeneration = bars.mSessionGeneration;
    bars.mStorage.set(STORAGE_KEYS.AUTO_FILL_MANDATORY_QUESTIONNAIRES, 'true');
    bars.CollectQuestionnaires = jest.fn(async () => ({rows: [row], complete: true, blocked: true}));
    const unsupported = readFileSync(join(__dirname, 'fixtures/bars-questions/unsupported-file.html'), 'utf8');
    const fetchMock = jest.fn().mockResolvedValue(reply(unsupported));
    globalThis.fetch = fetchMock as typeof fetch;
    await bars.AutoFillMandatoryQuestionnaires(true);
    expect(bars.MandatoryQuestionnairesSnapshot.error).toContain('распознать');
    await bars.MaybeAutoFillQuestionnaires();
    await bars.MaybeAutoFillQuestionnaires();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    let release: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>(resolve => { release = resolve; });
    fetchMock.mockImplementation(() => pending);
    const operation = bars.AutoFillMandatoryQuestionnaires(true);
    await Promise.resolve();
    await Promise.resolve();
    bars.SetAutomaticQuestionnaireFilling(false);
    release(reply(readFileSync(join(__dirname, 'fixtures/bars-questions/radio-neutral.html'), 'utf8')));
    await operation;
    expect(fetchMock.mock.calls.every(call => call[1].method === 'GET')).toBe(true);
    expect(bars.AutomaticQuestionnaireFilling).toBe(false);
    expect(bars.MandatoryQuestionnairesSnapshot.status).toBe('idle');
  });

  it('uses multipart answers and form-urlencoded completion with the same profile and cookies', async () => {
    const bars = account();
    bars.mRequiredQuestionnairesGeneration = bars.mSessionGeneration;
    const row = ParseMandatoryQuestionnaires(fixture('blocked-page-1.html')).questionnaires[0]!;
    bars.CollectQuestionnaires = jest.fn().mockResolvedValueOnce({rows: [row], complete: true, blocked: true})
      .mockResolvedValueOnce({rows: [{...row, status: 'заполнение завершено'}], complete: true, blocked: false})
      .mockResolvedValueOnce({rows: [], complete: true, blocked: false});
    bars.CheckMandatoryAccess = jest.fn(async () => { bars.mRequiredQuestionnairesGeneration = undefined; });
    const questionFixture = (name: string) => readFileSync(join(__dirname, 'fixtures/bars-questions', name), 'utf8');
    const fetchMock = jest.fn().mockResolvedValueOnce(reply(questionFixture('radio-neutral.html')))
      .mockResolvedValueOnce(reply(JSON.stringify({success: true, url: row.viewUrl})))
      .mockResolvedValueOnce(reply(questionFixture('completion.html')))
      .mockResolvedValueOnce(reply('{"success":true}'));
    globalThis.fetch = fetchMock as typeof fetch;
    const profile = bars.GetBARSCommonHeaders();
    await bars.AutoFillMandatoryQuestionnaires();
    expect(bars.MandatoryQuestionnairesSnapshot.error).toBeUndefined();
    const answer = fetchMock.mock.calls[1][1];
    expect(answer).toMatchObject({method: 'POST', credentials: 'include'});
    expect(answer.headers['content-length']).toBeUndefined();
    expect(answer.headers['Content-Type']).toBeUndefined();
    expect(answer.headers).toMatchObject({'user-agent': profile['user-agent'], 'sec-ch-ua': profile['sec-ch-ua']});
    expect(answer.body.getParts()).toEqual(expect.arrayContaining([expect.objectContaining({fieldName: 'mode', string: '1'}), expect.objectContaining({fieldName: 'answer', string: expect.stringMatching(/^186[45]$/)})]));
    const completion = fetchMock.mock.calls[3][1];
    expect(completion.headers['Content-Type']).toContain('application/x-www-form-urlencoded');
    expect(completion.body).toBe(`uslkID=${row.userId}&qqaID=${row.id}`);
    expect(bars.CheckMandatoryAccess).toHaveBeenCalledTimes(1);
  });
});
