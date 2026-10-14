import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Animated, LayoutAnimation, TouchableOpacity} from 'react-native';

jest.mock('react-native-paper', () => ({
  useTheme: () => ({colors: {text: '#ffffff', textUnderline: '#00ffff', surface: '#111111', background: '#000000'}}),
  TextInput: (props: Record<string, unknown>) => require('react').createElement('SearchInput', props),
}));
jest.mock('../src/Themes/Themes', () => ({withOpacity: (color: string) => color}));
jest.mock('../src/Loyalty/DailyUsageBadge', () => () => null);
const ScheduleSearchPanel = require('../src/Screens/Schedule/ScheduleSearchPanel').default;

it('expands and submits a schedule search without animating the native list hierarchy, stopping the local fade on close', async () => {
  const layout = jest.spyOn(LayoutAnimation, 'configureNext');
  const start = jest.fn();
  const stop = jest.fn();
  jest.spyOn(Animated, 'timing').mockReturnValue({start, stop, reset: jest.fn()});
  const onSearch = jest.fn();
  const onQueryChange = jest.fn();
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(() => {tree = ReactTestRenderer.create(<ScheduleSearchPanel onSearch={onSearch} onQueryChange={onQueryChange}/>);});
    expect(start).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => tree!.root.findByType(TouchableOpacity).props.onPress());
    expect(start).toHaveBeenCalledTimes(1);
    expect(layout).not.toHaveBeenCalled();
    const input = tree!.root.findByType('SearchInput' as React.ElementType);
    await ReactTestRenderer.act(() => input.props.onChangeText('  A-01  '));
    expect(onQueryChange).toHaveBeenCalledWith('A-01');
    await ReactTestRenderer.act(() => tree!.root.findAllByType(TouchableOpacity)[1].props.onPress());
    expect(onSearch).toHaveBeenCalledWith('A-01');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(tree!.root.findAllByType('SearchInput' as React.ElementType)).toHaveLength(0);
    expect(layout).not.toHaveBeenCalled();
  } finally {
    if (tree) await ReactTestRenderer.act(() => tree!.unmount());
    jest.restoreAllMocks();
  }
});
