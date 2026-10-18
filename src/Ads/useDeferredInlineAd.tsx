import React from 'react';
import {View} from 'react-native';
import {useAds} from './AdsProvider';
import {YANDEX_INLINE_AD_PLACEMENTS, type YandexInlineAdPlacement} from './AdPlacements';
import InlineBannerAd, {type InlineBannerAttempt} from './InlineBannerAd';
import {useAdScreenActivity} from './useAdScreenActivity';
import {useAdViewport} from './useAdViewport';

/** The visit belongs to the screen, so footer virtualization cannot grant another attempt. */
export const useDeferredInlineAd = (
  placement: YandexInlineAdPlacement,
  surface: 'screen' | 'drawer' = 'screen',
  eligible = true,
) => {
  const activity = useAdScreenActivity(surface);
  const {adsEnabled} = useAds();
  const [allowed, setAllowed] = React.useState(false);
  const granted = React.useRef(false);
  const attempt = React.useRef<InlineBannerAttempt>({started: false, failed: false});
  const visitActive = activity.isVisible && eligible;
  const latest = React.useRef({activity, adsEnabled, eligible});
  latest.current = {activity, adsEnabled, eligible};
  const isLoadAllowedNow = React.useCallback(() => (
    latest.current.adsEnabled && latest.current.eligible && latest.current.activity.isActiveNow()
  ), []);
  const viewport = useAdViewport({
    // Once the visit has an attempt, further scrolls need no native measurements.
    active: activity.isActive && eligible && adsEnabled && !allowed,
    visitActive,
    isActiveNow: isLoadAllowedNow,
    onGeometry: (geometry, hasUserScrolled, scrollOffsetY) => {
      // Short marks/schedule lists may expose the footer without any scrollable
      // content. An offscreen slot still requires a real user gesture.
      const allowsInitiallyVisibleSlot = placement === YANDEX_INLINE_AD_PLACEMENTS.marks
        || placement === YANDEX_INLINE_AD_PLACEMENTS.scheduleToday;
      const initiallyVisible = allowsInitiallyVisibleSlot
        && scrollOffsetY <= 1 && geometry?.nearViewport && geometry.distanceToSlot < 0;
      if (!granted.current && (hasUserScrolled || initiallyVisible) && geometry?.nearViewport
        && isLoadAllowedNow()) {
        granted.current = true;
        setAllowed(true);
      }
    },
  });
  React.useEffect(() => {
    if (!visitActive) {
      granted.current = false;
      attempt.current = {started: false, failed: false};
      setAllowed(false);
    }
  }, [visitActive]);

  return {
    viewportRef: viewport.viewportRef,
    onViewportLayout: viewport.refresh,
    scrollProps: viewport.scrollProps,
    banner: (
      <View ref={viewport.slotRef} collapsable={false} onLayout={viewport.refresh} style={{width: '100%', minHeight: 1}}>
        {visitActive && adsEnabled && allowed && (
          <InlineBannerAd placement={placement} attempt={attempt.current}
            loadEnabled={activity.isActive} isLoadAllowedNow={isLoadAllowedNow}/>
        )}
      </View>
    ),
  };
};
