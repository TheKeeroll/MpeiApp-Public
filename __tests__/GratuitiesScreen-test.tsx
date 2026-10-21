import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AccessibilityInfo, Animated, AppState, ScrollView, TouchableOpacity, View} from 'react-native';
import type {GratitudeCategory} from '../src/Screens/Settings/GratitudeSection';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({useIsFocused: () => mockFocused}));
jest.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 0, bottom: 24, left: 0, right: 0})}));
jest.mock('react-native-paper', () => ({
  useTheme: () => ({colors: {primary: '#222222', surface: '#333333', text: '#ffffff', background: '#000000'}}),
  Avatar: {Image: function MockAvatar() { return null; }},
}));
jest.mock('../src/Themes/Themes', () => ({withOpacity: (color: string) => color}));
jest.mock('../src/Screens/CommonComponents/DrawerHeader', () => ({NavigationHeader: () => null}));
jest.mock('../src/Screens/Settings/Components', () => ({ListAvatarItem: function MockPerson() { return null; }}));
jest.mock('react-native-vector-icons/MaterialIcons', () => ({__esModule: true, default: () => null}));

const {GratitudeSection} = require('../src/Screens/Settings/GratitudeSection');
const {GratitudeAvatarStrip} = require('../src/Screens/Settings/GratitudeAvatarStrip');
const GratuitiesScreen = require('../src/Screens/Settings/GratuitiesScreen').default;
const {GRATITUDE_CATEGORIES} = require('../src/Screens/Settings/GratuitiesData');
const Person = require('../src/Screens/Settings/Components').ListAvatarItem;
const Avatar = require('react-native-paper').Avatar.Image;

const category = (count: number, invite = false): GratitudeCategory => ({
  id: 'test', title: 'Test category',
  people: [
    ...Array.from({length: count}, (_, index) => ({title: `Person ${index}`, image: {uri: `avatar${index}`}, links: [`https://t.me/person${index}`]})),
    ...(invite ? [{title: 'You can help too', image: {uri: 'unknown'}, links: ['https://example.org'], isCallToAction: true}] : []),
  ],
});
let tree: ReactTestRenderer.ReactTestRenderer;
let stateChanged: (state: string) => void;
let motionChanged: (enabled: boolean) => void;
const previousAppState = AppState.currentState;
let start: jest.Mock, stop: jest.Mock, removeState: jest.Mock, removeMotion: jest.Mock;
beforeEach(() => {
  jest.useFakeTimers();
  mockFocused = true;
  AppState.currentState = 'active';
  start = jest.fn(); stop = jest.fn(); removeState = jest.fn(); removeMotion = jest.fn();
  jest.spyOn(Animated, 'loop').mockReturnValue({start, stop, reset: jest.fn()});
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, callback) => {
    motionChanged = callback as (enabled: boolean) => void;
    return {remove: removeMotion};
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    stateChanged = callback as (state: string) => void;
    return {remove: removeState};
  });
});
afterEach(async () => {
  if (tree) await act(() => tree.unmount());
  AppState.currentState = previousAppState;
  jest.restoreAllMocks();
  jest.useRealTimers();
});
const header = () => tree.root.findAllByType(TouchableOpacity)[0]!;
const strip = () => tree.root.findAllByType(View).find(view => view.props.accessibilityElementsHidden && view.props.onLayout)!;
const measureStrip = async (width: number) => { await act(() => strip().props.onLayout({nativeEvent: {layout: {width, height: 48}}})); };

test('three participants start collapsed, and the title and footer both toggle the complete list', async () => {
  await act(() => { tree = ReactTestRenderer.create(<GratitudeSection category={category(3, true)} maxHeight={600} active/>); });
  expect(header().props.accessibilityState.expanded).toBe(false);
  expect(tree.root.findAllByType(Person)).toHaveLength(0);
  expect(tree.root.findAllByType(Avatar)).toHaveLength(3);
  await act(() => header().props.onPress());
  expect(tree.root.findAllByType(Person)).toHaveLength(4);
  expect(tree.root.findAllByType(Avatar)).toHaveLength(0);
  await act(() => tree.root.findAllByType(TouchableOpacity)[1]!.props.onPress());
  expect(header().props.accessibilityState.expanded).toBe(false);
  await act(() => header().props.onPress());
  await act(() => header().props.onPress());
  expect(tree.root.findAllByType(Person)).toHaveLength(0);
});

test('an invitation is not counted as a person for the initial collapse threshold', async () => {
  await act(() => { tree = ReactTestRenderer.create(<GratitudeSection category={category(2, true)} maxHeight={600} active/>); });
  expect(header().props.accessibilityState.expanded).toBe(true);
  expect(tree.root.findAllByType(Person)).toHaveLength(3);
  expect(tree.root.findAllByType(Person)[2]!.props.multilineTitle).toBe(false);
});

