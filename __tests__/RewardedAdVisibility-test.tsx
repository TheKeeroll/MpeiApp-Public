import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {AppState, ScrollView, View} from 'react-native';

let mockFocused = true;
let mockAdsEnabled = true;
let mockRewardedLeft = 5;
const mockNavigation = {isFocused: () => mockFocused};
const mockCreateRequest = jest.fn(() => ({adUnitId: 'demo-rewarded-yandex'}));
const mockGrant = jest.fn();
const mockLoader = {loadAd: jest.fn(), cancelLoading: jest.fn(() => Promise.resolve())};
jest.mock('yandex-mobile-ads', () => ({RewardedAdLoader: {create: () => Promise.resolve(mockLoader)}}));
jest.mock('@react-navigation/native', () => ({useIsFocused: () => mockFocused, useNavigation: () => mockNavigation}));
jest.mock('@react-navigation/drawer', () => ({DrawerStatusContext: require('react').createContext(undefined)}));
jest.mock('../src/Ads/AdsProvider', () => ({useAds: () => ({adsEnabled: mockAdsEnabled, createAdRequest: mockCreateRequest})}));
const {useRewardedAd} = require('../src/Ads/useRewardedAd');
const {rewardedAdService} = require('../src/Ads/RewardedAdService');
let handle: ReturnType<typeof import('../src/Ads/useRewardedAd').useRewardedAd>;
const Harness = () => {
  handle = useRewardedAd(mockRewardedLeft, mockGrant);
  return <View ref={handle.viewportRef} onLayout={handle.refresh}>
    <ScrollView {...handle.scrollProps}><View ref={handle.slotRef} onLayout={handle.refresh}/></ScrollView>
  </View>;
};
type FakeAd = {show: jest.Mock; onAdShown?: () => void; onRewarded?: () => void; onAdDismissed?: () => void};

