import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {AccessibilityInfo, AppState, Linking, Modal, PermissionsAndroid, Platform, Switch, TouchableOpacity} from 'react-native';
import {MobileAds} from 'yandex-mobile-ads';
import Geolocation from 'react-native-geolocation-service';
import BARSAPI from '../src/Common/Globals';
import {STORAGE_KEYS} from '../src/Common/Constants';
import {AdsProvider, useAds} from '../src/Ads/AdsProvider';
import AdPrivacyModal from '../src/Ads/AdPrivacyModal';
import AdPrivacySettingsButton from '../src/Ads/AdPrivacySettingsButton';
import {DEFAULT_AD_PRIVACY, PRIVACY_POLICY_URL, readAdPrivacy, saveAdPrivacy} from '../src/Ads/AdPrivacyPreferences';
import {createAdsTargeting} from '../src/Ads/AdTargeting';
import {rewardedAdService} from '../src/Ads/RewardedAdService';

type PermissionResult = Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>;

const mockStorage = new Map<string, string>();
let mockAdsRemovalUnlocked = false;
jest.mock('../src/Common/Globals', () => ({
  __esModule: true,
  default: {
    mStorage: {
      getString: (key: string) => mockStorage.get(key),
      set: (key: string, value: string) => mockStorage.set(key, value),
      remove: (key: string) => mockStorage.delete(key),
    },
    mCurrentData: {student: {name: 'Анна', group: 'А-01-24'}},
  },
}));
jest.mock('../src/Loyalty/LoyaltyProvider', () => ({useLoyalty: () => ({adsRemovalUnlocked: mockAdsRemovalUnlocked})}));
jest.mock('../src/Ads/AdUnitIds', () => ({getYandexAdUnitId: () => 'demo-banner-yandex'}));
jest.mock('../src/Ads/RewardedAdService', () => ({rewardedAdService: {reset: jest.fn()}}));
jest.mock('react-native-geolocation-service', () => ({
  __esModule: true, default: {requestAuthorization: jest.fn(() => Promise.resolve('granted'))},
}));
jest.mock('yandex-mobile-ads', () => ({
  MobileAds: {
    initialize: jest.fn(() => Promise.resolve()), enableLogging: jest.fn(),
    setUserConsent: jest.fn(), setLocationConsent: jest.fn(), setAgeRestrictedUser: jest.fn(),
  },
  Gender: {Male: 'male', Female: 'female'},
  Location: class {
    lat: number;
    lon: number;
    constructor(lat: number, lon: number) { this.lat = lat; this.lon = lon; }
  },
}));
jest.mock('react-native-paper', () => ({DefaultTheme: {colors: {}}, useTheme: () => ({colors: {
  text: '#EEEEEE', textUnderline: '#AA88FF', accent: '#00FF00', error: '#FF0500',
  primary: '#333333', background: '#222222', surface: '#444444',
}})}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: React.PropsWithChildren) => <>{children}</>,
  SafeAreaView: ({children}: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'PrivacyIcon');
jest.mock('react-native-vector-icons/MaterialIcons', () => 'SettingsIcon');

let ads: ReturnType<typeof useAds>;
const Probe = () => { ads = useAds(); return <AdPrivacySettingsButton/>; };

describe('advertising privacy choices', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  const originalAppState = AppState.currentState;
  beforeEach(() => {
    mockStorage.clear();
    mockAdsRemovalUnlocked = false;
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'android');
    AppState.currentState = 'active';
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      'android.permission.ACCESS_COARSE_LOCATION': PermissionsAndroid.RESULTS.GRANTED,
      'android.permission.ACCESS_FINE_LOCATION': PermissionsAndroid.RESULTS.DENIED,
    } as PermissionResult);
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    jest.restoreAllMocks();
    AppState.currentState = originalAppState;
  });
  const mount = async () => {
    await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<AdsProvider><Probe/></AdsProvider>); });
  };
  const button = (label: string) => tree.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === label)!;
  const adult = () => button('Я совершеннолетний(-яя)');
  const accept = () => button('Согласиться');
  const press = async (callback: () => unknown) => { await ReactTestRenderer.act(async () => { await callback(); }); };
  const refuse = () => tree.root.findByType(AdPrivacyModal).props.onSave({...DEFAULT_AD_PRIVACY});
  const allow = (locationSharing = false) => saveAdPrivacy({...DEFAULT_AD_PRIVACY, adultConfirmed: true, personalizedAds: true, locationSharing});

  it('shows the new explanation for legacy grants without initializing ads; both opt-ins start off', async () => {
    BARSAPI.mStorage.set(STORAGE_KEYS.AD_USER_CONSENT, 'GRANTED');
    await mount();
    expect(tree.root.findAllByType(Modal)).toHaveLength(1);
    expect(adult().props.accessibilityState.checked).toBe(false);
    expect(accept().props.disabled).toBe(true);
    expect(tree.root.findByType(Switch).props.disabled).toBe(true);
    expect(MobileAds.initialize).not.toHaveBeenCalled();
    expect(MobileAds.setUserConsent).toHaveBeenLastCalledWith(false);
    expect(MobileAds.setLocationConsent).toHaveBeenLastCalledWith(false);
    expect(ads.createAdRequest('inlineBannerMarks')).toBeUndefined();
  });

  it('can refuse without confirming adulthood, then serve ads without personal data', async () => {
    await mount();
    const decline = tree.root.findAllByType(TouchableOpacity).find(node => node.findAllByType(require('react-native').Text)
      .some(text => text.props.children === 'Отказаться'))!;
    expect(decline.props.disabled).not.toBe(true);
    await press(decline.props.onPress);
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    expect(readAdPrivacy()).toEqual(DEFAULT_AD_PRIVACY);
    expect(ads.adsEnabled).toBe(true);
    expect(ads.createAdRequest('inlineBannerMarks')?.targeting).toEqual({});
    expect(MobileAds.setAgeRestrictedUser).toHaveBeenLastCalledWith(true);
  });

  it('enables personalization only after adulthood and keeps location off', async () => {
    await mount();
    await press(adult().props.onPress);
    expect(accept().props.disabled).toBe(false);
    expect(tree.root.findByType(Switch).props.disabled).toBe(false);
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    await press(accept().props.onPress);
    expect(ads.isPersonalizedTargetingEnabled).toBe(true);
    expect(ads.isAdLocationSharingEnabled).toBe(false);
    expect(MobileAds.setUserConsent).toHaveBeenLastCalledWith(true);
    expect(MobileAds.setLocationConsent).toHaveBeenLastCalledWith(false);
    expect(MobileAds.setAgeRestrictedUser).toHaveBeenLastCalledWith(false);
    await press(() => ads.setSessionLocation({lat: 55.7, lon: 37.7}));
    expect(ads.createAdRequest('inlineBannerMarks')?.targeting).toEqual({age: expect.any(String), gender: 'female'});
  });

  it('requests foreground location on opt-in, accepts approximate access and saves only on agreement', async () => {
    await mount();
    await press(adult().props.onPress);
    await press(() => tree.root.findByType(Switch).props.onValueChange(true));
    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION, PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    expect(MobileAds.setLocationConsent).toHaveBeenLastCalledWith(false);
    expect(readAdPrivacy()).toBeUndefined();
    await press(accept().props.onPress);
    expect(MobileAds.setLocationConsent).toHaveBeenLastCalledWith(true);
    await press(() => ads.setSessionLocation({lat: 55.7, lon: 37.7}));
    expect(ads.createAdRequest('inlineBannerMarks')?.targeting?.location).toEqual({lat: 55.7, lon: 37.7});
  });

  it('does not prompt again when system location permission already exists', async () => {
    jest.mocked(PermissionsAndroid.check).mockResolvedValue(true);
    await mount();
    await press(adult().props.onPress);
    await press(() => tree.root.findByType(Switch).props.onValueChange(true));
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
  });

  it('requests only when-in-use access on iOS and handles restricted access', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.mocked(Geolocation.requestAuthorization).mockResolvedValue('restricted');
    await mount();
    await press(adult().props.onPress);
    await press(() => tree.root.findByType(Switch).props.onValueChange(true));
    expect(Geolocation.requestAuthorization).toHaveBeenCalledWith('whenInUse');
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
    await press(accept().props.onPress);
    expect(readAdPrivacy()?.locationSharing).toBe(true);
    expect(ads.createAdRequest('inlineBannerMarks')?.targeting).not.toHaveProperty('location');
  });

  it('keeps location consent for later after a system denial without adding coordinates', async () => {
    jest.mocked(PermissionsAndroid.requestMultiple).mockResolvedValue({
      'android.permission.ACCESS_COARSE_LOCATION': PermissionsAndroid.RESULTS.DENIED,
      'android.permission.ACCESS_FINE_LOCATION': PermissionsAndroid.RESULTS.DENIED,
    } as PermissionResult);
    await mount();
    await press(adult().props.onPress);
    await press(() => tree.root.findByType(Switch).props.onValueChange(true));
    await press(accept().props.onPress);
    expect(readAdPrivacy()?.locationSharing).toBe(true);
    expect(ads.createAdRequest('inlineBannerMarks')?.targeting).not.toHaveProperty('location');
  });

  it('removes location opt-in when adulthood is unchecked and disables agreement', async () => {
    allow(true);
    await mount();
    await press(ads.openAdPrivacySettings);
    expect(adult().props.accessibilityState.checked).toBe(true);
    expect(tree.root.findByType(Switch).props.value).toBe(true);
    await press(adult().props.onPress);
    expect(accept().props.disabled).toBe(true);
    expect(tree.root.findByType(Switch).props.value).toBe(false);
    expect(tree.root.findByType(Switch).props.disabled).toBe(true);
  });

  it('reopens saved preferences, blocks stale request callbacks and revokes SDK consent and preloads immediately', async () => {
    allow(true);
    await mount();
    await press(() => ads.setSessionLocation({lat: 55.7, lon: 37.7}));
    const staleRequest = ads.createAdRequest;
    await press(ads.openAdPrivacySettings);
    expect(staleRequest('inlineBannerMarks')).toBeUndefined();
    const revision = ads.privacyRevision;
    await press(refuse);
    expect(ads.privacyRevision).toBe(revision + 1);
    expect(MobileAds.setUserConsent).toHaveBeenLastCalledWith(false);
    expect(MobileAds.setLocationConsent).toHaveBeenLastCalledWith(false);
    expect(rewardedAdService.reset).toHaveBeenCalled();
    expect(ads.createAdRequest('inlineBannerMarks')?.targeting).toEqual({});
    await press(ads.openAdPrivacySettings);
    await press(adult().props.onPress);
    await press(accept().props.onPress);
    expect(ads.createAdRequest('inlineBannerMarks')?.targeting).not.toHaveProperty('location');
  });

  it('never resurrects old coordinates through a retained callback after consent changes', async () => {
    allow(true);
    await mount();
    await press(() => ads.setSessionLocation({lat: 55.7, lon: 37.7}));
    const oldRequest = ads.createAdRequest;
    expect(oldRequest('inlineBannerMarks')?.targeting).toHaveProperty('location');
    await press(ads.openAdPrivacySettings);
    await press(accept().props.onPress);
    expect(oldRequest('inlineBannerMarks')?.targeting).not.toHaveProperty('location');
  });

  it('lets ad-free users change preferences from settings and cancel without saving', async () => {
    mockAdsRemovalUnlocked = true;
    allow();
    await mount();
    expect(ads.adsEnabled).toBe(false);
    await press(ads.openAdPrivacySettings);
    await press(adult().props.onPress);
    await press(tree.root.findByType(AdPrivacyModal).props.onCancel);
    expect(readAdPrivacy()?.adultConfirmed).toBe(true);
    expect(ads.isPersonalizedTargetingEnabled).toBe(true);
  });

  it('opens the supplied privacy policy link', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await mount();
    const policy = tree.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityRole === 'link')!;
    await press(policy.props.onPress);
    expect(open).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
  });

  it('treats corrupt and outdated storage as requiring a new choice and clamps inconsistent opt-ins', () => {
    for (const raw of ['broken', '{}', 'null', '{"version":0,"adultConfirmed":true,"personalizedAds":true,"locationSharing":true}']) {
      mockStorage.set(STORAGE_KEYS.AD_PRIVACY_PREFERENCES, raw);
      expect(readAdPrivacy()).toBeUndefined();
    }
    saveAdPrivacy({...DEFAULT_AD_PRIVACY, personalizedAds: true, locationSharing: true});
    expect(readAdPrivacy()).toEqual(DEFAULT_AD_PRIVACY);
    expect(createAdsTargeting({lat: 55, lon: 37})).toEqual({});
    expect(createAdsTargeting({lat: 55, lon: 37}, true, false)).not.toHaveProperty('location');
    expect(createAdsTargeting({lat: NaN, lon: 37}, true, true)).not.toHaveProperty('location');
  });
});
