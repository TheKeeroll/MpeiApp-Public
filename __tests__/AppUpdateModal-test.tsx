import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {AccessibilityInfo, Linking, Modal, Text, TouchableOpacity} from 'react-native';
import AppUpdateModal, {APP_UPDATE_WARNING} from '../src/Updates/AppUpdateModal';
import {APP_STORE_PAGES} from '../src/Common/Constants';

jest.mock('react-native-paper', () => ({DefaultTheme: {colors: {}}, useTheme: () => ({colors: {
  text: '#EEEEEE', textUnderline: '#AA88FF', accent: '#00FF00', error: '#FF0500', warning: '#FFFF00',
  primary: '#333333', background: '#222222', surface: '#444444',
}})}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: React.PropsWithChildren) => <>{children}</>,
  SafeAreaView: ({children}: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'UpdateIcon');
jest.mock('../src/Common/Globals', () => ({__esModule: true, default: {}}));

describe('update modal', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  const onLater = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });
  afterEach(async () => {
    if (tree) await ReactTestRenderer.act(() => tree.unmount());
    jest.restoreAllMocks();
  });
  const mount = async (platform: 'android' | 'ios' = 'android') => {
    const store = APP_STORE_PAGES[platform];
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<AppUpdateModal
      update={{version: '2.6.1', releaseNotes: '- Первый пункт\n- Последний пункт', storeName: store.name, storeUrl: store.url}}
      onLater={onLater}/>); });
  };
  const button = (title: string) => tree.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === title)!;

  it.each(['android', 'ios'] as const)('opens the checked %s URL and displays full notes and the exact warning', async platform => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await mount(platform);
    expect(tree.root.findAllByType(Text).some(node => node.props.children === '- Первый пункт\n- Последний пункт')).toBe(true);
    const warning = tree.root.findAllByType(Text).find(node => node.props.children === APP_UPDATE_WARNING)!;
    expect(warning.props.style.color).toBe('#FFFF00');
    await ReactTestRenderer.act(async () => { await button(`Обновить через ${APP_STORE_PAGES[platform].name}`).props.onPress(); });
    expect(open).toHaveBeenCalledWith(APP_STORE_PAGES[platform].url);
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('keeps Later available when the store link fails and allows retry', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('No handler')).mockResolvedValue(undefined);
    await mount();
    await ReactTestRenderer.act(async () => { await button('Обновить через Google Play').props.onPress(); });
    expect(onLater).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(Text).some(node => node.props.accessibilityRole === 'alert')).toBe(true);
    expect(button('Позже').props.disabled).not.toBe(true);
    await ReactTestRenderer.act(async () => { await button('Обновить через Google Play').props.onPress(); });
    expect(open).toHaveBeenCalledTimes(2);
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('treats Android Back as Later', async () => {
    await mount();
    await ReactTestRenderer.act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onLater).toHaveBeenCalledTimes(1);
  });
});
