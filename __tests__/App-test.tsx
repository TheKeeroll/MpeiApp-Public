/** @format */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const passThrough = ({children}: {children?: React.ReactNode}) => <>{children}</>;

jest.mock('@react-navigation/native', () => ({NavigationContainer: passThrough}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: passThrough,
  SafeAreaView: passThrough,
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));
jest.mock('react-native-gesture-handler', () => ({GestureHandlerRootView: passThrough}));
jest.mock('react-native-paper', () => ({
  Provider: passThrough,
  useTheme: () => ({colors: {background: '#000000'}}),
}));
jest.mock('react-redux', () => ({Provider: passThrough}));
jest.mock('../src/API/Redux/Store', () => ({Store: {}}));
jest.mock('../src/Themes/Themes', () => ({THEME_DARK: {}, THEME_LIGHT: {}}));
jest.mock('../src/Common/Globals', () => ({
  __esModule: true,
  default: {
    LoginState: 'LOGGED_IN',
    Theme: {},
    SetLoginState: jest.fn(),
  },
}));
jest.mock('../src/Screens/Navigator', () => () => <></>);
jest.mock('../src/Screens/LoadingScreen/LoadingScreen', () => () => <></>);
jest.mock('../src/Screens/Login/LoginScreen', () => ({
  __esModule: true,
  default: () => <></>,
  LoginScreenHeader: () => <></>,
}));
jest.mock('../src/Screens/Login/AF2Screen', () => () => <></>);
jest.mock('../src/Ads/AdsProvider', () => ({AdsProvider: passThrough}));
jest.mock('../src/Loyalty/LoyaltyProvider', () => ({LoyaltyProvider: passThrough}));
jest.mock('../src/Loyalty/TokenBalanceBadge', () => () => <></>);
jest.mock('../src/Vpn/VpnSubscriptionRuntime', () => ({}));

const App = require('../App').default;

test('renders the application shell with mocked native SDK integrations', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
