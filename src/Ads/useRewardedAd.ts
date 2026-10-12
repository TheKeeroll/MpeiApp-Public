import React from 'react';
import {useAds} from './AdsProvider';
import {YANDEX_REWARDED_AD_PLACEMENT} from './AdPlacements';
import {rewardedAdService, type RewardedAdState} from './RewardedAdService';
import {useAdScreenActivity} from './useAdScreenActivity';
import {useAdViewport} from './useAdViewport';

export const REWARDED_VISIBILITY_DELAY_MS = 1500;

export const useRewardedAd = (rewardedLeft: number, grantReward: () => unknown) => {
  const activity = useAdScreenActivity();
  const {adsEnabled, createAdRequest} = useAds();
  const available = adsEnabled && rewardedLeft > 0;
  const [state, setState] = React.useState<RewardedAdState>(rewardedAdService.state);
  const [processing, setProcessing] = React.useState(false);
  const mounted = React.useRef(false);
  const latest = React.useRef({activity, available, createAdRequest, grantReward});
  latest.current = {activity, available, createAdRequest, grantReward};
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const period = React.useRef({attempted: false, ready: false});
  const intent = React.useRef(0);
  const intentPending = React.useRef(false);
  const refreshRef = React.useRef<() => void>(() => undefined);

  const cancelTimer = React.useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    period.current.ready = false;
  }, []);
  const canRequest = React.useCallback(() => mounted.current && latest.current.available
    && latest.current.activity.isActiveNow(), []);
  const cancelIntent = React.useCallback(() => {
    ++intent.current;
    intentPending.current = false;
    if (mounted.current) setProcessing(false);
  }, []);

  const viewport = useAdViewport({
    active: activity.isActive && available,
    visitActive: activity.isVisible,
    isActiveNow: canRequest,
    onGeometry: geometry => {
      if (!geometry?.visible || !canRequest()) {
        cancelTimer();
        period.current = {attempted: false, ready: false};
        cancelIntent();
        return;
      }
      const current = period.current;
      if (current.attempted || intentPending.current) return;
      if (current.ready) {
        current.ready = false;
        current.attempted = true;
        const request = latest.current.createAdRequest(YANDEX_REWARDED_AD_PLACEMENT);
        if (request && canRequest()) void rewardedAdService.preload(request);
      } else if (timer.current === undefined) {
        timer.current = setTimeout(() => {
          timer.current = undefined;
          if (!canRequest()) return;
          // Re-measure at the deadline. A scroll/layout can invalidate the old rectangle.
          period.current.ready = true;
          refreshRef.current();
        }, REWARDED_VISIBILITY_DELAY_MS);
      }
    },
  });
  refreshRef.current = viewport.refresh;

  React.useEffect(() => {
    mounted.current = true;
    const unsubscribe = rewardedAdService.subscribe(setState);
    viewport.refresh();
    return () => {
      mounted.current = false;
      cancelTimer();
      cancelIntent();
      unsubscribe();
    };
  }, [cancelIntent, cancelTimer, viewport.refresh]);
  React.useEffect(() => {
    if (!available) rewardedAdService.reset();
    if (!activity.isActive || !available) {
      cancelTimer();
      cancelIntent();
      period.current = {attempted: false, ready: false};
    }
    viewport.refresh();
  }, [activity.isActive, available, cancelIntent, cancelTimer, viewport.refresh]);

  const show = React.useCallback(async () => {
    if (!canRequest() || intentPending.current || rewardedAdService.state === 'SHOWING'
      || rewardedAdService.state === 'REWARDED') return;
    cancelTimer();
    period.current.attempted = true;
    const request = latest.current.createAdRequest(YANDEX_REWARDED_AD_PLACEMENT);
    if (!request) return;
    const id = ++intent.current;
    intentPending.current = true;
    setProcessing(true);
    try {
      const loaded = await rewardedAdService.preload(request);
      if (!loaded || !canRequest() || id !== intent.current) return;
      await rewardedAdService.show(() => {
        // Native rewarded impressions can finish in background; eligibility must still hold.
        if (mounted.current && latest.current.available) latest.current.grantReward();
      });
    } finally {
      if (mounted.current && id === intent.current) {
        intentPending.current = false;
        setProcessing(false);
      }
    }
  }, [canRequest, cancelTimer]);

  return {
    ...viewport, state, show,
    disabled: !available || processing || state === 'SHOWING' || state === 'REWARDED',
  };
};
