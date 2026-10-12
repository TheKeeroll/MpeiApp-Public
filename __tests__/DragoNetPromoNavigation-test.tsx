import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type {LayoutChangeEvent} from 'react-native';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  CommonActions: {navigate: (name: string, params: Record<string, unknown>) => ({type: 'NAVIGATE', payload: {name, params}})},
}));
import {getDragoNetScrollOffset, navigateToDragoNet} from '../src/Vpn/DragoNetPromoNavigation';
import {useDragoNetCardScroll} from '../src/Vpn/useDragoNetCardScroll';

const mockSetParams = jest.fn();
let controls: ReturnType<typeof useDragoNetCardScroll>;
const Harness: React.FC<{request?: string}> = ({request}) => {
  controls = useDragoNetCardScroll({dragoNetScrollRequest: request}, mockSetParams);
  return null;
};
const layoutEvent = (height: number, y = 0) => ({nativeEvent: {layout: {x: 0, y, width: 320, height}}} as LayoutChangeEvent);

describe('DragoNet banner navigation', () => {
  it('targets settingsMain, pops a previously opened child screen and uses unique scroll requests', () => {
    const dispatch = jest.fn();
    navigateToDragoNet({dispatch});
    navigateToDragoNet({dispatch});
    const first = dispatch.mock.calls[0]![0];
    const second = dispatch.mock.calls[1]![0];
    expect(first).toMatchObject({type: 'NAVIGATE', payload: {name: 'other', params: {screen: 'settingsMain', pop: true}}});
    expect(first.payload.params.params.dragoNetScrollRequest).not.toEqual(second.payload.params.params.dragoNetScrollRequest);
  });

  it('centres a fitting card, shows the start of a tall card and clamps to content bounds', () => {
    expect(getDragoNetScrollOffset(600, 2000, 1000, 300)).toBe(850);
    expect(getDragoNetScrollOffset(600, 2400, 1000, 1000)).toBe(1000);
    expect(getDragoNetScrollOffset(600, 1000, 900, 100)).toBe(400);
    expect(getDragoNetScrollOffset(600, 400, 150, 120)).toBe(0);
    expect(getDragoNetScrollOffset(0, 2000, 1000, 300)).toBeUndefined();
    expect(getDragoNetScrollOffset(600, 1200, 1000, 300)).toBeUndefined();
    expect(getDragoNetScrollOffset(600, NaN, 1000, 300)).toBeUndefined();
  });

  it('waits for focus and all layouts, consumes once and handles another request on the same screen', async () => {
    mockFocused = false;
    mockSetParams.mockClear();
    const scrollTo = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<Harness request="first"/>); });
    controls.scrollRef.current = {scrollTo} as unknown as NonNullable<typeof controls.scrollRef.current>;
    await ReactTestRenderer.act(() => controls.onViewportLayout(layoutEvent(600)));
    await ReactTestRenderer.act(() => controls.onCardLayout(layoutEvent(300, 1000)));
    expect(scrollTo).not.toHaveBeenCalled();
    mockFocused = true;
    await ReactTestRenderer.act(() => tree!.update(<Harness request="first"/>));
    expect(scrollTo).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => controls.onContentSizeChange(320, 2000));
    expect(scrollTo).toHaveBeenCalledWith({y: 850, animated: true});
    expect(mockSetParams).toHaveBeenCalledWith({dragoNetScrollRequest: undefined});
    await ReactTestRenderer.act(() => controls.onCardLayout(layoutEvent(300, 1000)));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => tree!.update(<Harness request="second"/>));
    expect(scrollTo).toHaveBeenCalledTimes(2);
    await ReactTestRenderer.act(() => tree!.update(<Harness/>));
    await ReactTestRenderer.act(() => controls.onViewportLayout(layoutEvent(650)));
    expect(scrollTo).toHaveBeenCalledTimes(2);
    await ReactTestRenderer.act(() => tree!.unmount());
  });
});