describe('rewarded visibility and explicit intent', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  let slotY = 900;
  let ad: FakeAd;
  let appListener: ((state: 'active' | 'background') => void) | undefined;
  const previousState = AppState.currentState;
  const mount = async () => {
    await ReactTestRenderer.act(() => {tree = ReactTestRenderer.create(<Harness/>);});
    handle.viewportRef.current!.measureInWindow = callback => callback(0, 100, 320, 500);
    handle.slotRef.current!.measureInWindow = callback => callback(0, slotY, 300, 120);
    await ReactTestRenderer.act(() => handle.refresh());
  };
  const advance = async (ms: number) => {await ReactTestRenderer.act(() => jest.advanceTimersByTime(ms));};
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    rewardedAdService.reset();
    mockFocused = true;
    mockAdsEnabled = true;
    mockRewardedLeft = 5;
    slotY = 900;
    ad = {show: jest.fn(() => Promise.resolve())};
    mockLoader.loadAd.mockResolvedValue(ad);
    AppState.currentState = 'active';
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appListener = listener;
      return {remove: jest.fn()};
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    // Close a simulated native ad before resetting the singleton for the next test.
    ad.onAdDismissed?.();
    rewardedAdService.reset();
    AppState.currentState = previousState;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not preload an offscreen card and waits 1800 ms of visibility without showing it', async () => {
    await mount();
    await advance(5000);
    expect(mockLoader.loadAd).not.toHaveBeenCalled();
    slotY = 250;
    await ReactTestRenderer.act(() => handle.refresh());
    await advance(1500);
    expect(mockLoader.loadAd).not.toHaveBeenCalled();
    await advance(299);
    expect(mockLoader.loadAd).not.toHaveBeenCalled();
    await advance(1);
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
    expect(handle.state).toBe('LOADED');
    expect(ad.show).not.toHaveBeenCalled();
    await advance(5000);
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
  });
  it('cancels offscreen visibility and starts a new full delay on reentry', async () => {
    slotY = 250;
    await mount();
    await advance(1000);
    slotY = 900;
    await ReactTestRenderer.act(() => handle.refresh());
    await advance(1000);
    expect(mockLoader.loadAd).not.toHaveBeenCalled();
    slotY = 250;
    await ReactTestRenderer.act(() => handle.refresh());
    await advance(1799);
    expect(mockLoader.loadAd).not.toHaveBeenCalled();
    await advance(1);
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
  });
  it.each(['blur', 'background', 'disabled', 'limit'])('cancels the delay on %s', async reason => {
    slotY = 250;
    await mount();
    await advance(1000);
    await ReactTestRenderer.act(() => {
      if (reason === 'blur') mockFocused = false;
      if (reason === 'disabled') mockAdsEnabled = false;
      if (reason === 'limit') mockRewardedLeft = 0;
      if (reason === 'background') appListener!('background');
      tree.update(<Harness/>);
    });
    await advance(2000);
    expect(mockLoader.loadAd).not.toHaveBeenCalled();
  });
  it('re-measures visibility at the deadline rather than using the old visible rectangle', async () => {
    slotY = 250;
    await mount();
    await advance(1799);
    slotY = 900;
    await advance(1);
    expect(mockLoader.loadAd).not.toHaveBeenCalled();
  });
  it('accepts IDLE clicks, skips the delay, shares rapid clicks, and shows only after explicit intent', async () => {
    slotY = 250;
    await mount();
    expect(handle.disabled).toBe(false);
    await ReactTestRenderer.act(async () => {await Promise.all([handle.show(), handle.show()]);});
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
    expect(ad.show).toHaveBeenCalledTimes(1);
    expect(mockGrant).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => {ad.onRewarded!(); ad.onRewarded!();});
    expect(mockGrant).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => ad.onAdDismissed!());
    await advance(5000);
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
  });
  it('never auto-retries FAILED in the same visibility period, but an explicit retry works', async () => {
    mockLoader.loadAd.mockRejectedValueOnce(new Error('no fill'));
    slotY = 250;
    await mount();
    await advance(1800);
    expect(handle.state).toBe('FAILED');
    await ReactTestRenderer.act(() => {tree.update(<Harness/>); handle.refresh();});
    await advance(10000);
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
    expect(handle.disabled).toBe(false);
    await ReactTestRenderer.act(() => handle.show());
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(2);
    expect(ad.show).toHaveBeenCalledTimes(1);
  });
  it('does not show after a pending explicit load if the screen was left', async () => {
    let resolve!: (value: FakeAd) => void;
    mockLoader.loadAd.mockImplementation(() => new Promise(done => {resolve = done;}));
    slotY = 250;
    await mount();
    let showing!: Promise<void>;
    await ReactTestRenderer.act(() => {showing = handle.show();});
    mockFocused = false;
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    await ReactTestRenderer.act(async () => {resolve(ad); await showing;});
    expect(ad.show).not.toHaveBeenCalled();
    expect(mockGrant).not.toHaveBeenCalled();
  });
  it('uses a preloaded ad on a click without requesting another and ignores a reward after ads are disabled', async () => {
    slotY = 250;
    await mount();
    await advance(1800);
    await ReactTestRenderer.act(() => handle.show());
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
    mockAdsEnabled = false;
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    await ReactTestRenderer.act(() => ad.onRewarded!());
    expect(mockGrant).not.toHaveBeenCalled();
  });
  it('unlocks the next explicit action after iOS lifecycle callbacks even with an unresolved native show promise', async () => {
    slotY = 250;
    ad.show.mockImplementationOnce(() => new Promise(() => undefined));
    await mount();
    let showing!: Promise<void>;
    await ReactTestRenderer.act(() => {showing = handle.show();});
    await ReactTestRenderer.act(async () => {ad.onAdShown!(); await showing;});
    expect(handle.disabled).toBe(true);
    await ReactTestRenderer.act(() => {ad.onRewarded!(); ad.onAdDismissed!();});
    expect(handle.disabled).toBe(false);
    await advance(5000);
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => handle.show());
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(2);
  });
});
