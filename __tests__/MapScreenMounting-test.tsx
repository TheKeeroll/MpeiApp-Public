import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {AppState, LayoutAnimation, PermissionsAndroid, Platform, Text, TouchableOpacity, View} from 'react-native';
import type {AppStateStatus} from 'react-native';

const mockRequestPermission = jest.fn(() => Promise.resolve('granted'));
const mockFindRoutes = jest.fn();
const mockSetLocation = jest.fn();
const mockRecordUse = jest.fn();

jest.mock('react-native-yamap', () => {
  const ReactModule = require('react');
  const Map = ReactModule.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    ReactModule.useImperativeHandle(ref, () => ({
      setCenter: jest.fn(),
      findPedestrianRoutes: mockFindRoutes,
    }));
    return ReactModule.createElement('Yamap', props);
  });
  Map.init = jest.fn();
  return {
    __esModule: true,
    default: Map,
    Marker: (props: Record<string, unknown>) => ReactModule.createElement('MapMarker', props),
    Polyline: (props: Record<string, unknown>) => ReactModule.createElement('MapPolyline', props),
  };
});
jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    requestAuthorization: () => mockRequestPermission(),
    getCurrentPosition: (onSuccess: (position: unknown) => void) => onSuccess({coords: {latitude: 55.7, longitude: 37.7}}),
  },
}));
jest.mock('react-native-paper', () => ({
  useTheme: () => ({dark: true, colors: {text: '#fff', background: '#000', primary: '#333', surface: '#222', marks: {'5': '#0f0'}}}),
  Switch: (props: Record<string, unknown>) => require('react').createElement('CategorySwitch', props),
  Avatar: {Image: () => null},
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children}: {children: React.ReactNode}) => <>{children}</>,
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('../src/Ads/AdsProvider', () => ({useAds: () => ({setSessionLocation: mockSetLocation})}));
jest.mock('../src/Loyalty/LoyaltyProvider', () => ({useLoyalty: () => ({getFeatureStatus: () => ({canStart: true}), recordSuccessfulFeatureUse: mockRecordUse})}));
jest.mock('../src/Loyalty/DailyUsageBadge', () => () => null);
jest.mock('../src/Loyalty/LoyaltyAlerts', () => ({showInsufficientTokensAlert: jest.fn()}));
jest.mock('../src/Screens/LoadingScreen/LoadingScreen.tsx', () => () => null);
jest.mock('../src/Themes/Themes', () => ({withOpacity: (color: string) => color}));
jest.mock('../src/Common/Constants', () => ({SCREEN_SIZE: {width: 400, height: 800}}));
jest.mock('../src/config/Secrets', () => ({YANDEX_MAPS_API_KEY: 'test-key'}));
jest.mock('react-native-vector-icons/Feather', () => () => null);
jest.mock('react-native-vector-icons/FontAwesome5', () => () => null);
jest.mock('react-native-vector-icons/MaterialIcons', () => () => null);
jest.mock('react-native-vector-icons/Ionicons', () => () => null);

const MapScreen = require('../src/Screens/Map/MapScreen').default;
const hostType = (name: string) => name as React.ElementType;

describe.each(['android', 'ios'] as const)('map object lifetime on %s', platform => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  let layoutAnimation: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', platform);
    if (platform === 'android') {
      jest.spyOn(Platform, 'Version', 'get').mockReturnValue(35);
      jest.spyOn(PermissionsAndroid, 'request').mockImplementation(async () => {
        const status = await mockRequestPermission();
        return status === 'granted' ? PermissionsAndroid.RESULTS.GRANTED : PermissionsAndroid.RESULTS.DENIED;
      });
    }
    layoutAnimation = jest.spyOn(LayoutAnimation, 'configureNext');
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const mapView = () => tree.root.findByType(hostType('Yamap'));
  const markers = () => tree.root.findAllByType(hostType('MapMarker'));
  const expectSameInstances = (actual: ReactTestRenderer.ReactTestInstance[], previous: ReactTestRenderer.ReactTestInstance[]) => {
    expect(actual).toHaveLength(previous.length);
    actual.forEach((node, index) => expect(node).toBe(previous[index]));
  };
  const markerIdentity = (marker: ReactTestRenderer.ReactTestInstance) => `${marker.props.point.lat}:${marker.props.point.lon}`;
  const pressButton = async (label: string) => {
    const button = tree.root.findAllByType(TouchableOpacity).find(node =>
      node.findAllByType(Text).some(text => text.props.children === label));
    expect(button).toBeDefined();
    await ReactTestRenderer.act(() => button!.props.onPress());
  };
  const loadMap = async () => {
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<MapScreen navigation={{}} route={{}}/>);
    });
    const root = tree.root.findAllByType(View).find(node => typeof node.props.onLayout === 'function');
    await ReactTestRenderer.act(() => root!.props.onLayout({nativeEvent: {layout: {x: 0, y: 0, width: 400, height: 800}}}));
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(350));
    await ReactTestRenderer.act(() => mapView().props.onMapLoaded());
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(50));
    expect(markers().length).toBeGreaterThan(1);
  };

  it('keeps existing native markers on parent updates and opening/closing place details', async () => {
    await loadMap();
    const initial = markers();
    await ReactTestRenderer.act(() => tree.update(<MapScreen navigation={{}} route={{}}/>));
    expectSameInstances(markers(), initial);
    await ReactTestRenderer.act(() => markers()[0].props.onPress());
    expectSameInstances(markers(), initial);
    const dismiss = tree.root.findAllByType(TouchableOpacity).find(node => node.props.style?.flexGrow === 1);
    await ReactTestRenderer.act(() => dismiss!.props.onPress());
    expectSameInstances(markers(), initial);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(layoutAnimation).not.toHaveBeenCalled();
  });

  it('removes only the switched category and preserves all remaining marker instances', async () => {
    await loadMap();
    const initial = new Map(markers().map(marker => [markerIdentity(marker), marker]));
    await pressButton('Что ищем?');
    const toggle = tree.root.findAllByType(hostType('CategorySwitch')).find(node => node.props.value === true);
    await ReactTestRenderer.act(() => toggle!.props.onValueChange(false));
    const remaining = markers();
    expect(remaining.length).toBeLessThan(initial.size);
    expect(remaining.length).toBeGreaterThan(0);
    for (const marker of remaining) expect(marker).toBe(initial.get(markerIdentity(marker)));
    expect(layoutAnimation).not.toHaveBeenCalled();
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('rechecks permission after returning from system settings, without rebuilding map markers', async () => {
    let onAppStateChange: (state: AppStateStatus) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      onAppStateChange = listener;
      return {remove};
    });
    mockRequestPermission.mockResolvedValueOnce('denied');
    await loadMap();
    const initial = markers();
    await ReactTestRenderer.act(() => markers()[0].props.onPress());
    expect(tree.root.findAllByType(Text).some(node => node.props.children === 'Проложить маршрут')).toBe(false);
    await ReactTestRenderer.act(() => onAppStateChange('background'));
    await ReactTestRenderer.act(async () => onAppStateChange('active'));
    expect(mockRequestPermission).toHaveBeenCalledTimes(2);
    expectSameInstances(markers(), initial);
    await ReactTestRenderer.act(() => markers()[0].props.onPress());
    expect(tree.root.findAllByType(Text).some(node => node.props.children === 'Проложить маршрут')).toBe(true);
    await ReactTestRenderer.act(() => tree.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('preserves route segments during unrelated renders and removes them when the route is cancelled', async () => {
    mockFindRoutes.mockImplementation((_points, onResult) => onResult({status: 'success', routes: [{sections: [
      {points: [{lat: 55.7, lon: 37.7}, {lat: 55.8, lon: 37.7}], routeInfo: {time: '3 мин'}},
      {points: [{lat: 55.8, lon: 37.7}, {lat: 55.8, lon: 37.8}], routeInfo: {time: '3 мин'}},
    ]}]}));
    await loadMap();
    await ReactTestRenderer.act(() => markers()[0].props.onPress());
    await pressButton('Проложить маршрут');
    const segments = tree.root.findAllByType(hostType('MapPolyline'));
    expect(segments).toHaveLength(2);
    await ReactTestRenderer.act(() => tree.update(<MapScreen navigation={{}} route={{}}/>));
    expectSameInstances(tree.root.findAllByType(hostType('MapPolyline')), segments);
    await ReactTestRenderer.act(() => mapView().props.onMapLongPress({nativeEvent: {lat: 55.9, lon: 37.9}}));
    expectSameInstances(tree.root.findAllByType(hostType('MapPolyline')), segments);
    await pressButton('Отмена');
    expect(tree.root.findAllByType(hostType('MapPolyline'))).toHaveLength(0);
    expect(mapView().children.some(child => typeof child === 'string')).toBe(false);
    expect(layoutAnimation).not.toHaveBeenCalled();
    expect(mockRecordUse).toHaveBeenCalledWith('route');
  });
});
