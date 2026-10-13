import React from 'react';
import {View} from 'react-native';
import {useAds} from './AdsProvider';
import {YANDEX_INLINE_AD_PLACEMENTS, type YandexInlineAdPlacement} from './AdPlacements';
import InlineBannerAd, {type InlineBannerAttempt} from './InlineBannerAd';
import {useAdScreenActivity} from './useAdScreenActivity';
import {useAdViewport} from './useAdViewport';

/** The visit belongs to the screen, so footer virtualization cannot grant another attempt. */
export const useDeferredInlineAd = (placement: YandexInlineAdPlacement, surface: 'screen' | 'drawer' = 'screen') => {
  const activity = useAdScreenActivity(surface);
  const {adsEnabled} = useAds();
  const [allowed, setAllowed] = React.useState(false);
  const granted = React.useRef(false);
  const attempt = React.useRef<InlineBannerAttempt>({started: false, failed: false});
  const latest = React.useRef({activity, adsEnabled});
  latest.current = {activity, adsEnabled};
  const viewport = useAdViewport({
    // Once the visit has an attempt, further scrolls need no native measurements.
    active: activity.isActive && adsEnabled && !allowed,
    visitActive: activity.isVisible,
    isActiveNow: () => latest.current.adsEnabled && latest.current.activity.isActiveNow(),
    onGeometry: (geometry, hasUserScrolled, scrollOffsetY) => {
      const current = latest.current;
      // Empty/short marks lists may expose the footer without any scrollable
      // content. An offscreen slot still requires a real user gesture.
      const initiallyVisibleMarks = placement === YANDEX_INLINE_AD_PLACEMENTS.marks
        && scrollOffsetY <= 1 && geometry?.nearViewport && geometry.distanceToSlot < 0;
      if (!granted.current && (hasUserScrolled || initiallyVisibleMarks) && geometry?.nearViewport
        && current.adsEnabled && current.activity.isActiveNow()) {
        granted.current = true;
        setAllowed(true);
      }
    },
  });
  React.useEffect(() => {
    if (!activity.isVisible) {
      granted.current = false;
      attempt.current = {started: false, failed: false};
      setAllowed(false);
    }
  }, [activity.isVisible]);

  return {
    viewportRef: viewport.viewportRef,
    onViewportLayout: viewport.refresh,
    scrollProps: viewport.scrollProps,
    banner: (
      <View ref={viewport.slotRef} collapsable={false} onLayout={viewport.refresh} style={{width: '100%', minHeight: 1}}>
        {activity.isVisible && adsEnabled && allowed && (
          <InlineBannerAd placement={placement} attempt={attempt.current}
            loadEnabled={activity.isActive} isLoadAllowedNow={activity.isActiveNow}/>
        )}
      </View>
    ),
  };
};
