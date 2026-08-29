import React from 'react';
import { DeviceEventEmitter } from 'react-native';
import BARSAPI from '../Common/Globals';
import { APP_EVENTS, VpnEntitlementChangedEvent, VpnEntitlementStatus } from '../Common/AppEvents';
import { STORAGE_KEYS } from '../Common/Constants';

/** Every enabled sticky location must be declared here before it can render. */
export const AD_PLACEMENTS = {
  loading: 'loading',
  skippedClasses: 'skippedClasses',
} as const;

export type StickyAdPlacement = (typeof AD_PLACEMENTS)[keyof typeof AD_PLACEMENTS];

type StickyReservedHeights = Record<StickyAdPlacement, number>;

type AdsContextValue = {
  adsEnabled: boolean;
  vpnEntitlementStatus: VpnEntitlementStatus;
  isStickyPlacementEnabled: (placement: StickyAdPlacement) => boolean;
  getStickyReservedHeight: (placement: StickyAdPlacement) => number;
  setStickyReservedHeight: (placement: StickyAdPlacement, height: number) => void;
};

const initialStickyReservedHeights: StickyReservedHeights = {
  [AD_PLACEMENTS.loading]: 0,
  [AD_PLACEMENTS.skippedClasses]: 0,
};

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
    const parsedState = JSON.parse(rawState) as { lastEffectiveStatus?: unknown };
    return normalizeVpnEntitlementStatus(parsedState.lastEffectiveStatus);
  } catch {
    return 'NONE';
  }
};

const disabledAdsContext: AdsContextValue = {
  adsEnabled: false,
  vpnEntitlementStatus: 'NONE',
  isStickyPlacementEnabled: () => false,
  getStickyReservedHeight: () => 0,
  setStickyReservedHeight: () => undefined,
};

const AdsContext = React.createContext<AdsContextValue>(disabledAdsContext);

export const AdsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [vpnEntitlementStatus, setVpnEntitlementStatus] = React.useState<VpnEntitlementStatus>(
    getCachedVpnEntitlementStatus,
  );
  const [stickyReservedHeights, setStickyReservedHeights] = React.useState<StickyReservedHeights>(
    initialStickyReservedHeights,
  );

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      APP_EVENTS.VPN_ENTITLEMENT_CHANGED,
      (event: VpnEntitlementChangedEvent | VpnEntitlementStatus) => {
        const nextStatus = typeof event === 'string' ? event : event?.status;
        setVpnEntitlementStatus(normalizeVpnEntitlementStatus(nextStatus));
      },
    );

    return () => subscription.remove();
  }, []);

  const adsEnabled = vpnEntitlementStatus !== 'ACTIVE' && vpnEntitlementStatus !== 'GRACE';

  const setStickyReservedHeight = React.useCallback((placement: StickyAdPlacement, height: number) => {
    const normalizedHeight = Math.max(0, height);
    setStickyReservedHeights(previous =>
      previous[placement] === normalizedHeight
        ? previous
        : {...previous, [placement]: normalizedHeight},
    );
  }, []);

  const contextValue = React.useMemo<AdsContextValue>(() => ({
    adsEnabled,
    vpnEntitlementStatus,
    isStickyPlacementEnabled: (placement) => adsEnabled && Object.values(AD_PLACEMENTS).includes(placement),
    getStickyReservedHeight: (placement) => stickyReservedHeights[placement],
    setStickyReservedHeight,
  }), [adsEnabled, setStickyReservedHeight, stickyReservedHeights, vpnEntitlementStatus]);

  return <AdsContext.Provider value={contextValue}>{children}</AdsContext.Provider>;
};

export const useAds = (): AdsContextValue => React.useContext(AdsContext);
