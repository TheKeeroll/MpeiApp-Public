import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

let mockSearchPanelProps: {
  onSearch: (query: string) => void;
  onQueryChange?: (query: string) => void;
} | undefined;

jest.mock('react-native-paper', () => ({
  useTheme: () => ({colors: {background: '#000000', text: '#ffffff', textUnderline: '#00ffff'}}),
}));
jest.mock('../src/Themes/Themes', () => ({withOpacity: (color: string) => color}));
jest.mock('../src/Screens/CommonComponents/DrawerHeader', () => ({
  NavigationHeader: () => null,
}));
jest.mock('../src/Screens/Schedule/ScheduleSearchPanel', () => {
  const React = require('react');
  return (props: typeof mockSearchPanelProps) => {
    mockSearchPanelProps = props;
    return React.createElement('ScheduleSearchPanelMock');
  };
});
jest.mock('../src/Ads/InlineBannerAd', () => {
  const React = require('react');
  return (props: Record<string, unknown>) => React.createElement('InlineBannerAdMock', props);
});

const GuestScheduleScreen = require('../src/Screens/Schedule/GuestScheduleScreen').default;

describe('guest schedule screen', () => {
  it('shows the empty-query banner and does not navigate or fetch before submit', async () => {
    const navigation = {push: jest.fn()};
    const fetchMock = jest.fn();
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      let tree: ReactTestRenderer.ReactTestRenderer;
      await ReactTestRenderer.act(() => {
        tree = ReactTestRenderer.create(<GuestScheduleScreen navigation={navigation}/>);
      });

      expect(tree!.root.findAll(node => node.props.placement === 'inlineBannerGuestScheduleEmpty')).not.toHaveLength(0);
      expect(mockSearchPanelProps).toBeDefined();
      await ReactTestRenderer.act(() => {
        mockSearchPanelProps!.onQueryChange?.('ИУ7-11');
      });
      expect(tree!.root.findAll(node => node.props.placement === 'inlineBannerGuestScheduleEmpty')).toHaveLength(0);
      expect(navigation.push).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();

      mockSearchPanelProps!.onSearch('ИУ7-11');
      expect(navigation.push).toHaveBeenCalledWith('scheduleMain', {searchQuery: 'ИУ7-11'});
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
