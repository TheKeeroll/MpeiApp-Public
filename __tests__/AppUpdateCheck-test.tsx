import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {AppState, type AppStateStatus} from 'react-native';
import AppUpdateCheck, {isUpdateScreenReady} from '../src/Updates/AppUpdateCheck';
import type {LoginState} from '../src/API/BARS';
import type {AppUpdate, checkForAppUpdate} from '../src/Updates/AppUpdateService';

let mockMarksStatus = 'LOADING';
let mockPrivacyVisible = false;
const mockProfile = {'user-agent': 'chosen-browser', 'sec-ch-ua': 'chosen-client-hint'};
const mockCheck = jest.fn((_options: Parameters<typeof checkForAppUpdate>[0]) => Promise.resolve<AppUpdate | undefined>(undefined));
jest.mock('react-redux', () => ({useSelector: (selector: (state: unknown) => unknown) => selector({MarkTable: {status: mockMarksStatus}})}));
jest.mock('../src/Common/Globals', () => ({__esModule: true, default: {GetBARSBrowserProfile: () => mockProfile}}));
jest.mock('../src/Ads/AdsProvider', () => ({useAds: () => ({isPrivacyModalVisible: mockPrivacyVisible})}));
jest.mock('../src/Updates/AppUpdateService', () => ({checkForAppUpdate: (options: unknown) => mockCheck(options as Parameters<typeof checkForAppUpdate>[0])}));
jest.mock('../src/Updates/AppUpdateModal', () => 'UpdateSheet');

const next: AppUpdate = {version: '2.6.1', releaseNotes: '- Новое', storeName: 'Google Play', storeUrl: 'https://play.google.com/store/apps/details?id=com.mpeiapp'};
const sheetType = 'UpdateSheet' as React.ElementType;

describe('update check scheduling and presentation', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  let onAppState: (state: AppStateStatus) => void;
  const originalState = AppState.currentState;
  beforeEach(() => {
    jest.useFakeTimers();
    mockMarksStatus = 'LOADING';
    mockPrivacyVisible = false;
    mockCheck.mockReset().mockResolvedValue(next);
    AppState.currentState = 'active';
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback =>
      setTimeout(() => callback(Date.now()), 16) as unknown as number);
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => clearTimeout(id));
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      onAppState = listener;
      return {remove: jest.fn()};
    });
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    AppState.currentState = originalState;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  const mount = async (loginState: LoginState = 'NOT_LOGGED_IN') => {
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<AppUpdateCheck loginState={loginState}/>); });
  };
  const rerender = async (loginState: LoginState = 'NOT_LOGGED_IN') => {
    await ReactTestRenderer.act(() => { tree.update(<AppUpdateCheck loginState={loginState}/>); });
  };
  const advance = async (ms: number) => { await ReactTestRenderer.act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
  const state = async (value: AppStateStatus) => {
    AppState.currentState = value;
    await ReactTestRenderer.act(() => onAppState(value));
  };

  it('waits for initial data and two paint frames before checking', async () => {
    await mount('NOT_INITIATED');
    await advance(1000);
    expect(mockCheck).not.toHaveBeenCalled();
    await rerender('AUTHENTICATED_LOADING_DATA');
    await advance(1000);
    expect(mockCheck).not.toHaveBeenCalled();
    await rerender('LOGGED_IN');
    await advance(1000);
    expect(mockCheck).not.toHaveBeenCalled();
    mockMarksStatus = 'LOADED';
    await rerender('LOGGED_IN');
    await advance(16);
    expect(mockCheck).not.toHaveBeenCalled();
    await advance(16);
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(mockCheck.mock.calls[0][0].browserProfile).toEqual(mockProfile);
    await advance(500);
    expect(tree.root.findAllByType(sheetType)).toHaveLength(1);
  });

  it('checks after login-screen paint, and Later suppresses repeated prompts within this opening', async () => {
    await mount();
    await advance(32);
    expect(mockCheck).toHaveBeenCalledTimes(1);
    await advance(500);
    await ReactTestRenderer.act(() => tree.root.findByType(sheetType).props.onLater());
    await rerender('STUDENTS_NOT_FOUND');
    mockMarksStatus = 'LOADED';
    await rerender('LOGGED_IN');
    await advance(1000);
    expect(tree.root.findAllByType(sheetType)).toHaveLength(0);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('queues a found update behind consent and allows native dismissal to complete', async () => {
    mockPrivacyVisible = true;
    await mount();
    await advance(1000);
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(sheetType)).toHaveLength(0);
    mockPrivacyVisible = false;
    await rerender();
    await advance(499);
    expect(tree.root.findAllByType(sheetType)).toHaveLength(0);
    await advance(1);
    expect(tree.root.findAllByType(sheetType)).toHaveLength(1);
  });

  it('checks once on return from background, while system inactive/active transitions do not trigger another check', async () => {
    await mount();
    await advance(32);
    await advance(500);
    await state('inactive');
    await state('active');
    await advance(1000);
    expect(mockCheck).toHaveBeenCalledTimes(1);
    await state('background');
    expect(mockCheck.mock.calls[0][0].signal?.aborted).toBe(true);
    await state('active');
    await advance(32);
    expect(mockCheck).toHaveBeenCalledTimes(2);
  });

  it('ignores late results from an earlier opening', async () => {
    let finishOld: (value: AppUpdate) => void = () => undefined;
    mockCheck.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValueOnce({...next, version: '2.7.0'});
    await mount();
    await advance(32);
    await state('background');
    await state('active');
    await advance(32);
    await advance(500);
    await ReactTestRenderer.act(async () => { finishOld(next); await Promise.resolve(); });
    expect(tree.root.findByType(sheetType).props.update.version).toBe('2.7.0');
  });

  it('waits to present a finished check during authentication without starting again', async () => {
    let finish: (value: AppUpdate) => void = () => undefined;
    mockCheck.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await mount();
    await advance(32);
    await rerender('AUTHENTICATED_LOADING_DATA');
    await ReactTestRenderer.act(async () => { finish(next); await Promise.resolve(); });
    await advance(1000);
    expect(tree.root.findAllByType(sheetType)).toHaveLength(0);
    mockMarksStatus = 'LOADED';
    await rerender('LOGGED_IN');
    await advance(500);
    expect(tree.root.findAllByType(sheetType)).toHaveLength(1);
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it('cancels scheduled startup work on unmount', async () => {
    await mount();
    await ReactTestRenderer.act(() => tree.unmount());
    await advance(1000);
    expect(mockCheck).not.toHaveBeenCalled();
  });
});

test.each([
  ['NOT_LOGGED_IN', 'LOADING', true], ['STUDENTS_NOT_FOUND', 'LOADING', true],
  ['LOGGED_IN', 'LOADING', false], ['LOGGED_IN', 'LOADED', true], ['LOGGED_IN', 'OFFLINE', true], ['LOGGED_IN', 'FAILED', true],
  ['NEED_2FA', 'LOADED', false], ['QUESTIONNAIRES_REQUIRED', 'LOADED', false], ['NOT_INITIATED', 'LOADED', false],
])('waits for a usable screen: %s/%s', (loginState, marksStatus, ready) => {
  expect(isUpdateScreenReady(loginState as LoginState, marksStatus)).toBe(ready);
});
