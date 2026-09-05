import React from 'react';
import {LayoutChangeEvent, StyleProp, View, ViewStyle} from 'react-native';
import {BannerAdSize, BannerView} from 'yandex-mobile-ads';
import {useAds} from './AdsProvider';
import type {YandexInlineAdPlacement} from './AdPlacements';

type InlineBannerAdProps = {
  placement: YandexInlineAdPlacement;
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
};

const InlineBannerAd: React.FC<InlineBannerAdProps> = ({placement, maxHeight = 250, style}) => {
  const {adsEnabled, createAdRequest} = useAds();
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
    BannerAdSize.inlineSize(availableWidth, maxHeight)
      .then(size => {
        if (!isCancelled) {
          setAdSize(size);
        }
      })
      .catch(error => {
        if (!isCancelled) {
          console.warn('Failed to calculate inline Yandex banner size', error);
          setAdSize(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [adRequest, adsEnabled, availableWidth, maxHeight]);

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [adRequest, adSize]);

  if (!adsEnabled || !adRequest || hasFailed) {
    return null;
  }

  return (
    <View
      collapsable={false}
      onLayout={handleLayout}
      style={[{width: '100%', alignSelf: 'stretch', alignItems: 'center', marginTop: isLoaded ? 12 : 0}, style]}
    >
      {adSize ? (
        <View style={{width: adSize.width, height: isLoaded ? adSize.height : 0, overflow: 'hidden'}}>
          <BannerView
            size={adSize}
            adRequest={adRequest}
            onAdLoaded={() => setLoaded(true)}
            onAdFailedToLoad={event => {
              console.warn('Inline Yandex banner failed to load', event.nativeEvent);
              setFailed(true);
            }}
            style={{opacity: isLoaded ? 1 : 0}}
          />
        </View>
      ) : null}
    </View>
  );
};

export default InlineBannerAd;
