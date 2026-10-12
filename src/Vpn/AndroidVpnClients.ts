import {NativeModules, Platform} from 'react-native';

export type AndroidVpnArchitecture = 'arm64-v8a' | 'armeabi-v7a' | 'x86' | 'x86_64';
export type AndroidVpnClient = Readonly<{
  architecture: AndroidVpnArchitecture;
  client: 'Owenclave' | 'NekoBox';
  version: string;
  apkUrl: string;
  instructionKind: 'owenclave' | 'nekobox';
}>;

const ANDROID_VPN_CLIENTS: Readonly<Record<AndroidVpnArchitecture, AndroidVpnClient>> = {
  'arm64-v8a': {
    architecture: 'arm64-v8a', client: 'Owenclave', version: '0.17.57', instructionKind: 'owenclave',
    apkUrl: 'https://dragonservices.online/apps/android/Owenclave-0.17.57-arm64-v8a.apk',
  },
  'armeabi-v7a': {
    architecture: 'armeabi-v7a', client: 'NekoBox', version: '1.4.2', instructionKind: 'nekobox',
    apkUrl: 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/download/1.4.2/NekoBox-1.4.2-armeabi-v7a.apk',
  },
  x86: {
    architecture: 'x86', client: 'NekoBox', version: '1.4.2', instructionKind: 'nekobox',
    apkUrl: 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/download/1.4.2/NekoBox-1.4.2-x86.apk',
  },
  x86_64: {
    architecture: 'x86_64', client: 'NekoBox', version: '1.4.2', instructionKind: 'nekobox',
    apkUrl: 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/download/1.4.2/NekoBox-1.4.2-x86_64.apk',
  },
};

export const DEFAULT_ANDROID_VPN_CLIENT = ANDROID_VPN_CLIENTS['arm64-v8a'];

const isSupportedArchitecture = (value: unknown): value is AndroidVpnArchitecture => (
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(ANDROID_VPN_CLIENTS, value)
);

export const getAndroidVpnClientForAbis = (nativeAbis: unknown): AndroidVpnClient => {
  if (!Array.isArray(nativeAbis)) return DEFAULT_ANDROID_VPN_CLIENT;
  // Build.SUPPORTED_ABIS is already ordered by the device's preferences.
  const architecture = nativeAbis.find(isSupportedArchitecture);
  return architecture ? ANDROID_VPN_CLIENTS[architecture] : DEFAULT_ANDROID_VPN_CLIENT;
};

export const getAndroidVpnClient = async (): Promise<AndroidVpnClient> => {
  if (Platform.OS !== 'android') return DEFAULT_ANDROID_VPN_CLIENT;
  const deviceArchitecture = NativeModules.DeviceArchitecture as {
    getSupportedAbis?: () => Promise<unknown>;
  } | undefined;
  try {
    return getAndroidVpnClientForAbis(await deviceArchitecture?.getSupportedAbis?.());
  } catch {
    return DEFAULT_ANDROID_VPN_CLIENT;
  }
};
