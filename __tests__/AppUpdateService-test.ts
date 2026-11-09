import fs from 'fs';
import path from 'path';
import {APP_STORE_PAGES, BARS_BROWSER_PROFILES} from '../src/Common/Constants';
import {checkForAppUpdate, STORE_REQUEST_TIMEOUT_MS} from '../src/Updates/AppUpdateService';

const google = fs.readFileSync(path.join(__dirname, 'fixtures/store-pages/google-play-current.html'), 'utf8');
const apple = fs.readFileSync(path.join(__dirname, 'fixtures/store-pages/app-store-current.html'), 'utf8');
const response = (html = google, ok = true) => ({ok, text: jest.fn(async () => html)}) as unknown as Response;

describe('bounded background update requests', () => {
  let fetcher: jest.MockedFunction<typeof fetch>;
  beforeEach(() => { jest.useFakeTimers(); fetcher = jest.fn(); });
  afterEach(() => jest.useRealTimers());
  const check = (extra: Partial<Parameters<typeof checkForAppUpdate>[0]> = {}) => checkForAppUpdate({
    platform: 'android', currentVersion: 'v2.4.0-preview', browserProfile: BARS_BROWSER_PROFILES[4], fetcher, ...extra,
  });

  it.each([['android', google], ['ios', apple]] as const)('uses the selected browser identity and exact %s URL without BARS session headers', async (platform, html) => {
    fetcher.mockResolvedValue(response(html));
    const result = await check({platform});
    expect(result).toMatchObject({version: '2.5.0', storeUrl: APP_STORE_PAGES[platform].url, storeName: APP_STORE_PAGES[platform].name});
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(APP_STORE_PAGES[platform].url);
    expect(init?.credentials).toBe('omit');
    expect(init?.headers).toMatchObject(BARS_BROWSER_PROFILES[4]);
    for (const key of ['origin', 'referer', 'cookie', 'authorization', 'content-length']) expect(init?.headers).not.toHaveProperty(key);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['2.5.0', 'v2.5.0-preview', '2.6.0'])('does not announce or retry an equal/older release for %s', async currentVersion => {
    fetcher.mockResolvedValue(response());
    expect(await check({currentVersion})).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries HTTP and parser errors after exactly 1 and then 3 seconds', async () => {
    fetcher.mockResolvedValueOnce(response('', false)).mockResolvedValueOnce(response('<html>CAPTCHA</html>')).mockResolvedValueOnce(response());
    const result = check();
    await jest.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(2999);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect((await result)?.version).toBe('2.5.0');
  });

  it('silently stops after three network failures', async () => {
    fetcher.mockRejectedValue(new Error('Offline'));
    const result = check();
    await jest.runAllTimersAsync();
    expect(await result).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['headers', 'body'])('bounds stalled %s even if fetch ignores abort', async stage => {
    const pending = new Promise<Response>(() => undefined);
    fetcher.mockImplementation(() => stage === 'headers' ? pending
      : Promise.resolve({ok: true, text: () => new Promise<string>(() => undefined)} as Response));
    const result = check();
    await jest.advanceTimersByTimeAsync(STORE_REQUEST_TIMEOUT_MS * 3 + 4000);
    expect(await result).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [, init] of fetcher.mock.calls) expect(init?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['request', 'retry'])('cancels a pending %s without more calls', async stage => {
    const controller = new AbortController();
    fetcher.mockImplementation(() => stage === 'request' ? new Promise(() => undefined) : Promise.reject(new Error('Offline')));
    const result = check({signal: controller.signal});
    await jest.advanceTimersByTimeAsync(0);
    controller.abort();
    expect(await result).toBeUndefined();
    await jest.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('skips unsupported platforms, invalid local versions and already cancelled checks', async () => {
    const controller = new AbortController(); controller.abort();
    for (const extra of [{platform: 'windows'}, {currentVersion: 'unknown'}, {signal: controller.signal}]) {
      expect(await check(extra)).toBeUndefined();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
