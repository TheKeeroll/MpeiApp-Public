import React from 'react';
import {ScrollView, type LayoutChangeEvent} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {getDragoNetScrollOffset, getDragoNetScrollRequest} from './DragoNetPromoNavigation';

export const useDragoNetCardScroll = (params: unknown, setParams: (params: {dragoNetScrollRequest: undefined}) => void) => {
  const isFocused = useIsFocused();
  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const layout = React.useRef({viewportHeight: 0, contentHeight: 0, cardY: 0, cardHeight: 0});
  const consumed = React.useRef<string | undefined>(undefined);
  const request = getDragoNetScrollRequest(params);
  const tryScroll = React.useCallback(() => {
    if (!isFocused || !request || consumed.current === request || !scrollRef.current) return;
    const {viewportHeight, contentHeight, cardY, cardHeight} = layout.current;
    const y = getDragoNetScrollOffset(viewportHeight, contentHeight, cardY, cardHeight);
    if (typeof y === 'undefined') return;
    consumed.current = request;
    scrollRef.current.scrollTo({y, animated: true});
    setParams({dragoNetScrollRequest: undefined});
  }, [isFocused, request, setParams]);
  React.useEffect(tryScroll, [tryScroll]);
  const onViewportLayout = React.useCallback((event: LayoutChangeEvent) => {
    layout.current.viewportHeight = event.nativeEvent.layout.height;
    tryScroll();
  }, [tryScroll]);
  const onCardLayout = React.useCallback((event: LayoutChangeEvent) => {
    layout.current.cardY = event.nativeEvent.layout.y;
    layout.current.cardHeight = event.nativeEvent.layout.height;
    tryScroll();
  }, [tryScroll]);
  const onContentSizeChange = React.useCallback((_width: number, height: number) => {
    layout.current.contentHeight = height;
    tryScroll();
  }, [tryScroll]);
  return {scrollRef, onViewportLayout, onCardLayout, onContentSizeChange};
};
