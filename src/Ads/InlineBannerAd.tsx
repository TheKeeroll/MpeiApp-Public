import React from 'react';
import {LayoutChangeEvent, StyleProp, View, ViewStyle} from 'react-native';
import {BannerAdSize, BannerView, type AdRequestParams} from 'yandex-mobile-ads';
import {useAds} from './AdsProvider';
import type {YandexInlineAdPlacement} from './AdPlacements';

export type InlineBannerAttempt = {started: boolean; failed: boolean};
type InlineBannerAdProps = {
  placement: YandexInlineAdPlacement;
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
  loadEnabled?: boolean;
  isLoadAllowedNow?: () => boolean;
  attempt?: InlineBannerAttempt;
};
type BannerSession = {request: AdRequestParams; size: BannerAdSize};

const StartedBanner: React.FC<React.ComponentProps<typeof BannerView> & {onStarted: () => void}> = ({onStarted, ...props}) => {
  React.useLayoutEffect(onStarted, [onStarted]);
  return <BannerView {...props}/>;
};

const InlineBannerAd: React.FC<InlineBannerAdProps> = ({
  placement, maxHeight = 250, style, loadEnabled = true, isLoadAllowedNow, attempt,
}) => {
  const {adsEnabled, createAdRequest} = useAds();
  const [availableWidth, setAvailableWidth] = React.useState(0);
  const [session, setSession] = React.useState<BannerSession | null>(null);
  const [isLoaded, setLoaded] = React.useState(false);
  const [hasFailed, setFailed] = React.useState(false);
  const started = React.useRef(false);
  const mounted = React.useRef(false);
  const latest = React.useRef({adsEnabled, loadEnabled, isLoadAllowedNow, session});
  latest.current = {adsEnabled, loadEnabled, isLoadAllowedNow, session};

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const markStarted = React.useCallback(() => {
    started.current = true;
    if (attempt) attempt.started = true;
  }, [attempt]);
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (Number.isFinite(width) && width > 0) setAvailableWidth(previous => previous === width ? previous : width);
  }, []);

  React.useEffect(() => {
    // Freeze targeting and size after the native request. Provider updates and
    // scrolling must not reload an ad; a smaller rotated viewport scales it.
    if (started.current || attempt?.started || hasFailed || !adsEnabled || !loadEnabled
      || availableWidth <= 0 || isLoadAllowedNow?.() === false) return;
    const request = createAdRequest(placement);
    if (!request) return;
    let cancelled = false;
    BannerAdSize.inlineSize(availableWidth, Math.max(1, Math.floor(maxHeight))).then(size => {
      if (cancelled || !mounted.current || !latest.current.adsEnabled || !latest.current.loadEnabled
        || latest.current.isLoadAllowedNow?.() === false) return;
      if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) {
        setFailed(true);
        if (attempt) attempt.failed = true;
        if (__DEV__) console.debug('Yandex inline size unavailable', {placement, width: availableWidth});
        return;
      }
      if (__DEV__) console.debug('Yandex inline size', {placement, width: size.width, height: size.height});
      setSession({request, size});
    }).catch(() => {
      if (cancelled || !mounted.current) return;
      setFailed(true);
      if (attempt) attempt.failed = true;
      if (__DEV__) console.debug('Yandex inline size failed', {placement, width: availableWidth});
    });
    return () => { cancelled = true; };
  }, [adsEnabled, availableWidth, createAdRequest, hasFailed, isLoadAllowedNow, loadEnabled, maxHeight, placement, attempt]);

  if (!adsEnabled || hasFailed || attempt?.failed || (attempt?.started && !started.current)) return null;
  const canMount = started.current || (loadEnabled && isLoadAllowedNow?.() !== false);
  const scale = session ? Math.min(1, availableWidth / session.size.width) : 1;
  return (
    <View collapsable={false} onLayout={handleLayout} style={[
      {width: '100%', alignSelf: 'stretch', alignItems: 'center', marginTop: isLoaded ? 12 : 0}, style,
    ]}>
      {session && canMount ? (
        <View style={{width: session.size.width * scale, height: session.size.height * scale, overflow: 'hidden'}}>
          <StartedBanner
            onStarted={markStarted}
            size={session.size}
            adRequest={session.request}
            onAdLoaded={() => {
              if (!mounted.current || !latest.current.adsEnabled || latest.current.session !== session) return;
              setLoaded(true);
              if (__DEV__) console.debug('Yandex inline loaded', {placement, width: session.size.width, height: session.size.height});
            }}
            onAdFailedToLoad={event => {
              if (!mounted.current || latest.current.session !== session) return;
              setFailed(true);
              if (attempt) attempt.failed = true;
              if (__DEV__) console.debug('Yandex inline failed', {placement, code: event.nativeEvent.code});
            }}
            style={{
              width: session.size.width, height: session.size.height, opacity: isLoaded ? 1 : 0,
              transform: [
                {translateX: -(session.size.width * (1 - scale)) / 2},
                {translateY: -(session.size.height * (1 - scale)) / 2},
                {scale},
              ],
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

export default InlineBannerAd;
