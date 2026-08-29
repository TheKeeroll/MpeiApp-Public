import React from 'react';
import {Alert, DeviceEventEmitter} from 'react-native';
import {MobileAds, type AdRequestParams} from 'yandex-mobile-ads';
import BARSAPI from '../Common/Globals';
import {APP_EVENTS, VpnEntitlementChangedEvent, VpnEntitlementStatus} from '../Common/AppEvents';
import {STORAGE_KEYS} from '../Common/Constants';
import {isValidMapCoordinates, type MapCoordinates} from '../Common/MapRegion';
import {createAdsTargeting} from './AdTargeting';
import {getYandexAdUnitId, type YandexAdFormat} from './AdUnitIds';

/** Every enabled sticky location must be declared here before it can render. */
export const AD_PLACEMENTS = {
  loading: 'loading',
  skippedClasses: 'skippedClasses',
} as const;

export type StickyAdPlacement = (typeof AD_PLACEMENTS)[keyof typeof AD_PLACEMENTS];

type StickyReservedHeights = Record<StickyAdPlacement, number>;
type SavedAdConsent = 'GRANTED' | 'DENIED';

type AdsContextValue = {
  adsEnabled: boolean;
  isSdkInitialized: boolean;
  isPersonalizedTargetingEnabled: boolean;
  vpnEntitlementStatus: VpnEntitlementStatus;
  createAdRequest: (format: YandexAdFormat) => AdRequestParams | undefined;
  isStickyPlacementEnabled: (placement: StickyAdPlacement) => boolean;
  registerStickyPlacement: (placement: StickyAdPlacement) => () => void;
  getStickyReservedHeight: (placement: StickyAdPlacement) => number;
  setStickyReservedHeight: (placement: StickyAdPlacement, height: number) => void;
  setSessionLocation: (location: MapCoordinates) => void;
};

const initialStickyReservedHeights: StickyReservedHeights = {
  [AD_PLACEMENTS.loading]: 0,
  [AD_PLACEMENTS.skippedClasses]: 0,
};

let mobileAdsInitializationPromise: Promise<void> | undefined;
let consentPromptPromise: Promise<SavedAdConsent> | undefined;

const normalizeVpnEntitlementStatus = (value: unknown): VpnEntitlementStatus => {
  switch (value) {
    case 'ACTIVE':
    case 'GRACE':
    case 'REVOKED':
    case 'NONE':
      return value;
    default:
      return 'NONE';
  }
};

/**
 * MMKV is synchronous, which lets an existing ACTIVE/GRACE state suppress the
 * loading placement before the first frame is painted.
 */
const getCachedVpnEntitlementStatus = (): VpnEntitlementStatus => {
  const rawState = BARSAPI.mStorage.getString(STORAGE_KEYS.VPN_VERIFICATION_STATE);
  if (!rawState) {
    return 'NONE';
  }

  try {
    const parsedState = JSON.parse(rawState) as {lastEffectiveStatus?: unknown};
    return normalizeVpnEntitlementStatus(parsedState.lastEffectiveStatus);
  } catch {
    return 'NONE';
  }
};

const getSavedAdConsent = (): SavedAdConsent | undefined => {
  const consent = BARSAPI.mStorage.getString(STORAGE_KEYS.AD_USER_CONSENT);
  return consent === 'GRANTED' || consent === 'DENIED' ? consent : undefined;
};

const requestAdConsent = (): Promise<SavedAdConsent> => {
  const savedConsent = getSavedAdConsent();
  if (savedConsent) {
    return Promise.resolve(savedConsent);
  }

  if (!consentPromptPromise) {
    consentPromptPromise = new Promise(resolve => {
      Alert.alert(
        'Реклама и персонализация',
        'Разрешить обработку данных для персонализации рекламы? При согласии приложение передаёт приблизительный возраст, определённый пол и, если вы используете карту, координаты только текущего сеанса. При отказе реклама останется неперсонализированной.',
        [
          {text: 'Не разрешать', style: 'cancel', onPress: () => resolve('DENIED')},
          {text: 'Разрешить', onPress: () => resolve('GRANTED')},
        ],
        {cancelable: false},
      );
    });
  }

  return consentPromptPromise;
};

const initializeMobileAds = (consent: SavedAdConsent): Promise<void> => {
  const userConsent = consent === 'GRANTED';
  MobileAds.setUserConsent(userConsent);
  MobileAds.setLocationConsent(userConsent);

  if (__DEV__) {
    MobileAds.enableLogging(true);
  }

  if (!mobileAdsInitializationPromise) {
    mobileAdsInitializationPromise = Promise.resolve(MobileAds.initialize()).then(() => undefined);
  }

  return mobileAdsInitializationPromise;
};

const disabledAdsContext: AdsContextValue = {
  adsEnabled: false,
  isSdkInitialized: false,
  isPersonalizedTargetingEnabled: false,
  vpnEntitlementStatus: 'NONE',
  createAdRequest: () => undefined,
  isStickyPlacementEnabled: () => false,
  registerStickyPlacement: () => () => undefined,
  getStickyReservedHeight: () => 0,
  setStickyReservedHeight: () => undefined,
  setSessionLocation: () => undefined,
};

