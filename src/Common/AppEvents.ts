/**
 * Cross-feature events whose producers and consumers are intentionally kept
 * separate.  The VPN service added in a later stage updates this event after
 * every completed verification so ad placement gates react in the same app
 * session.
 */
export const APP_EVENTS = {
  VPN_ENTITLEMENT_CHANGED: 'VpnEntitlementChanged',
} as const;

export type VpnEntitlementStatus = 'ACTIVE' | 'GRACE' | 'REVOKED' | 'NONE';

export type VpnEntitlementChangedEvent = {
  status: VpnEntitlementStatus;
};
