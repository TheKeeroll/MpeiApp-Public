import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {AppState, ScrollView, StyleSheet, View} from 'react-native';
import InlineBannerAd from '../src/Ads/InlineBannerAd';
import {YANDEX_INLINE_AD_PLACEMENTS} from '../src/Ads/AdPlacements';

let mockFocused = true;
let mockAdsEnabled = true;
const mockNavigation = {isFocused: () => mockFocused};
const mockCreateRequest = jest.fn(() => ({adUnitId: 'demo-banner-yandex'}));
const mockInlineSize = jest.fn((width: number, _height: number) => Promise.resolve({width, height: 120}));
const mockBannerMount = jest.fn();
jest.mock('@react-navigation/native', () => ({useIsFocused: () => mockFocused, useNavigation: () => mockNavigation}));
jest.mock('@react-navigation/drawer', () => ({DrawerStatusContext: require('react').createContext(undefined)}));
jest.mock('../src/Ads/AdsProvider', () => ({useAds: () => ({adsEnabled: mockAdsEnabled, createAdRequest: mockCreateRequest})}));
jest.mock('yandex-mobile-ads', () => ({
  BannerAdSize: {inlineSize: (width: number, height: number) => mockInlineSize(width, height)},
  BannerView: (props: Record<string, unknown>) => {
    const react = require('react');
    react.useEffect(() => {mockBannerMount();}, []);
    return react.createElement('NativeBanner', props);
  },
}));
const {DrawerStatusContext} = require('@react-navigation/drawer');
const {useDeferredInlineAd} = require('../src/Ads/useDeferredInlineAd');
let mockHandle: ReturnType<typeof import('../src/Ads/useDeferredInlineAd').useDeferredInlineAd>;
const Harness = ({surface = 'screen', drawer}: {surface?: 'screen' | 'drawer'; drawer?: string}) => (
  <DrawerStatusContext.Provider value={drawer}><Body surface={surface}/></DrawerStatusContext.Provider>
);
const Body = ({surface}: {surface: 'screen' | 'drawer'}) => {
  const ad = useDeferredInlineAd(surface === 'drawer' ? 'inlineBannerDrawer' : 'inlineBannerMarks', surface);
  mockHandle = ad;
  return <View ref={ad.viewportRef} collapsable={false} onLayout={ad.onViewportLayout}>
    <ScrollView {...ad.scrollProps}>{ad.banner}</ScrollView>
  </View>;
};