const AdsContext = React.createContext<AdsContextValue>(disabledAdsContext);

export const AdsProvider: React.FC<React.PropsWithChildren> = ({children}) => {
  const [vpnEntitlementStatus, setVpnEntitlementStatus] = React.useState<VpnEntitlementStatus>(
    getCachedVpnEntitlementStatus,
  );
  const [stickyReservedHeights, setStickyReservedHeights] = React.useState<StickyReservedHeights>(
    initialStickyReservedHeights,
  );
  const [stickyClaims, setStickyClaims] = React.useState<StickyAdPlacement[]>([]);
  const [sessionLocation, setSessionLocationState] = React.useState<MapCoordinates | null>(null);
  const [consent, setConsent] = React.useState<SavedAdConsent | undefined>(getSavedAdConsent);
  const [isSdkInitialized, setSdkInitialized] = React.useState(false);
  const [targetingRevision, setTargetingRevision] = React.useState(0);

  React.useEffect(() => {
    const vpnSubscription = DeviceEventEmitter.addListener(
      APP_EVENTS.VPN_ENTITLEMENT_CHANGED,
      (event: VpnEntitlementChangedEvent | VpnEntitlementStatus) => {
        const nextStatus = typeof event === 'string' ? event : event?.status;
        setVpnEntitlementStatus(normalizeVpnEntitlementStatus(nextStatus));
      },
    );
    const loginSubscription = DeviceEventEmitter.addListener('LoginState', () => {
      setTargetingRevision(previous => previous + 1);
    });

    return () => {
      vpnSubscription.remove();
      loginSubscription.remove();
    };
  }, []);

  const entitlementAllowsAds = vpnEntitlementStatus !== 'ACTIVE' && vpnEntitlementStatus !== 'GRACE';

  React.useEffect(() => {
    if (!entitlementAllowsAds) {
      return;
    }

    let isMounted = true;
    const startSdk = async () => {
      try {
        const resolvedConsent = await requestAdConsent();
        BARSAPI.mStorage.set(STORAGE_KEYS.AD_USER_CONSENT, resolvedConsent);
        if (!isMounted) {
          return;
        }

        setConsent(resolvedConsent);
        await initializeMobileAds(resolvedConsent);
        if (isMounted) {
          setSdkInitialized(true);
        }
      } catch (error) {
        console.warn('Yandex Mobile Ads SDK initialization failed', error);
        if (isMounted) {
          setSdkInitialized(false);
        }
      }
    };

    void startSdk();
    return () => {
      isMounted = false;
    };
  }, [entitlementAllowsAds]);

  const adsEnabled = entitlementAllowsAds && isSdkInitialized;

  const setStickyReservedHeight = React.useCallback((placement: StickyAdPlacement, height: number) => {
    const normalizedHeight = Math.max(0, height);
    setStickyReservedHeights(previous => (
      previous[placement] === normalizedHeight
        ? previous
        : {...previous, [placement]: normalizedHeight}
    ));
  }, []);

  const registerStickyPlacement = React.useCallback((placement: StickyAdPlacement) => {
    setStickyClaims(previous => previous.includes(placement) ? previous : [...previous, placement]);
    return () => {
      setStickyClaims(previous => previous.filter(current => current !== placement));
    };
  }, []);

  const setSessionLocation = React.useCallback((location: MapCoordinates) => {
    if (!isValidMapCoordinates(location)) {
      return;
    }

    setSessionLocationState(previous => (
      previous?.lat === location.lat && previous.lon === location.lon ? previous : {...location}
    ));
  }, []);

  const createAdRequest = React.useCallback((format: YandexAdFormat): AdRequestParams | undefined => {
    if (!adsEnabled) {
      return undefined;
    }

    const adUnitId = getYandexAdUnitId(format);
    if (!adUnitId) {
      return undefined;
    }

    return {
      adUnitId,
      targeting: consent === 'GRANTED' ? createAdsTargeting(sessionLocation) : undefined,
    };
  }, [adsEnabled, consent, sessionLocation, targetingRevision]);

  const activeStickyPlacement = stickyClaims[0];
  const contextValue = React.useMemo<AdsContextValue>(() => ({
    adsEnabled,
    isSdkInitialized,
    isPersonalizedTargetingEnabled: consent === 'GRANTED',
    vpnEntitlementStatus,
    createAdRequest,
    isStickyPlacementEnabled: placement => adsEnabled && activeStickyPlacement === placement,
    registerStickyPlacement,
    getStickyReservedHeight: placement => stickyReservedHeights[placement],
    setStickyReservedHeight,
    setSessionLocation,
  }), [
    activeStickyPlacement,
    adsEnabled,
    consent,
    createAdRequest,
    isSdkInitialized,
    registerStickyPlacement,
    setSessionLocation,
    setStickyReservedHeight,
    stickyReservedHeights,
    vpnEntitlementStatus,
  ]);

  return <AdsContext.Provider value={contextValue}>{children}</AdsContext.Provider>;
};

export const useAds = (): AdsContextValue => React.useContext(AdsContext);
