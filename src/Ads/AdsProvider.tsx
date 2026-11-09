import React from 'react';
import {AppState, DeviceEventEmitter} from 'react-native';
import {MobileAds, type AdRequestParams} from 'yandex-mobile-ads';
import BARSAPI from '../Common/Globals';
import {APP_EVENTS, VpnEntitlementChangedEvent, VpnEntitlementStatus} from '../Common/AppEvents';
import {STORAGE_KEYS} from '../Common/Constants';
import {isValidMapCoordinates, type MapCoordinates} from '../Common/MapRegion';
import {createAdsTargeting} from './AdTargeting';
import AdPrivacyModal from './AdPrivacyModal';
import {
  type AdPrivacyPreferences, DEFAULT_AD_PRIVACY, readAdPrivacy, saveAdPrivacy,
} from './AdPrivacyPreferences';
import {getYandexAdUnitId} from './AdUnitIds';
import {rewardedAdService} from './RewardedAdService';
import {
  getActiveStickyPlacement,
  isAdEntitlementEligible,
  normalizeStickyReservedHeight,
} from './AdVisibilityPolicy';
import {useLoyalty} from '../Loyalty/LoyaltyProvider';
import {
  YANDEX_STICKY_AD_PLACEMENTS,
  type YandexAdUnitPlacement,
  type YandexStickyAdPlacement,
} from './AdPlacements';

/** Every enabled sticky location must be declared here before it can render. */
export const AD_PLACEMENTS = YANDEX_STICKY_AD_PLACEMENTS;

export type StickyAdPlacement = YandexStickyAdPlacement;

type StickyReservedHeights = Record<StickyAdPlacement, number>;

type AdsContextValue = {
  adsEnabled: boolean;
  isSdkInitialized: boolean;
  isPersonalizedTargetingEnabled: boolean;
  isAdLocationSharingEnabled: boolean;
  isPrivacyModalVisible: boolean;
  privacyRevision: number;
  openAdPrivacySettings: () => void;
  vpnEntitlementStatus: VpnEntitlementStatus;
  createAdRequest: (placement: YandexAdUnitPlacement) => AdRequestParams | undefined;
  isStickyPlacementEnabled: (placement: StickyAdPlacement) => boolean;
  registerStickyPlacement: (placement: StickyAdPlacement) => () => void;
  getStickyReservedHeight: (placement: StickyAdPlacement) => number;
  setStickyReservedHeight: (placement: StickyAdPlacement, height: number) => void;
  setSessionLocation: (location: MapCoordinates) => void;
};

const initialStickyReservedHeights: StickyReservedHeights = {
  [AD_PLACEMENTS.loading]: 0,
  [AD_PLACEMENTS.skippedClasses]: 0,
  [AD_PLACEMENTS.detailedMarks]: 0,
  [AD_PLACEMENTS.recordBook]: 0,
  [AD_PLACEMENTS.stipends]: 0,
};

let mobileAdsInitializationPromise: Promise<void> | undefined;

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

const applySdkPrivacy = (preferences: AdPrivacyPreferences) => {
  MobileAds.setUserConsent(preferences.personalizedAds);
  MobileAds.setLocationConsent(preferences.personalizedAds && preferences.locationSharing);
  MobileAds.setAgeRestrictedUser(!preferences.adultConfirmed);
};

const initializeMobileAds = (): Promise<void> => {

  if (__DEV__) {
    MobileAds.enableLogging(true);
  }

  if (!mobileAdsInitializationPromise) {
    mobileAdsInitializationPromise = Promise.resolve(MobileAds.initialize()).then(() => undefined).catch(error => {
      mobileAdsInitializationPromise = undefined;
      throw error;
    });
  }

  return mobileAdsInitializationPromise;
};

