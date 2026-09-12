import type {VpnEntitlementStatus} from '../Common/AppEvents';

/** Pure ad visibility rules shared by the provider and its regression tests. */
export const isAdEntitlementEligible = (
  vpnEntitlementStatus: VpnEntitlementStatus,
  adsRemovalUnlocked: boolean,
): boolean => (
  vpnEntitlementStatus !== 'ACTIVE'
  && vpnEntitlementStatus !== 'GRACE'
  && !adsRemovalUnlocked
);

/** The first mounted sticky host owns the single available sticky placement. */
export const getActiveStickyPlacement = <Placement>(claims: readonly Placement[]): Placement | undefined => (
  claims[0]
);

export const normalizeStickyReservedHeight = (height: number): number => Math.max(0, height);
