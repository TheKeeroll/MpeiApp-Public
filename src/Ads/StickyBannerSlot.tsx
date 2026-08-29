import React from 'react';
import {View} from 'react-native';
import {StickyAdPlacement, useAds} from './AdsProvider';
import StickyBannerAd from './StickyBannerAd';

type StickyBannerSlotProps = {
  placement: StickyAdPlacement;
};

/** A single gated layout host for an adaptive sticky banner. */
const StickyBannerSlot: React.FC<StickyBannerSlotProps> = ({placement}) => {
  const {
    adsEnabled,
    isStickyPlacementEnabled,
    registerStickyPlacement,
    setStickyReservedHeight,
  } = useAds();

  React.useEffect(() => {
    if (!adsEnabled) {
      setStickyReservedHeight(placement, 0);
      return;
    }

    return registerStickyPlacement(placement);
  }, [adsEnabled, placement, registerStickyPlacement, setStickyReservedHeight]);

  React.useEffect(() => () => setStickyReservedHeight(placement, 0), [placement, setStickyReservedHeight]);

  if (!isStickyPlacementEnabled(placement)) {
    return null;
  }

  return (
    <View collapsable={false} testID={`sticky-banner-slot-${placement}`}>
      <StickyBannerAd placement={placement}/>
    </View>
  );
};

export default StickyBannerSlot;
