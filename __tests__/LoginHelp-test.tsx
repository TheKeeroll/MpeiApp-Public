import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-paper', () => ({
  useTheme: () => ({colors: {surface: '#111111', text: '#ffffff', textUnderline: '#00ffff'}}),
}));

import {BARS_REGISTRATION_URL, HelpAccordion, openBarsRegistration} from '../src/Login/LoginHelp';

describe('login help', () => {
  it('keeps accordion content collapsed until the user opens it', async () => {
    const onPress = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <HelpAccordion title="Где взять логин?" expanded={false} onPress={onPress}>
          <>{'Скрытая инструкция'}</>
        </HelpAccordion>,
      );
    });

    const button = tree!.root.findByProps({accessibilityRole: 'button'});
    expect(button.props.accessibilityState).toEqual({expanded: false});
    expect(JSON.stringify(tree!.toJSON())).not.toContain('Скрытая инструкция');
    button.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('opens the registration address without rendering it as visible button text', async () => {
    const linking = {
      canOpenURL: jest.fn(async () => true),
      openURL: jest.fn(async () => undefined),
    };
    const showAlert = jest.fn();

    await openBarsRegistration(linking, showAlert);
    expect(linking.openURL).toHaveBeenCalledWith(BARS_REGISTRATION_URL);
    expect(showAlert).not.toHaveBeenCalled();
  });

  it('shows a local explanation when the external registration URL is unavailable', async () => {
    const linking = {
      canOpenURL: jest.fn(async () => false),
      openURL: jest.fn(async () => undefined),
    };
    const showAlert = jest.fn();

    await openBarsRegistration(linking, showAlert);
    expect(linking.openURL).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith('Не удалось открыть страницу', expect.any(String));
  });
});
