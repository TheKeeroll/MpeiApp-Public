import {NativeModules, Platform} from 'react-native';

export type AndroidVpnArchitecture = 'arm64-v8a' | 'armeabi-v7a' | 'x86' | 'x86_64';
export type AndroidVpnClient = Readonly<{
  architecture: AndroidVpnArchitecture;
  client: 'Owenclave' | 'NekoBox';
  version: string;
  apkUrl: string;
  instructionKind: 'owenclave' | 'nekobox';
}>;

const ARCHITECTURES: readonly AndroidVpnArchitecture[] = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
const OWENCLAVE_RELEASES_URL = 'https://github.com/owenewans/owenclave/releases';
const MIRROR_DIRECTORY = 'https://dragonservices.online/apps/android';
const MIRROR_VERSION = '0.17.59';
const NEKOBOX_VERSION = '1.4.2';
const SOURCE_TIMEOUT_MS = 5_000;

const createClient = (
  client: AndroidVpnClient['client'],
  version: string,
  architecture: AndroidVpnArchitecture,
  directory: string,
): AndroidVpnClient => ({
  client,
  version,
  architecture,
  apkUrl: `${directory}/${encodeURIComponent(`${client}-${version}-${architecture}.apk`)}`,
  instructionKind: client === 'Owenclave' ? 'owenclave' : 'nekobox',
});

export const DEFAULT_ANDROID_VPN_CLIENT = createClient('Owenclave', MIRROR_VERSION, 'arm64-v8a', MIRROR_DIRECTORY);

const isSupportedArchitecture = (value: unknown): value is AndroidVpnArchitecture => (
  typeof value === 'string' && ARCHITECTURES.includes(value as AndroidVpnArchitecture)
);

export const getAndroidVpnArchitectureForAbis = (nativeAbis: unknown): AndroidVpnArchitecture => {
  if (!Array.isArray(nativeAbis)) return 'arm64-v8a';
  // Build.SUPPORTED_ABIS is already ordered by the device's preferences.
  return nativeAbis.find(isSupportedArchitecture) ?? 'arm64-v8a';
};

const fetchHeaders = async (url: string, fetchImpl: typeof fetch): Promise<Response | undefined> => {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchImpl(url, {method: 'HEAD', redirect: 'follow', signal: controller.signal}),
      new Promise<undefined>(resolve => {
        timeout = setTimeout(() => { controller.abort(); resolve(undefined); }, SOURCE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
};

const isApkAvailable = async (url: string, fetchImpl: typeof fetch): Promise<boolean> => {
  const response = await fetchHeaders(url, fetchImpl);
  if (!response?.ok || response.status === 204) return false;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  // A repository/login/error page with status 200 is not an APK download.
  return !contentType.startsWith('text/') && !contentType.includes('json')
    && response.headers.get('content-length') !== '0';
};

export const resolveAndroidVpnClient = async (
  architecture: AndroidVpnArchitecture,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<AndroidVpnClient> => {
  const latest = await fetchHeaders(`${OWENCLAVE_RELEASES_URL}/latest`, fetchImpl);
  if (latest?.ok) {
    // React Native exposes the final redirect target as response.url.
    const match = /^https:\/\/github\.com\/owenewans\/owenclave\/releases\/tag\/([^/?#]+)\/?(?:[?#].*)?$/iu.exec(latest.url);
    if (match) {
      let tag = '';
      try { tag = decodeURIComponent(match[1]!); } catch { /* Try the mirror below. */ }
      const version = tag.replace(/^v/iu, '');
      if (/^\d+(?:\.\d+)+(?:[-+][A-Za-z0-9.-]+)?$/u.test(version)) {
        const client = createClient('Owenclave', version, architecture, `${OWENCLAVE_RELEASES_URL}/download/${encodeURIComponent(tag)}`);
        if (await isApkAvailable(client.apkUrl, fetchImpl)) return client;
      }
    }
  }

  const mirror = createClient('Owenclave', MIRROR_VERSION, architecture, MIRROR_DIRECTORY);
  if (await isApkAvailable(mirror.apkUrl, fetchImpl)) return mirror;
  return createClient('NekoBox', NEKOBOX_VERSION, architecture,
    `https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/download/${NEKOBOX_VERSION}`);
};

const pendingSelections = new Map<AndroidVpnArchitecture, Promise<AndroidVpnClient>>();

export const getAndroidVpnClient = async (): Promise<AndroidVpnClient> => {
  if (Platform.OS !== 'android') return DEFAULT_ANDROID_VPN_CLIENT;
  const deviceArchitecture = NativeModules.DeviceArchitecture as {
    getSupportedAbis?: () => Promise<unknown>;
  } | undefined;
  let abis: unknown;
  try { abis = await deviceArchitecture?.getSupportedAbis?.(); } catch { /* Default to arm64-v8a. */ }
  const architecture = getAndroidVpnArchitectureForAbis(abis);
  let pending = pendingSelections.get(architecture);
  if (!pending) {
    pending = resolveAndroidVpnClient(architecture).finally(() => pendingSelections.delete(architecture));
    pendingSelections.set(architecture, pending);
  }
  return pending;
};