describe('deferred inline native requests', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  let slotY = 1300;
  const previousState = AppState.currentState;
  const event = (y: number) => ({nativeEvent: {contentOffset: {y}}});
  const scroll = () => tree.root.findByType(ScrollView).props;
  const measure = () => {
    mockHandle.viewportRef.current!.measureInWindow = callback => callback(0, 100, 320, 500);
    const anchor = tree.root.findAllByType(View).find(node => node.props.style?.width === '100%')!;
    anchor.instance.measureInWindow = (callback: (...args: number[]) => void) => callback(0, slotY, 320, 0);
  };
  const mount = async (props = {}) => {
    await ReactTestRenderer.act(() => {tree = ReactTestRenderer.create(<Harness {...props}/>);});
    measure();
    await ReactTestRenderer.act(() => mockHandle.onViewportLayout());
  };
  const layoutNative = async (width = 320.8) => {
    const view = tree.root.findAllByType(View).find(node => Array.isArray(node.props.style))!;
    await ReactTestRenderer.act(async () => {view.props.onLayout({nativeEvent: {layout: {width}}});});
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
    mockAdsEnabled = true;
    slotY = 1300;
    AppState.currentState = 'active';
    mockInlineSize.mockImplementation(width => Promise.resolve({width, height: 120}));
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    AppState.currentState = previousState;
    jest.restoreAllMocks();
  });

  it('requires a user scroll near the slot; mount/layout/programmatic scroll and a top gesture do not load', async () => {
    await mount();
    expect(mockCreateRequest).not.toHaveBeenCalled();
    slotY = 700;
    await ReactTestRenderer.act(() => scroll().onScroll(event(600)));
    expect(mockCreateRequest).not.toHaveBeenCalled();
    slotY = 1300;
    await ReactTestRenderer.act(() => {
      scroll().onScrollBeginDrag(event(0));
      scroll().onScroll(event(10));
      scroll().onScrollEndDrag(event(10));
    });
    expect(mockCreateRequest).not.toHaveBeenCalled();
    slotY = 849;
    await ReactTestRenderer.act(() => scroll().onScroll(event(500)));
    await layoutNative();
    expect(mockInlineSize).toHaveBeenCalledWith(320, 250);
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
    const banner = tree.root.findByType('NativeBanner' as React.ElementType);
    expect(banner.props.style.height).toBe(120);
    expect(tree.root.findAllByType(View).some(node => StyleSheet.flatten(node.props.style)?.height === 120)).toBe(true);
    await ReactTestRenderer.act(() => {
      scroll().onScroll(event(550));
      mockHandle.onViewportLayout();
      tree.update(<Harness/>);
    });
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
  });
  it('requires an open Drawer and starts a fresh visit only after reopening and another user scroll', async () => {
    slotY = 700;
    await mount({surface: 'drawer', drawer: 'closed'});
    await ReactTestRenderer.act(() => {
      scroll().onScrollBeginDrag(event(0)); scroll().onScroll(event(10));
    });
    expect(mockCreateRequest).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => tree.update(<Harness surface="drawer" drawer="open"/>));
    expect(mockCreateRequest).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => {scroll().onScrollBeginDrag(event(0)); scroll().onScroll(event(10));});
    await layoutNative();
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => tree.update(<Harness surface="drawer" drawer="closed"/>));
    expect(tree.root.findAllByType('NativeBanner' as React.ElementType)).toHaveLength(0);
    await ReactTestRenderer.act(() => tree.update(<Harness surface="drawer" drawer="open"/>));
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => {scroll().onScrollBeginDrag(event(10)); scroll().onScroll(event(20));});
    await layoutNative();
    expect(mockBannerMount).toHaveBeenCalledTimes(2);
  });
  it('collapses on failure and never retries on scroll, provider changes, or layout during the same visit', async () => {
    slotY = 700;
    await mount();
    await ReactTestRenderer.act(() => {scroll().onScrollBeginDrag(event(0)); scroll().onScroll(event(10));});
    await layoutNative();
    await ReactTestRenderer.act(() => tree.root.findByType('NativeBanner' as React.ElementType).props.onAdFailedToLoad({nativeEvent: {code: 'no-fill'}}));
    expect(tree.root.findAllByType('NativeBanner' as React.ElementType)).toHaveLength(0);
    await ReactTestRenderer.act(() => {scroll().onScroll(event(30)); tree.update(<Harness/>); mockHandle.onViewportLayout();});
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
    expect(mockInlineSize).toHaveBeenCalledTimes(1);
  });
  it('drops a late size calculation after focus loss or ads disabling', async () => {
    let resolve!: (size: {width: number; height: number}) => void;
    mockInlineSize.mockImplementation(() => new Promise(done => {resolve = done;}));
    slotY = 700;
    await mount();
    await ReactTestRenderer.act(() => {scroll().onScrollBeginDrag(event(0)); scroll().onScroll(event(10));});
    await layoutNative();
    mockAdsEnabled = false;
    await ReactTestRenderer.act(() => tree.update(<Harness/>));
    await ReactTestRenderer.act(() => resolve({width: 320, height: 120}));
    expect(mockBannerMount).not.toHaveBeenCalled();
  });
  it('suppresses the marks slot while an open Drawer covers the screen', async () => {
    slotY = 700;
    await mount({drawer: 'open'});
    await ReactTestRenderer.act(() => {scroll().onScrollBeginDrag(event(0)); scroll().onScroll(event(20));});
    expect(mockCreateRequest).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => tree.update(<Harness drawer="closed"/>));
    expect(mockCreateRequest).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => {scroll().onScrollBeginDrag(event(20)); scroll().onScroll(event(30));});
    await layoutNative();
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
  });
  it('keeps a consumed attempt across a real footer remount', async () => {
    const attempt = {started: false, failed: false};
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<InlineBannerAd placement="inlineBannerMarks" attempt={attempt}/>);
    });
    await layoutNative();
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => tree.unmount());
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<InlineBannerAd placement="inlineBannerMarks" attempt={attempt}/>);
    });
    expect(tree.toJSON()).toBeNull();
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
  });
  it('keeps native dimensions and scales a loaded banner into a smaller rotated viewport without a new request', async () => {
    slotY = 700;
    await mount();
    await ReactTestRenderer.act(() => {scroll().onScrollBeginDrag(event(0)); scroll().onScroll(event(10));});
    await layoutNative(640);
    await ReactTestRenderer.act(() => tree.root.findByType('NativeBanner' as React.ElementType).props.onAdLoaded());
    await layoutNative(320);
    const banner = tree.root.findByType('NativeBanner' as React.ElementType);
    expect(banner.props.size).toEqual({width: 640, height: 120});
    expect(banner.props.style.transform).toContainEqual({scale: .5});
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
    expect(mockInlineSize).toHaveBeenCalledTimes(1);
  });
  it.each(Object.values(YANDEX_INLINE_AD_PLACEMENTS))('provides nonzero loading dimensions for %s and collapses after an error', async placement => {
    await ReactTestRenderer.act(() => {tree = ReactTestRenderer.create(<InlineBannerAd placement={placement}/>);});
    expect(mockBannerMount).not.toHaveBeenCalled();
    await layoutNative();
    expect(mockCreateRequest).toHaveBeenCalledWith(placement);
    expect(mockBannerMount).toHaveBeenCalledTimes(1);
    const banner = tree.root.findByType('NativeBanner' as React.ElementType);
    expect(banner.props.size).toEqual({width: 320, height: 120});
    expect(tree.root.findAllByType(View).some(node => StyleSheet.flatten(node.props.style)?.height === 120)).toBe(true);
    await ReactTestRenderer.act(() => banner.props.onAdFailedToLoad({nativeEvent: {code: 'no-fill'}}));
    expect(tree.toJSON()).toBeNull();
  });
});
