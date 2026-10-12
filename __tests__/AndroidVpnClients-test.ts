import {NativeModules, Platform} from 'react-native';
import {DEFAULT_ANDROID_VPN_CLIENT, getAndroidVpnClient, getAndroidVpnClientForAbis} from '../src/Vpn/AndroidVpnClients';

describe('Android VPN client selection', () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
  const nativeModule = NativeModules.DeviceArchitecture;
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {configurable: true, value: 'android'});
    NativeModules.DeviceArchitecture = undefined;
  });
  afterEach(() => {
    if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
    NativeModules.DeviceArchitecture = nativeModule;
  });

  it('respects Android preference order and skips unsupported entries', () => {
    expect(getAndroidVpnClientForAbis(['unsupported', null, 'x86_64', 'x86']).architecture).toBe('x86_64');
    expect(getAndroidVpnClientForAbis(['armeabi-v7a', 'arm64-v8a']).client).toBe('NekoBox');
    expect(getAndroidVpnClientForAbis(['arm64-v8a', 'armeabi-v7a'])).toBe(DEFAULT_ANDROID_VPN_CLIENT);
  });

  it.each([
    {abis: undefined}, {abis: null}, {abis: 'x86'}, {abis: []},
    {abis: [null, 123, 'unsupported']}, {abis: ['toString', '__proto__']},
  ])(
    'falls back to the saved arm64 Owenclave for invalid ABI data: $abis', ({abis}) => {
      expect(getAndroidVpnClientForAbis(abis)).toBe(DEFAULT_ANDROID_VPN_CLIENT);
    },
  );

  it('uses the native ABI list and handles unavailable or failing native methods', async () => {
    expect(await getAndroidVpnClient()).toBe(DEFAULT_ANDROID_VPN_CLIENT);
    NativeModules.DeviceArchitecture = {};
    expect(await getAndroidVpnClient()).toBe(DEFAULT_ANDROID_VPN_CLIENT);
    NativeModules.DeviceArchitecture = {getSupportedAbis: jest.fn().mockRejectedValue(new Error('Unavailable'))};
    expect(await getAndroidVpnClient()).toBe(DEFAULT_ANDROID_VPN_CLIENT);
    NativeModules.DeviceArchitecture = {getSupportedAbis: jest.fn(async () => ['x86', 'armeabi-v7a'])};
    expect(await getAndroidVpnClient()).toEqual(getAndroidVpnClientForAbis(['x86']));
  });

  it('does not query Android architecture on iOS', async () => {
    Object.defineProperty(Platform, 'OS', {configurable: true, value: 'ios'});
    const getSupportedAbis = jest.fn();
    NativeModules.DeviceArchitecture = {getSupportedAbis};
    expect(await getAndroidVpnClient()).toBe(DEFAULT_ANDROID_VPN_CLIENT);
    expect(getSupportedAbis).not.toHaveBeenCalled();
  });
});
