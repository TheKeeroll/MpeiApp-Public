import React from 'react';
import {useIsFocused} from '@react-navigation/native';
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
  const isFocused = useIsFocused();

  React.useEffect(() => {
    if (!adsEnabled || !isFocused) {
      setStickyReservedHeight(placement, 0);
      return;
    }

    return registerStickyPlacement(placement);
  }, [adsEnabled, isFocused, placement, registerStickyPlacement, setStickyReservedHeight]);

  React.useEffect(() => () => setStickyReservedHeight(placement, 0), [placement, setStickyReservedHeight]);

  if (!isFocused || !isStickyPlacementEnabled(placement)) {
    return null;
  }

  return (
    <View
      collapsable={false}
      testID={`sticky-banner-slot-${placement}`}
      style={{width: '100%', alignSelf: 'stretch', flexShrink: 0}}
    >
      <StickyBannerAd placement={placement}/>
    </View>
  );
};

export default StickyBannerSlot;
