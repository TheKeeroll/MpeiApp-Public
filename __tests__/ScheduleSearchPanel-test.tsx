import React from 'react';
import Renderer, {act} from 'react-test-renderer';
import {Animated, LayoutAnimation, TextInput, Text, TouchableOpacity} from 'react-native';
import {ScheduleSearchLibrary, type SavedSchedule} from '../src/Schedule/ScheduleSearchLibrary';

let mockLibrary: ScheduleSearchLibrary;
jest.mock('react-native-paper', () => ({TextInput: require('react-native').TextInput,
  useTheme: () => ({colors: {surface: '#333333', background: '#222222', text: '#ffffff', textUnderline: '#00ff00'}})}));
jest.mock('../src/Themes/Themes', () => ({withOpacity: (color: string) => color}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../src/Loyalty/DailyUsageBadge', () => 'DailyUsageBadge');
jest.mock('../src/Schedule/useScheduleSearchLibrary', () => ({useScheduleSearchLibrary: () => ({store: mockLibrary,
  ...require('react').useSyncExternalStore(mockLibrary.subscribe, mockLibrary.getSnapshot, mockLibrary.getSnapshot)})}));
const Panel = require('../src/Screens/Schedule/ScheduleSearchPanel').default;
const teacher: SavedSchedule = {id: '3999', type: 'person', name: 'Подкопаева Виктория Александровна'};
let tree: Renderer.ReactTestRenderer;
const onSearch = jest.fn();
const button = (label: string) => tree.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === label)!;
const expand = async () => { await act(() => tree.root.findAllByType(TouchableOpacity)[0]!.props.onPress()); };
beforeEach(async () => {
  mockLibrary = new ScheduleSearchLibrary({getString: () => undefined, set: () => {}});
  onSearch.mockClear();
  await act(() => { tree = Renderer.create(<Panel onSearch={onSearch}/>); });
});
afterEach(async () => { await act(() => tree.unmount()); });
test('button and keyboard share the trimmed three-character guard', async () => {
  await expand();
  const submit = () => tree.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityState?.disabled !== undefined)!;
  await act(() => tree.root.findByType(TextInput).props.onChangeText(' К '));
  expect(submit().props.disabled).toBe(true);
  await act(() => tree.root.findByType(TextInput).props.onSubmitEditing());
  expect(onSearch).not.toHaveBeenCalled();
  await act(() => tree.root.findByType(TextInput).props.onChangeText(' К-2 '));
  expect(submit().props.disabled).toBe(false);
  const submitFromKeyboard = tree.root.findByType(TextInput).props.onSubmitEditing;
  await act(() => { submitFromKeyboard(); submitFromKeyboard(); });
  expect(onSearch).toHaveBeenCalledWith('К-2', undefined);
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
});
test('compact teacher label submits full name/type; group and auditorium names are not truncated', async () => {
  await act(() => {
    mockLibrary.remember(teacher);
    mockLibrary.remember({id: '1', type: 'group', name: 'ИЭоз-31м-25'});
    mockLibrary.remember({id: '2', type: 'auditorium', name: 'НТБ-300'});
  });
  await expand();
  const texts = tree.root.findAllByType(Text).map(node => node.props.children);
  expect(texts).toEqual(expect.arrayContaining(['Подкопаева В.', 'ИЭоз-31м-25', 'НТБ-300']));
  await act(() => button(`Найти расписание: ${teacher.name}`).props.onPress());
  expect(onSearch).toHaveBeenCalledWith(teacher.name, 'person');
});
test('add/delete are independent actions; adding disappears at five and reappears after deleting a favorite', async () => {
  await act(() => mockLibrary.remember(teacher)); await expand();
  await act(() => button(`В избранное: ${teacher.name}`).props.onPress());
  expect(onSearch).not.toHaveBeenCalled();
  expect(mockLibrary.getSnapshot().favorites).toEqual([teacher]);
  await act(() => button(`Удалить из последних: ${teacher.name}`).props.onPress());
  expect(mockLibrary.getSnapshot().favorites).toEqual([teacher]);
  await act(() => {
    mockLibrary.remember({id: '8', type: 'auditorium', name: 'Д-407'});
    for (let i = 1; i <= 4; i++) mockLibrary.addFavorite({id: String(i), type: 'group', name: `ГП-04-${i}`});
  });
  expect(button('В избранное: Д-407')).toBeUndefined();
  await act(() => button(`Удалить из избранного: ${teacher.name}`).props.onPress());
  expect(button('В избранное: Д-407')).toBeDefined();
  expect(onSearch).not.toHaveBeenCalled();
});
test('expanding/submitting keeps the native list hierarchy still and stops the local fade on close', async () => {
  const layout = jest.spyOn(LayoutAnimation, 'configureNext');
  const start = jest.fn(); const stop = jest.fn();
  jest.spyOn(Animated, 'timing').mockReturnValue({start, stop, reset: jest.fn()});
  try {
    expect(start).not.toHaveBeenCalled();
    await expand();
    expect(start).toHaveBeenCalledTimes(1);
    expect(layout).not.toHaveBeenCalled();
    await act(() => tree.root.findByType(TextInput).props.onChangeText('  A-01  '));
    await act(() => tree.root.findAllByType(TouchableOpacity)[1]!.props.onPress());
    expect(onSearch).toHaveBeenCalledWith('A-01', undefined);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(layout).not.toHaveBeenCalled();
  } finally { jest.restoreAllMocks(); }
});
