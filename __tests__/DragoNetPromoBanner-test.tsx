import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Animated, AppState, TouchableOpacity, View} from 'react-native';
import type {PromoViewport} from '../src/Vpn/DragoNetPromoBanner';

const mockNavigation = {dispatch: jest.fn(), isFocused: () => true, addListener: jest.fn(() => () => undefined)};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  CommonActions: {navigate: (name: string, params: Record<string, unknown>) => ({type: 'NAVIGATE', payload: {name, params}})},
}));
jest.mock('react-native-paper', () => ({useTheme: () => ({colors: {primary: '#222222', accent: '#ffffff'}})}));
jest.mock('../src/Themes/Themes', () => ({withOpacity: (color: string) => color}));
jest.mock('react-native-vector-icons/MaterialIcons', () => ({__esModule: true, default: () => null}));

const DragoNetPromoBanner = require('../src/Vpn/DragoNetPromoBanner').default;
const {dragoNetPromoService} = require('../src/Vpn/DragoNetPromoService');
const {getDragoNetBannerArtFrame} = require('../src/Vpn/DragoNetPromoVisuals');

describe('DragoNet banner native measurements', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  const previousAppState = AppState.currentState;
  const refreshRef = {current: () => undefined};
  const viewportRef = {current: {measureInWindow: (callback: (...args: number[]) => void) => callback(0, 100, 320, 500)}} as unknown as PromoViewport['viewportRef'];
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    AppState.currentState = 'active';
    jest.spyOn(Animated, 'loop').mockReturnValue({start: jest.fn(), stop: jest.fn(), reset: jest.fn()});
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    AppState.currentState = previousAppState;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  const frame = () => tree.root.findAllByType(View).find(node => node.props.style?.maxWidth === 560)!.instance;

  it('counts only measured visibility and opens the nested Settings destination from the whole banner', async () => {
    const opportunity = dragoNetPromoService.createOpportunity(0);
    const record = jest.spyOn(dragoNetPromoService, 'recordImpression');
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<DragoNetPromoBanner opportunity={opportunity} viewportRef={viewportRef} refreshRef={refreshRef}/>); });
    frame().measureInWindow = (callback: (...args: number[]) => void) => callback(0, 700, 320, 120);
    await ReactTestRenderer.act(() => refreshRef.current());
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(500));
    expect(record).not.toHaveBeenCalled();
    frame().measureInWindow = (callback: (...args: number[]) => void) => callback(0, 500, 320, 120);
    await ReactTestRenderer.act(() => refreshRef.current());
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(499));
    expect(record).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(1));
    expect(record).toHaveBeenCalledTimes(1);
    const rendered = JSON.stringify(tree.toJSON());
    expect(rendered).toContain('сервисы РФ доступны без отключения VPN');
    expect(rendered).toContain('от 80 ₽/месяц');
    await ReactTestRenderer.act(() => tree.root.findByType(TouchableOpacity).props.onPress());
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(expect.objectContaining({payload: expect.objectContaining({name: 'other', params: expect.objectContaining({screen: 'settingsMain', pop: true})})}));
    await ReactTestRenderer.act(() => tree.unmount());
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<DragoNetPromoBanner opportunity={opportunity} viewportRef={viewportRef} refreshRef={refreshRef}/>); });
    frame().measureInWindow = (callback: (...args: number[]) => void) => callback(0, 500, 320, 120);
    await ReactTestRenderer.act(() => refreshRef.current());
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(500));
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('discards late measurements from before a newer scroll', async () => {
    const record = jest.spyOn(dragoNetPromoService, 'recordImpression');
    const opportunity = dragoNetPromoService.createOpportunity(0);
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<DragoNetPromoBanner opportunity={opportunity} viewportRef={viewportRef} refreshRef={refreshRef}/>); });
    const pending: Array<(...args: number[]) => void> = [];
    frame().measureInWindow = (callback: (...args: number[]) => void) => pending.push(callback);
    await ReactTestRenderer.act(() => { refreshRef.current(); refreshRef.current(); });
    pending[1]!(0, 700, 320, 120);
    pending[0]!(0, 100, 320, 120);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(500));
    expect(record).not.toHaveBeenCalled();
  });

  it('frames the original portrait art without gaps, including taller font layouts', () => {
    for (const height of [120, 220, 700]) {
      const crop = getDragoNetBannerArtFrame(320, height, 941, 1430);
      expect(crop.width).toBeGreaterThanOrEqual(320);
      expect(crop.height).toBeGreaterThanOrEqual(height);
      expect(crop.top).toBeLessThanOrEqual(0);
      expect(crop.top + crop.height).toBeGreaterThanOrEqual(height);
    }
  });
});
