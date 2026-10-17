import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Alert, Linking, Modal, NativeModules, Platform, ScrollView, Text, TouchableOpacity} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

const mockRequestDemo = jest.fn();
jest.mock('../src/Vpn/DragoNetPromoVisuals', () => ({DRAGONET_PROMO_ART: 1, DragoNetSlogan: () => null, PromoAppIconsMarquee: () => null}));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => React.createElement('SafeAreaProvider', null, children),
    SafeAreaView: ({children, ...props}: {children: React.ReactNode}) => React.createElement('SafeAreaView', props, children),
  };
});

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
    requestDemo: () => mockRequestDemo(),
  },
}));

const {
  default: DragoNetPromoCard,
  ConnectionInstructions,
  DemoResultSheet,
  DemoSubscriptionLink,
} = require('../src/Screens/Settings/DragoNetPromoCard');

const access = {
  demoSubURL: 'https://sub.dragonet.example/demo/student',
  receivedAt: '2026-09-12T10:00:00.000Z',
};
const headResponse = (url: string, status = 200): Response => ({
  url, status, ok: status >= 200 && status < 300,
  headers: {get: (name: string) => name === 'content-type' ? 'application/octet-stream' : null},
} as Response);

describe('DragoNet result sheet', () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
  const nativeModule = NativeModules.DeviceArchitecture;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {configurable: true, value: 'android'});
    NativeModules.DeviceArchitecture = undefined;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async url => headResponse(String(url), 404));
  });
  afterEach(() => {
    if (platformDescriptor) Object.defineProperty(Platform, 'OS', platformDescriptor);
    NativeModules.DeviceArchitecture = nativeModule;
    jest.restoreAllMocks();
  });

  it.each([
    ['cooldown', /раз в две недели/u, /месяц/u],
    ['service_error', /извинения.*восстановим.*позже/u, /злоупотреблений|две недели/u],
    ['offline', /Проверьте подключение/u, /злоупотреблений|восстановим/u],
  ])('shows the actual demo failure in the card Alert: %s', async (kind, expected, absent) => {
    mockRequestDemo.mockResolvedValue({kind});
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<DragoNetPromoCard/>); });
    const button = tree!.root.findAllByType(TouchableOpacity).find(node =>
      node.findAllByType(Text).some(text => text.props.children === 'Бесплатный демо-доступ'));
    expect(button).toBeDefined();
    await ReactTestRenderer.act(async () => button!.props.onPress());
    expect(mockRequestDemo).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]![1]).toMatch(expected);
    expect(alert.mock.calls[0]![1]).not.toMatch(absent);
    await ReactTestRenderer.act(() => tree!.unmount());
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

  it('protects the sheet footer with its own modal safe area and keeps Done outside scrolling instructions', async () => {
    const onClose = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<DemoResultSheet
        visible access={access} copied={false} onCopy={jest.fn()}
        instructionsExpanded onToggleInstructions={jest.fn()} onClose={onClose}
      />);
    });
    const modal = tree!.root.findByType(Modal);
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(modal.props.statusBarTranslucent).toBe(true);
    const sheet = modal.findByType(SafeAreaProvider).findByType(SafeAreaView);
    expect(sheet.props.edges).toEqual(expect.arrayContaining(['bottom', 'left', 'right']));
    const scroll = sheet.findByType(ScrollView);
    expect(scroll.findAllByProps({title: 'Готово'})).toHaveLength(0);
    const done = sheet.findAllByType(TouchableOpacity).find(node => node.findAllByType(Text).some(text => text.props.children === 'Готово'))!;
    expect(done).toBeDefined();
    await ReactTestRenderer.act(() => done.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => tree!.unmount());
  });

  it.each((['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'] as const).flatMap(abi => [
    [abi, 'latest', 'Owenclave', '0.18.2', `https://github.com/owenewans/owenclave/releases/download/v0.18.2/Owenclave-0.18.2-${abi}.apk`],
    [abi, 'mirror', 'Owenclave', '0.17.59', `https://dragonservices.online/apps/android/Owenclave-0.17.59-${abi}.apk`],
    [abi, 'nekobox', 'NekoBox', '1.4.2', `https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/download/1.4.2/NekoBox-1.4.2-${abi}.apk`],
  ]))('matches the Android %s APK from %s to its caption and instructions', async (abi, source, client, version, apkUrl) => {
    NativeModules.DeviceArchitecture = {getSupportedAbis: jest.fn(async () => [abi])};
    jest.mocked(fetch).mockImplementation(async url => {
      if (String(url).endsWith('/releases/latest')) {
        return source === 'latest'
          ? headResponse('https://github.com/owenewans/owenclave/releases/tag/v0.18.2') : headResponse(String(url), 404);
      }
      return headResponse(String(url), String(url) === apkUrl ? 200 : 404);
    });
    // Real Android can open browser URLs even when canOpenURL reports false.
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<ConnectionInstructions expanded onToggle={jest.fn()}/>);
    });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain(`${client} ${version} (${abi})`);
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

  it('disables APK download and withholds client instructions until selection is resolved', async () => {
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

  it('checks sources only when expanded and reselects a matching client after reopening', async () => {
    NativeModules.DeviceArchitecture = {getSupportedAbis: jest.fn(async () => ['arm64-v8a'])};
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<ConnectionInstructions expanded={false} onToggle={jest.fn()}/>);
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(NativeModules.DeviceArchitecture.getSupportedAbis).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => tree!.update(<ConnectionInstructions expanded onToggle={jest.fn()}/>));
    expect(JSON.stringify(tree!.toJSON())).toContain('NekoBox 1.4.2 (arm64-v8a)');
    await ReactTestRenderer.act(() => tree!.update(<ConnectionInstructions expanded={false} onToggle={jest.fn()}/>));
    jest.mocked(fetch).mockImplementation(async url => headResponse(String(url).endsWith('/releases/latest')
      ? 'https://github.com/owenewans/owenclave/releases/tag/v0.19.0' : String(url)));
    await ReactTestRenderer.act(() => tree!.update(<ConnectionInstructions expanded onToggle={jest.fn()}/>));
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain('Owenclave 0.19.0 (arm64-v8a)');
    expect(rendered).toContain('Groups');
    expect(rendered).not.toContain('URL Тест');
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
