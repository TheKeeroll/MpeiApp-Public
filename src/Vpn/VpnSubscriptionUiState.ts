import type {VpnEntitlementStatus} from './types';

export type DemoAccessUiState =
  | {kind: 'idle'}
  | {kind: 'requesting'}
  | {kind: 'ready'; demoSubURL: string; receivedAt: string}
  | {kind: 'unavailable'};

export type VpnSubscriptionUiState =
  | {kind: 'no-link'; entitlementStatus: 'NONE' | 'REVOKED'}
  | {kind: 'checking'; entitlementStatus: VpnEntitlementStatus}
  | {kind: 'active'; entitlementStatus: 'ACTIVE' | 'GRACE'}
  | {kind: 'inactive'; entitlementStatus: 'REVOKED'}
  | {kind: 'transient-error'; entitlementStatus: VpnEntitlementStatus}
  | {kind: 'offline'; entitlementStatus: VpnEntitlementStatus};