test('the expanded section leaves space for its measured controls and scrolls only on overflow', async () => {
  await act(() => { tree = ReactTestRenderer.create(<GratitudeSection category={category(20)} maxHeight={600} active/>); });
  await act(() => header().props.onPress());
  await act(() => {
    header().props.onLayout({nativeEvent: {layout: {height: 70}}});
    tree.root.findAllByType(TouchableOpacity)[1]!.props.onLayout({nativeEvent: {layout: {height: 46}}});
  });
  let list = tree.root.findByType(ScrollView);
  expect(list.props.style.maxHeight).toBe(484);
  expect(list.props.nestedScrollEnabled).toBe(true);
  await act(() => list.props.onContentSizeChange(300, 400));
  expect(tree.root.findByType(ScrollView).props.scrollEnabled).toBe(false);
  await act(() => list.props.onContentSizeChange(300, 1800));
  expect(tree.root.findByType(ScrollView).props.scrollEnabled).toBe(true);
  await act(() => tree.update(<GratitudeSection category={category(20)} maxHeight={300} active/>));
  list = tree.root.findByType(ScrollView);
  expect(list.props.style.maxHeight).toBe(184);
  expect(tree.root.findAllByType(View).some(view => view.props.style?.maxHeight === 300)).toBe(true);
});

test('the screen caps sections at 75% of the display or the available viewport and preserves all entries', async () => {
  let height = 800;
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockImplementation(() => ({width: 400, height, scale: 1, fontScale: 1}));
  await act(() => { tree = ReactTestRenderer.create(<GratuitiesScreen navigation={{}} route={{}}/>); });
  expect(GRATITUDE_CATEGORIES).toHaveLength(10);
  expect(GRATITUDE_CATEGORIES.flatMap((item: GratitudeCategory) => item.people)).toHaveLength(46);
  expect(tree.root.findAllByType(GratitudeSection).every(section => section.props.maxHeight === 600)).toBe(true);
  const viewport = tree.root.findAllByType(View).find(view => view.props.style?.flex === 1 && view.props.onLayout)!;
  await act(() => viewport.props.onLayout({nativeEvent: {layout: {height: 500}}}));
  expect(tree.root.findAllByType(GratitudeSection).every(section => section.props.maxHeight === 500)).toBe(true);
  height = 400; mockFocused = false;
  await act(() => tree.update(<GratuitiesScreen navigation={{}} route={{}}/>));
  expect(tree.root.findAllByType(GratitudeSection).every(section => section.props.maxHeight === 300 && !section.props.active)).toBe(true);
});

test('fitting avatars stay still, while overflow has a second copy for a continuous slow cycle', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  await act(() => { tree = ReactTestRenderer.create(<GratitudeAvatarStrip people={category(3).people} active/>); });
  await measureStrip(200);
  expect(start).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(Avatar)).toHaveLength(3);
  await measureStrip(120);
  expect(start).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({toValue: -168, duration: 10500, useNativeDriver: true, isInteraction: false}));
  expect(tree.root.findAllByType(Avatar)).toHaveLength(6);
  await measureStrip(200);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(Avatar)).toHaveLength(3);
});

test('motion stops off screen, in the background, with Reduce Motion, and on unmount', async () => {
  const people = category(4).people;
  await act(() => { tree = ReactTestRenderer.create(<GratitudeAvatarStrip people={people} active/>); });
  await measureStrip(100);
  await act(() => tree.update(<GratitudeAvatarStrip people={people} active={false}/>));
  expect(stop).toHaveBeenCalledTimes(1);
  await act(() => tree.update(<GratitudeAvatarStrip people={people} active/>));
  await act(() => stateChanged('background'));
  expect(stop).toHaveBeenCalledTimes(2);
  await act(() => stateChanged('active'));
  await act(() => motionChanged(true));
  expect(stop).toHaveBeenCalledTimes(3);
  await act(() => motionChanged(false));
  await act(() => tree.unmount());
  expect(stop).toHaveBeenCalledTimes(4);
  expect(removeMotion).toHaveBeenCalledTimes(1);
  expect(removeState).toHaveBeenCalledTimes(1);
});

test('the system Reduce Motion preference also prevents the first animation', async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
  await act(async () => { tree = ReactTestRenderer.create(<GratitudeAvatarStrip people={category(4).people} active/>); });
  await measureStrip(100);
  expect(start).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(Avatar)).toHaveLength(4);
});
