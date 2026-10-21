import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Alert, Linking, Text, TouchableOpacity, View} from 'react-native';

jest.mock('../src/Common/Globals', () => ({__esModule: true, default: {}, openTelegram: jest.fn()}));
jest.mock('../src/Themes/Themes', () => ({withOpacity: (color: string) => color}));
jest.mock('react-native-paper', () => ({
  useTheme: () => ({colors: {primary: '#222222', surface: '#333333', text: '#ffffff'}}),
  Avatar: {Image: () => null},
}));
jest.mock('react-native-vector-icons/MaterialIcons', () => ({__esModule: true, default: () => null}));
jest.mock('react-native-vector-icons/FontAwesome5', () => ({__esModule: true, default: function MockSocialIcon() { return null; }}));
const {ListAvatarItem} = require('../src/Screens/Settings/Components');
const Icon = require('react-native-vector-icons/FontAwesome5').default;

let tree: ReactTestRenderer.ReactTestRenderer;
let open: jest.SpyInstance;
beforeEach(() => { jest.clearAllMocks(); open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined); });
afterEach(async () => { if (tree) await act(() => tree.unmount()); jest.restoreAllMocks(); });

test('one link keeps the whole card clickable and shows its platform logo', async () => {
  await act(() => { tree = ReactTestRenderer.create(<ListAvatarItem title="Имя Фамилия" link="https://t.me/person" image={{uri: 'avatar'}}/>); });
  expect(tree.root.findByType(Icon).props).toMatchObject({name: 'telegram-plane', brand: true});
  expect(tree.root.findByType(Text).props.children).toBe('Имя\nФамилия');
  expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(1);
  await act(() => tree.root.findByType(TouchableOpacity).props.onPress());
  expect(open).toHaveBeenCalledWith('https://t.me/person');
});

test('several links have individual buttons and the card body has no press handler', async () => {
  await act(() => { tree = ReactTestRenderer.create(<ListAvatarItem title="Имя Фамилия" links={['https://vk.ru/person', 'https://t.me/person', 'https://example.org/person']} image={{uri: 'avatar'}}/>); });
  const buttons = tree.root.findAllByType(TouchableOpacity);
  expect(buttons).toHaveLength(3);
  const root = tree.root.findAllByType(View).find(view => view.props.style?.minHeight === 80)!;
  expect(root.props.onPress).toBeUndefined();
  const rows = tree.root.findAllByType(View).filter(view => view.props.style?.gap === 4 && view.props.style?.flexDirection === 'row');
  expect(rows.map(row => row.findAllByType(TouchableOpacity).length)).toEqual([2, 1]);
  await act(() => buttons[1]!.props.onPress());
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith('https://t.me/person');
  expect(tree.root.findAllByType(Icon).map(icon => icon.props.name)).toEqual(['vk', 'telegram-plane', 'link']);
});

test('the link array is also accepted by the existing link prop, limited to a 2 by 2 grid', async () => {
  await act(() => { tree = ReactTestRenderer.create(<ListAvatarItem title="Имя Фамилия" link={[
    'https://vk.ru/a', 'https://t.me/a', 'https://instagram.com/a', 'https://youtube.com/@a', 'https://tiktok.com/@a',
  ]} image={{uri: 'avatar'}}/>); });
  expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(4);
  const rows = tree.root.findAllByType(View).filter(view => view.props.style?.gap === 4 && view.props.style?.flexDirection === 'row');
  expect(rows.map(row => row.findAllByType(TouchableOpacity).length)).toEqual([2, 2]);
});

test('a missing link does not expose an inert profile button', async () => {
  await act(() => { tree = ReactTestRenderer.create(<ListAvatarItem title="Николай" links={[]} image={{uri: 'avatar'}}/>); });
  expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(0);
});

test('a failed open is caught and explained without an unhandled promise rejection', async () => {
  open.mockRejectedValue(new Error('No activity'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(() => { tree = ReactTestRenderer.create(<ListAvatarItem title="Имя" link="https://example.org/person" image={{uri: 'avatar'}}/>); });
  await act(() => tree.root.findByType(TouchableOpacity).props.onPress());
  expect(alert).toHaveBeenCalledWith('Не удалось открыть ссылку', expect.any(String));
});
