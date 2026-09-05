import React from 'react';
import {LayoutChangeEvent, View} from 'react-native';
import {BannerAdSize, BannerView} from 'yandex-mobile-ads';
import {StickyAdPlacement, useAds} from './AdsProvider';

type StickyBannerAdProps = {
  placement: StickyAdPlacement;
};

const StickyBannerAd: React.FC<StickyBannerAdProps> = ({placement}) => {
  const {adsEnabled, createAdRequest, setStickyReservedHeight} = useAds();
  const [availableWidth, setAvailableWidth] = React.useState(0);
  const [adSize, setAdSize] = React.useState<BannerAdSize | null>(null);
  const [isLoaded, setLoaded] = React.useState(false);
  const [hasFailed, setFailed] = React.useState(false);
  const adRequest = React.useMemo(() => createAdRequest(placement), [createAdRequest, placement]);

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    setAvailableWidth(previous => previous === nextWidth ? previous : nextWidth);
  }, []);

  React.useEffect(() => {
    if (!adsEnabled || !adRequest || availableWidth <= 0) {
      setAdSize(null);
      return;
    }

    let isCancelled = false;
    BannerAdSize.stickySize(availableWidth)
      .then(size => {
        if (!isCancelled) {
          setAdSize(size);
        }
      })
      .catch(error => {
        if (!isCancelled) {
          console.warn('Failed to calculate sticky Yandex banner size', error);
          setAdSize(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [adRequest, adsEnabled, availableWidth]);

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [adRequest, adSize]);

  React.useEffect(() => {
    setStickyReservedHeight(placement, isLoaded && adSize && !hasFailed ? adSize.height : 0);
  }, [adSize, hasFailed, isLoaded, placement, setStickyReservedHeight]);

  React.useEffect(() => () => setStickyReservedHeight(placement, 0), [placement, setStickyReservedHeight]);

  if (!adsEnabled || !adRequest || hasFailed) {
    return null;
  }

  return (
    <View
      collapsable={false}
      onLayout={handleLayout}
      style={{width: '100%', alignSelf: 'stretch', alignItems: 'center'}}
    >
      {adSize ? (
        <View style={{width: adSize.width, height: isLoaded ? adSize.height : 0, overflow: 'hidden'}}>
          <BannerView
            size={adSize}
            adRequest={adRequest}
            onAdLoaded={() => setLoaded(true)}
            onAdFailedToLoad={event => {
              console.warn('Sticky Yandex banner failed to load', event.nativeEvent);
              setFailed(true);
            }}
            style={{opacity: isLoaded ? 1 : 0}}
          />
        </View>
      ) : null}
    </View>
  );
};

export default StickyBannerAd;
