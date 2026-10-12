import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Linking, NativeModules, Platform, Text, TouchableOpacity} from 'react-native';

jest.mock('react-native-paper', () => ({
  useTheme: () => ({
    colors: {
      accent: '#ffffff',
      background: '#111111',
      backdrop: '#222222',
      highlight: '#333333',
      primary: '#444444',
      surface: '#555555',
      text: '#ffffff',
      textUnderline: '#00ffff',
    },
  }),
}));
jest.mock('../src/Themes/Themes', () => ({withOpacity: (color: string) => color}));
jest.mock('react-native-vector-icons/MaterialIcons', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('react-native-vector-icons/FontAwesome', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/Vpn/VpnSubscriptionRuntime', () => ({
  dragonetTelegramUrl: 'https://t.me/example',
  vpnSubscriptionService: {
    getSnapshot: () => ({verificationState: {technicalFailureStreak: 0, inactiveStreak: 0, lastEffectiveStatus: 'NONE'}}),
    subscribe: () => () => undefined,
  },
}));

const {
  ConnectionInstructions,
  DemoResultSheet,
  DemoSubscriptionLink,
} = require('../src/Screens/Settings/DragoNetPromoCard');

const access = {
  demoSubURL: 'https://sub.dragonet.example/demo/student',
  receivedAt: '2026-09-12T10:00:00.000Z',
};

describe('DragoNet result sheet', () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
  const nativeModule = NativeModules.DeviceArchitecture;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {configurable: true, value: 'android'});
    NativeModules.DeviceArchitecture = undefined;
  });
  afterEach(() => {
    if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
    NativeModules.DeviceArchitecture = nativeModule;
    jest.restoreAllMocks();
  });

  it('copies a subscription link when its whole row, including its icon, is pressed', async () => {
    const onCopy = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <DemoSubscriptionLink
          access={access}
          copied={false}
          onCopy={onCopy}
          instructionsExpanded={false}
          onToggleInstructions={jest.fn()}
        />,
      );
    });

    tree!.root.findByProps({accessibilityLabel: 'Скопировать ссылку подписки'}).props.onPress();
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(tree!.root.findAll(node => node.props.accessibilityState?.expanded === false)).not.toHaveLength(0);
    expect(JSON.stringify(tree!.toJSON())).not.toContain('Загрузить APK');
    await ReactTestRenderer.act(() => tree!.unmount());
  });

  it('keeps the sheet empty without a demo access record', async () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <DemoResultSheet
          visible
          access={undefined}
          copied={false}
          onCopy={jest.fn()}
          instructionsExpanded={false}
          onToggleInstructions={jest.fn()}
          onClose={jest.fn()}
        />,
      );
    });
    expect(tree!.toJSON()).toBeNull();
    await ReactTestRenderer.act(() => tree!.unmount());
  });

  it.each([
    ['arm64-v8a', 'Owenclave', '0.17.57', 'https://dragonservices.online/apps/android/Owenclave-0.17.57-arm64-v8a.apk'],
    ['armeabi-v7a', 'NekoBox', '1.4.2', 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/download/1.4.2/NekoBox-1.4.2-armeabi-v7a.apk'],
    ['x86', 'NekoBox', '1.4.2', 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/download/1.4.2/NekoBox-1.4.2-x86.apk'],
    ['x86_64', 'NekoBox', '1.4.2', 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/download/1.4.2/NekoBox-1.4.2-x86_64.apk'],
  ])('matches the Android %s APK to its client and instructions', async (abi, client, version, apkUrl) => {
    NativeModules.DeviceArchitecture = {getSupportedAbis: jest.fn(async () => [abi])};
    // Real Android can open browser URLs even when canOpenURL reports false.
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<ConnectionInstructions expanded onToggle={jest.fn()}/>);
    });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain(client);
    expect(rendered).toContain(version);
    expect(rendered).toContain('Часть конфигураций у вас может не работать');
    expect(rendered).toContain('Инструкции для других платформ');
    if (client === 'NekoBox') {
      expect(rendered).toContain('Импорт из буфера обмена');
      expect(rendered).toContain('URL Тест');
      expect(rendered).not.toContain('Groups');
    } else {
      expect(rendered).toContain('Groups');
      expect(rendered).not.toContain('URL Тест');
    }
    const download = tree!.root.findAllByType(TouchableOpacity).find(node => node.findAllByType(Text).some(text => text.props.children === 'Загрузить APK'))!;
    expect(download.props.disabled).toBe(false);
    await ReactTestRenderer.act(() => download.props.onPress());
    expect(open).toHaveBeenCalledWith(apkUrl);
    expect(NativeModules.DeviceArchitecture.getSupportedAbis).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => tree!.unmount());
  });

  it('disables APK download and withholds client instructions until the ABI is resolved', async () => {
    let resolveAbis!: (value: unknown) => void;
    NativeModules.DeviceArchitecture = {getSupportedAbis: jest.fn(() => new Promise(resolve => { resolveAbis = resolve; }))};
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<ConnectionInstructions expanded onToggle={jest.fn()}/>);
    });
    const download = () => tree!.root.findAllByType(TouchableOpacity).find(node => node.findAllByType(Text).some(text => text.props.children === 'Загрузить APK'))!;
    expect(download().props.disabled).toBe(true);
    expect(JSON.stringify(tree!.toJSON())).not.toMatch(/Groups|NekoBox|Owenclave/u);
    await ReactTestRenderer.act(() => download().props.onPress());
    expect(open).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => resolveAbis(['x86_64']));
    expect(download().props.disabled).toBe(false);
    expect(JSON.stringify(tree!.toJSON())).toContain('NekoBox');
    expect(JSON.stringify(tree!.toJSON())).toContain('Импорт из буфера обмена');
    await ReactTestRenderer.act(() => tree!.unmount());
  });

  it('renders iOS instructions with the App Store button', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', {configurable: true, value: 'ios'});
    try {
      let tree: ReactTestRenderer.ReactTestRenderer;
      await ReactTestRenderer.act(() => {
        tree = ReactTestRenderer.create(<ConnectionInstructions expanded onToggle={jest.fn()}/>);
      });
      const rendered = JSON.stringify(tree!.toJSON());
      expect(rendered).toContain('Открыть в App Store');
      expect(rendered).not.toContain('Загрузить APK');
      await ReactTestRenderer.act(() => tree!.unmount());
    } finally {
      if (platformDescriptor) {
        Object.defineProperty(Platform, 'OS', platformDescriptor);
      }
    }
  });
});
