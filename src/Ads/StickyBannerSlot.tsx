import React from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { StickyAdPlacement, useAds } from './AdsProvider';

type StickyBannerSlotProps = {
  placement: StickyAdPlacement;
};

/**
 * A single gated layout host for a sticky banner.  The Yandex renderer is
 * intentionally introduced only after consent handling in stage 4; screens
 * already have their final, safe placement now.
 */
const StickyBannerSlot: React.FC<StickyBannerSlotProps> = ({ placement }) => {
  const { isStickyPlacementEnabled, setStickyReservedHeight } = useAds();
  const enabled = isStickyPlacementEnabled(placement);

  React.useEffect(() => () => setStickyReservedHeight(placement, 0), [placement, setStickyReservedHeight]);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setStickyReservedHeight(placement, event.nativeEvent.layout.height);
  }, [placement, setStickyReservedHeight]);

  if (!enabled) {
    return null;
  }

  return <View collapsable={false} onLayout={handleLayout} testID={`sticky-banner-slot-${placement}`} />;
};

export default StickyBannerSlot;