const disabledAdsContext: AdsContextValue = {
  adsEnabled: false,
  isSdkInitialized: false,
  isPersonalizedTargetingEnabled: false,
  isAdLocationSharingEnabled: false,
  isPrivacyModalVisible: false,
  privacyRevision: 0,
  openAdPrivacySettings: () => undefined,
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
  const {adsRemovalUnlocked} = useLoyalty();
  const [vpnEntitlementStatus, setVpnEntitlementStatus] = React.useState<VpnEntitlementStatus>(
    getCachedVpnEntitlementStatus,
  );
  const [stickyReservedHeights, setStickyReservedHeights] = React.useState<StickyReservedHeights>(
    initialStickyReservedHeights,
  );
  const [stickyClaims, setStickyClaims] = React.useState<StickyAdPlacement[]>([]);
  const [sessionLocation, setSessionLocationState] = React.useState<MapCoordinates | null>(null);
  const sessionLocationRef = React.useRef<MapCoordinates | null>(null);
  const [consent, setConsent] = React.useState<AdPrivacyPreferences | undefined>(readAdPrivacy);
  const [editingPrivacy, setEditingPrivacy] = React.useState(false);
  const [privacyRevision, setPrivacyRevision] = React.useState(0);
  const consentRef = React.useRef(consent);
  consentRef.current = consent;
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
      sessionLocationRef.current = null;
      setSessionLocationState(null);
      setTargetingRevision(previous => previous + 1);
    });
    const appStateSubscription = AppState.addEventListener('change', state => {
      // Never reuse map coordinates after a background permission change.
      if (state !== 'active') {
        sessionLocationRef.current = null;
        setSessionLocationState(null);
      }
    });

    return () => {
      vpnSubscription.remove();
      loginSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const entitlementAllowsAds = isAdEntitlementEligible(vpnEntitlementStatus, adsRemovalUnlocked);
  const privacyModalVisible = editingPrivacy || (entitlementAllowsAds && !consent);
  const requestsBlocked = React.useRef(true);

  const openAdPrivacySettings = React.useCallback(() => {
    requestsBlocked.current = true;
    rewardedAdService.reset();
    setEditingPrivacy(true);
  }, []);

  const updatePrivacy = React.useCallback((preferences: AdPrivacyPreferences) => {
    const saved = saveAdPrivacy(preferences);
    // Revoke SDK access and invalidate outstanding JS requests synchronously.
    requestsBlocked.current = true;
    consentRef.current = saved;
    applySdkPrivacy(saved);
    rewardedAdService.reset();
    sessionLocationRef.current = null;
    setSessionLocationState(null);
    setSdkInitialized(false);
    setConsent(saved);
    setPrivacyRevision(revision => revision + 1);
    setEditingPrivacy(false);
  }, []);

  React.useEffect(() => {
    applySdkPrivacy(consent ?? DEFAULT_AD_PRIVACY);
    if (!entitlementAllowsAds || !consent) {
      return;
    }

    let isMounted = true;
    const startSdk = async () => {
      try {
        await initializeMobileAds();
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
  }, [consent, entitlementAllowsAds]);

  const adsEnabled = entitlementAllowsAds && isSdkInitialized && !!consent && !privacyModalVisible;
  requestsBlocked.current = !adsEnabled;
  React.useEffect(() => {
    if (!adsEnabled) rewardedAdService.reset();
  }, [adsEnabled]);

  const setStickyReservedHeight = React.useCallback((placement: StickyAdPlacement, height: number) => {
    const normalizedHeight = normalizeStickyReservedHeight(height);
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
    if (!consentRef.current?.personalizedAds || !consentRef.current.locationSharing
      || AppState.currentState !== 'active' || !isValidMapCoordinates(location)) {
      return;
    }

    const previous = sessionLocationRef.current;
    if (previous?.lat === location.lat && previous.lon === location.lon) return;
    sessionLocationRef.current = {...location};
    setSessionLocationState(sessionLocationRef.current);
  }, []);

  const createAdRequest = React.useCallback((placement: YandexAdUnitPlacement): AdRequestParams | undefined => {
    if (!adsEnabled || requestsBlocked.current) {
      return undefined;
    }

    const adUnitId = getYandexAdUnitId(placement);
    if (!adUnitId) {
      return undefined;
    }

    return {
      adUnitId,
      targeting: createAdsTargeting(
        consentRef.current?.locationSharing ? sessionLocationRef.current : undefined,
        consentRef.current?.personalizedAds === true,
        consentRef.current?.locationSharing === true,
      ),
    };
  }, [adsEnabled, consent, sessionLocation, targetingRevision]);

  const activeStickyPlacement = getActiveStickyPlacement(stickyClaims);
  const contextValue = React.useMemo<AdsContextValue>(() => ({
    adsEnabled,
    isSdkInitialized,
    isPersonalizedTargetingEnabled: consent?.personalizedAds === true,
    isAdLocationSharingEnabled: consent?.locationSharing === true,
    isPrivacyModalVisible: privacyModalVisible,
    privacyRevision,
    openAdPrivacySettings,
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
    openAdPrivacySettings,
    privacyRevision,
    registerStickyPlacement,
    privacyModalVisible,
    setSessionLocation,
    setStickyReservedHeight,
    stickyReservedHeights,
    vpnEntitlementStatus,
  ]);

  return <AdsContext.Provider value={contextValue}>
    {children}
    {privacyModalVisible && <AdPrivacyModal preferences={consent ?? DEFAULT_AD_PRIVACY} onSave={updatePrivacy}
      onCancel={consent ? () => setEditingPrivacy(false) : undefined}/>}
  </AdsContext.Provider>;
};

export const useAds = (): AdsContextValue => React.useContext(AdsContext);
