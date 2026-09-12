import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Platform} from 'react-native';

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
  getOwenclaveApkUrlForAbis,
} = require('../src/Screens/Settings/DragoNetPromoCard');

const access = {
  demoSubURL: 'https://sub.dragonet.example/demo/student',
  receivedAt: '2026-09-12T10:00:00.000Z',
};

describe('DragoNet result sheet', () => {
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

  it('selects the matching Owenclave APK and falls back to arm64-v8a', () => {
    expect(getOwenclaveApkUrlForAbis('android', ['x86'])).toContain('-x86.apk');
    expect(getOwenclaveApkUrlForAbis('android', ['armeabi-v7a'])).toContain('-armeabi-v7a.apk');
    expect(getOwenclaveApkUrlForAbis('android', ['x86_64'])).toContain('-x86_64.apk');
    expect(getOwenclaveApkUrlForAbis('android', ['unrecognized'])).toContain('-arm64-v8a.apk');
    expect(getOwenclaveApkUrlForAbis('ios', ['x86'])).toContain('-arm64-v8a.apk');
  });

  it('renders Android instructions only after their accordion is expanded', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', {configurable: true, value: 'android'});
    try {
      let tree: ReactTestRenderer.ReactTestRenderer;
      await ReactTestRenderer.act(() => {
        tree = ReactTestRenderer.create(<ConnectionInstructions expanded onToggle={jest.fn()}/>);
      });
      expect(JSON.stringify(tree!.toJSON())).toContain('Загрузить APK');
      await ReactTestRenderer.act(() => tree!.unmount());
    } finally {
      if (platformDescriptor) {
        Object.defineProperty(Platform, 'OS', platformDescriptor);
      }
    }
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
