import {searchSchedule, SCHEDULE_REQUEST_TIMEOUT_MS, SCHEDULE_SEARCH_TIMEOUT_MS} from '../src/API/ScheduleClient';
import type {ScheduleRequestType} from '../src/API/DataTypes';
import lessons from './fixtures/schedules/lessons.json';

const browserProfile = {'user-agent': 'selected-browser', 'sec-ch-ua': 'selected-brand'};
const now = new Date('2026-11-14T12:00:00Z');
const candidate = (type: ScheduleRequestType, id = 1, label = 'Искомое расписание') => ({id, type, label});
const response = (value: unknown) => ({ok: true, headers: {get: () => 'application/json'}, json: async () => value}) as unknown as Response;
const fetcherFor = (handle: (url: URL, init: RequestInit) => unknown) => jest.fn(async (url, init) => response(await handle(new URL(String(url)), init!))) as jest.MockedFunction<typeof fetch>;
const start = (query: string, fetcher: typeof fetch, extra: Partial<Parameters<typeof searchSchedule>[0]> = {}) => searchSchedule({query, browserProfile, fetcher, now, ...extra});

test.each(['', 'a', ' К '])('invalid input never sends a request: %s', async query => {
  const fetcher = fetcherFor(() => []);
  await expect(start(query, fetcher)).rejects.toMatchObject({kind: 'invalid-query'});
  expect(fetcher).not.toHaveBeenCalled();
});
test('uses HTTPS and selected identity on both requests, encodes the full query and never sends BARS credentials', async () => {
  const fetcher = fetcherFor(url => url.pathname === '/api/search' ? [candidate('person', 3999, 'Подкопаева Виктория Александровна')] : lessons);
  const result = await start(' Подкопаева Виктория & + ', fetcher);
  expect(result.scheduleName).toBe('Подкопаева Виктория Александровна');
  expect(result.scheduleTarget).toEqual({id: '3999', type: 'person'});
  expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get('term')).toBe('Подкопаева Виктория & +');
  expect(String(fetcher.mock.calls[1]![0])).toContain('/api/schedule/person/3999?');
  for (const [url, init] of fetcher.mock.calls) {
    expect(String(url)).toMatch(/^https:\/\/ts\.mpei\.ru\//);
    expect(init?.credentials).toBe('omit');
    expect(init?.headers).toMatchObject(browserProfile);
    expect(init?.headers).not.toHaveProperty('cookie');
    expect(init?.headers).not.toHaveProperty('authorization');
  }
});
test('youngest group on fifth directory row is selected even at length >= 5', async () => {
  const fetcher = fetcherFor(url => url.pathname === '/api/search'
    ? [22, 23, 24, 25, 26].map(year => candidate('group', year, `ГП-04-${year}`)) : lessons);
  expect((await start('ГП-04-', fetcher)).scheduleName).toBe('ГП-04-26');
  expect(String(fetcher.mock.calls[1]![0])).toContain('/group/26?');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
test('empty short query candidates try two more of the same type before the other types', async () => {
  const order: string[] = [];
  const fetcher = fetcherFor(url => {
    if (url.pathname === '/api/search') {
      const type = url.searchParams.get('type') as ScheduleRequestType;
      order.push(type);
      return [1, 2, 3, 4].map(id => candidate(type, id, type + id));
    }
    order.push(url.pathname);
    return url.pathname === '/api/schedule/group/2' ? lessons : [];
  });
  const result = await start('ГП-', fetcher);
  expect(order).toEqual(['person', '/api/schedule/person/1', '/api/schedule/person/2', '/api/schedule/person/3',
    'group', '/api/schedule/group/1', '/api/schedule/group/2']);
  expect(result.scheduleName).toBe('group2');
});
test('empty directory falls back too; query containing a digit never discovers person', async () => {
  const fetcher = fetcherFor(url => url.pathname === '/api/search'
    ? url.searchParams.get('type') === 'group' ? [] : [candidate('auditorium', 1039, 'К-202')]
    : lessons);
  expect((await start('К-2', fetcher)).scheduleName).toBe('К-202');
  expect(fetcher.mock.calls.map(call => String(call[0])).join('\n')).not.toContain('person');
});
test.each([['ГП-', 9, 3], ['К-2', 6, 2], ['Иван', 9, 3], ['Ивано', 1, 1]])('bounded all-empty fallback for %s', async (query, schedules, directories) => {
  const fetcher = fetcherFor(url => url.pathname === '/api/search'
    ? [1, 2, 3, 4].map(id => candidate(url.searchParams.get('type') as ScheduleRequestType, id)) : []);
  const result = await start(query, fetcher);
  expect(result.days).toEqual([]);
  expect(result.scheduleName).toBe('Искомое расписание');
  expect(fetcher.mock.calls.filter(call => String(call[0]).includes('/api/schedule/'))).toHaveLength(schedules);
  expect(fetcher.mock.calls.filter(call => String(call[0]).includes('/api/search?'))).toHaveLength(directories);
});
test('personal schedule requires the exact group and does not fall back to another course', async () => {
  const fetcher = fetcherFor(url => url.pathname === '/api/search'
    ? [candidate('group', 1, 'ГП-04-26'), candidate('group', 2, 'ГП-04-24')] : []);
  const result = await start('ГП-04-24', fetcher, {personal: true});
  expect(result.scheduleName).toBe('ГП-04-24');
  expect(String(fetcher.mock.calls[1]![0])).toContain('/group/2?');
  expect(fetcher).toHaveBeenCalledTimes(2);
  fetcher.mockClear();
  await expect(start('ГП-04-23', fetcher, {personal: true})).rejects.toMatchObject({kind: 'not-found'});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test('saved entry type is preserved even when a room name lacks three consecutive digits', async () => {
  const fetcher = fetcherFor(url => url.pathname === '/api/search' ? [candidate('auditorium', 1, 'Д-40а')] : lessons);
  expect((await start('Д-40а', fetcher, {type: 'auditorium'})).scheduleTarget?.type).toBe('auditorium');
  expect(String(fetcher.mock.calls[0]![0])).toContain('type=auditorium');
});
test.each(['http', 'html', 'json', 'schema', 'network'])('a %s failure is an error, never permission to silently pick another group', async failure => {
  const fetcher = jest.fn(async () => {
    if (failure === 'network') throw new Error('offline');
    return {ok: failure !== 'http', headers: {get: () => failure === 'html' ? 'text/html' : 'application/json'},
      json: async () => { if (failure === 'json') throw new SyntaxError(); return {login: 'required'}; }} as unknown as Response;
  });
  await expect(start('ГП-', fetcher)).rejects.toHaveProperty('kind');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test('invalid lessons are not a successful empty candidate triggering fallback', async () => {
  const fetcher = fetcherFor(url => url.pathname === '/api/search' ? [candidate('person')] : [{date: 'bad'}]);
  await expect(start('ГП-', fetcher)).rejects.toMatchObject({kind: 'invalid-response'});
  expect(fetcher).toHaveBeenCalledTimes(2);
});
describe('deadlines and cancellation, including native fetch/body ignoring abort', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  test.each(['fetch', 'body'])('request deadline settles stalled %s', async stage => {
    const fetcher = jest.fn(async () => stage === 'fetch' ? new Promise<Response>(() => {})
      : {ok: true, json: () => new Promise(() => {}), headers: {get: () => 'application/json'}} as unknown as Response);
    const pending = expect(start('ГП-', fetcher)).rejects.toMatchObject({kind: 'timeout'});
    await jest.advanceTimersByTimeAsync(SCHEDULE_REQUEST_TIMEOUT_MS);
    await pending;
    expect(jest.getTimerCount()).toBe(0);
  });
  test('overall search deadline includes all directory and lesson requests', async () => {
    const fetcher = fetcherFor(async url => {
      await new Promise(resolve => setTimeout(resolve, 9000));
      return url.pathname === '/api/search' ? [1, 2, 3].map(id => candidate('person', id)) : [];
    });
    const pending = expect(start('ГП-', fetcher)).rejects.toMatchObject({kind: 'timeout'});
    await jest.advanceTimersByTimeAsync(SCHEDULE_SEARCH_TIMEOUT_MS);
    await pending;
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  test('external cancellation aborts HTTP and never issues another request', async () => {
    const controller = new AbortController();
    const fetcher = jest.fn(() => new Promise<Response>(() => {})) as unknown as jest.MockedFunction<typeof fetch>;
    const pending = expect(start('ГП-', fetcher, {signal: controller.signal})).rejects.toMatchObject({kind: 'cancelled'});
    controller.abort();
    await pending;
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
