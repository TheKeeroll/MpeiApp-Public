import React from 'react';
import {View, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {getAdSlotGeometry, type AdSlotGeometry, type AdViewportRect} from './AdViewportGeometry';

type Options = {
  active: boolean;
  visitActive: boolean;
  isActiveNow: () => boolean;
  onGeometry: (geometry: AdSlotGeometry | null, hasUserScrolled: boolean) => void;
};

/** Measures a real viewport and a virtualized footer/card in the same window coordinates. */
export const useAdViewport = (options: Options) => {
  const viewportRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const slotRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const latest = React.useRef(options);
  latest.current = options;
  const mounted = React.useRef(false);
  const sequence = React.useRef(0);
  const gesture = React.useRef({dragging: false, offset: 0, hasUserScrolled: false});

  const refresh = React.useCallback(() => {
    const revision = ++sequence.current;
    if (!mounted.current || !latest.current.active || !latest.current.isActiveNow()
      || !viewportRef.current || !slotRef.current) {
      latest.current.onGeometry(null, gesture.current.hasUserScrolled);
      return;
    }
    let slot: AdViewportRect | undefined;
    let viewport: AdViewportRect | undefined;
    const finish = () => {
      if (!slot || !viewport || revision !== sequence.current || !mounted.current) return;
      const current = latest.current;
      current.onGeometry(current.active && current.isActiveNow() ? getAdSlotGeometry(slot, viewport) : null,
        gesture.current.hasUserScrolled);
    };
    viewportRef.current.measureInWindow((x, y, width, height) => {
      viewport = {x, y, width, height};
      finish();
    });
    slotRef.current.measureInWindow((x, y, width, height) => {
      slot = {x, y, width, height};
      finish();
    });
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++sequence.current; };
  }, []);
  React.useEffect(() => {
    if (!options.visitActive) gesture.current = {dragging: false, offset: 0, hasUserScrolled: false};
    if (!options.active) gesture.current.dragging = false;
    refresh();
  }, [options.active, options.visitActive, refresh]);

  const onScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    const current = gesture.current;
    if (latest.current.active && current.dragging && Number.isFinite(offset)
      && Math.abs(offset - current.offset) >= 1) current.hasUserScrolled = true;
    current.offset = offset;
    refresh();
  }, [refresh]);
  const onScrollBeginDrag = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    gesture.current.dragging = latest.current.active;
    gesture.current.offset = event.nativeEvent.contentOffset.y;
  }, []);
  const onScrollEndDrag = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll(event);
    gesture.current.dragging = false;
  }, [onScroll]);

  return {
    viewportRef, slotRef, refresh,
    // Native clipping can detach a footer before it enters the viewport and
    // make measureInWindow return zero, preventing prefetch. FlatList still
    // virtualizes its rows; only native subtree clipping is disabled here.
    scrollProps: {
      onScroll, onScrollBeginDrag, onScrollEndDrag, scrollEventThrottle: 16,
      onContentSizeChange: refresh, removeClippedSubviews: false,
    },
  };
};
