import {NativeModules, Platform} from 'react-native';
import {
  DEFAULT_ANDROID_VPN_CLIENT, getAndroidVpnArchitectureForAbis, getAndroidVpnClient,
  resolveAndroidVpnClient, type AndroidVpnArchitecture,
} from '../src/Vpn/AndroidVpnClients';

const latestUrl = 'https://github.com/owenewans/owenclave/releases/latest';
const releaseUrl = 'https://github.com/owenewans/owenclave/releases/tag/v0.18.2';
const mirrorUrl = (abi: string) => `https://dragonservices.online/apps/android/Owenclave-0.17.59-${abi}.apk`;
const architectures: AndroidVpnArchitecture[] = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
const headResponse = (url: string, status = 200, contentType = 'application/octet-stream'): Response => ({
  url, status, ok: status >= 200 && status < 300,
  headers: {get: (name: string) => name === 'content-type' ? contentType : null},
} as Response);
const createFetchMock = () => jest.fn<Promise<Response>, Parameters<typeof fetch>>();

describe('Android VPN client selection', () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
  const nativeModule = NativeModules.DeviceArchitecture;
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {configurable: true, value: 'android'});
    NativeModules.DeviceArchitecture = undefined;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async url =>
      headResponse(String(url), String(url).startsWith('https://dragonservices.online/') ? 200 : 404));
  });
  afterEach(() => {
    if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
    NativeModules.DeviceArchitecture = nativeModule;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('respects Android preference order and skips unsupported entries', () => {
    expect(getAndroidVpnArchitectureForAbis(['unsupported', null, 'x86_64', 'x86'])).toBe('x86_64');
    expect(getAndroidVpnArchitectureForAbis(['armeabi-v7a', 'arm64-v8a'])).toBe('armeabi-v7a');
    expect(getAndroidVpnArchitectureForAbis(['arm64-v8a', 'armeabi-v7a'])).toBe('arm64-v8a');
  });

  it.each([
    {abis: undefined}, {abis: null}, {abis: 'x86'}, {abis: []},
    {abis: [null, 123, 'unsupported']}, {abis: ['toString', '__proto__']},
  ])(
    'defaults to arm64-v8a for invalid ABI data: $abis', ({abis}) => {
      expect(getAndroidVpnArchitectureForAbis(abis)).toBe('arm64-v8a');
    },
  );

  it('uses the native ABI list and handles unavailable or failing native methods', async () => {
    expect(await getAndroidVpnClient()).toEqual(DEFAULT_ANDROID_VPN_CLIENT);
    NativeModules.DeviceArchitecture = {};
    expect(await getAndroidVpnClient()).toEqual(DEFAULT_ANDROID_VPN_CLIENT);
    NativeModules.DeviceArchitecture = {getSupportedAbis: jest.fn().mockRejectedValue(new Error('Unavailable'))};
    expect(await getAndroidVpnClient()).toEqual(DEFAULT_ANDROID_VPN_CLIENT);
    NativeModules.DeviceArchitecture = {getSupportedAbis: jest.fn(async () => ['x86', 'armeabi-v7a'])};
    expect(await getAndroidVpnClient()).toMatchObject({architecture: 'x86', apkUrl: mirrorUrl('x86')});
  });

  it('does not query Android architecture on iOS', async () => {
    Object.defineProperty(Platform, 'OS', {configurable: true, value: 'ios'});
    const getSupportedAbis = jest.fn();
    NativeModules.DeviceArchitecture = {getSupportedAbis};
    expect(await getAndroidVpnClient()).toBe(DEFAULT_ANDROID_VPN_CLIENT);
    expect(getSupportedAbis).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(architectures)('uses the actual latest version and probes only the %s APK without downloading it', async architecture => {
    const fetchMock = createFetchMock().mockImplementation(async url =>
      headResponse(String(url) === latestUrl ? releaseUrl : String(url)));
    const client = await resolveAndroidVpnClient(architecture, fetchMock);
    expect(client).toEqual({
      architecture, client: 'Owenclave', version: '0.18.2', instructionKind: 'owenclave',
      apkUrl: `https://github.com/owenewans/owenclave/releases/download/v0.18.2/Owenclave-0.18.2-${architecture}.apk`,
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([latestUrl, client.apkUrl]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({method: 'HEAD', redirect: 'follow'});
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.body).toBeUndefined();
    }
  });

  it.each([403, 404, 429, 500])('uses the mirror when latest returns HTTP %s', async status => {
    const fetchMock = createFetchMock().mockImplementation(async url =>
      headResponse(String(url), String(url) === latestUrl ? status : 200));
    expect(await resolveAndroidVpnClient('arm64-v8a', fetchMock)).toEqual(DEFAULT_ANDROID_VPN_CLIENT);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([latestUrl, mirrorUrl('arm64-v8a')]);
  });

  it.each(architectures)('uses the matching mirror APK when latest has no working %s asset', async architecture => {
    const fetchMock = createFetchMock().mockImplementation(async url => {
      if (String(url) === latestUrl) return headResponse(releaseUrl);
      return headResponse(String(url), String(url) === mirrorUrl(architecture) ? 200 : 404);
    });
    expect(await resolveAndroidVpnClient(architecture, fetchMock)).toMatchObject({
      architecture, client: 'Owenclave', version: '0.17.59', apkUrl: mirrorUrl(architecture),
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      latestUrl,
      `https://github.com/owenewans/owenclave/releases/download/v0.18.2/Owenclave-0.18.2-${architecture}.apk`,
      mirrorUrl(architecture),
    ]);
  });

  it.each(architectures)('falls back to NekoBox with matching instructions for %s when both Owenclave sources fail', async architecture => {
    const fetchMock = createFetchMock().mockImplementation(async url => headResponse(String(url), 404));
    expect(await resolveAndroidVpnClient(architecture, fetchMock)).toEqual({
      architecture, client: 'NekoBox', version: '1.4.2', instructionKind: 'nekobox',
      apkUrl: `https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/download/1.4.2/NekoBox-1.4.2-${architecture}.apk`,
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([latestUrl, mirrorUrl(architecture)]);
  });

  it.each([
    '', latestUrl, 'https://github.com/login',
    'https://github.com/other/project/releases/tag/v0.18.2',
    'https://github.com/owenewans/owenclave/releases/tag/%ZZ',
    'https://github.com/owenewans/owenclave/releases/tag/not-a-version',
  ])('handles an unusable latest redirect: %s', async redirect => {
    const fetchMock = createFetchMock().mockImplementation(async url =>
      headResponse(String(url) === latestUrl ? redirect : String(url)));
    expect(await resolveAndroidVpnClient('x86', fetchMock)).toMatchObject({apkUrl: mirrorUrl('x86')});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['text/html; charset=utf-8', 'application/json'])('does not mistake a successful %s error page for an APK', async contentType => {
    const fetchMock = createFetchMock().mockImplementation(async url => {
      if (String(url) === latestUrl) return headResponse(releaseUrl);
      return headResponse(String(url), 200, String(url) === mirrorUrl('x86') ? 'application/octet-stream' : contentType);
    });
    expect(await resolveAndroidVpnClient('x86', fetchMock)).toMatchObject({apkUrl: mirrorUrl('x86')});
  });

  it('continues through network failures to the final NekoBox fallback', async () => {
    const fetchMock = createFetchMock().mockRejectedValue(new Error('Network request failed'));
    expect(await resolveAndroidVpnClient('arm64-v8a', fetchMock)).toMatchObject({client: 'NekoBox', architecture: 'arm64-v8a'});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('cancels a stalled source after five seconds and continues even if fetch ignores abort', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchMock = createFetchMock().mockImplementation(async (url, init) => {
      if (String(url) !== latestUrl) return headResponse(String(url));
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const result = resolveAndroidVpnClient('arm64-v8a', fetchMock);
    await jest.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(await result).toEqual(DEFAULT_ANDROID_VPN_CLIENT);
    expect(signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('shares concurrent source checks but checks availability again on a later request', async () => {
    let finishLatest!: (response: Response) => void;
    jest.mocked(fetch).mockImplementation(async url => String(url) === latestUrl
      ? new Promise(resolve => { finishLatest = resolve; }) : headResponse(String(url)));
    const first = getAndroidVpnClient();
    const second = getAndroidVpnClient();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    finishLatest(headResponse(releaseUrl));
    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(b);
    expect(fetch).toHaveBeenCalledTimes(2);
    const next = getAndroidVpnClient();
    await Promise.resolve();
    finishLatest(headResponse(releaseUrl));
    await next;
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
