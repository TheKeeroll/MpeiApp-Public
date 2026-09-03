/**
 * Shared DragoNet contracts. They contain no credentials and perform no I/O;
 * transport, MMKV persistence, policy, and React UI will be connected later.
 */

export type VpnVerificationResult =
  | 'ACTIVE'
  | 'INACTIVE_CONFIRMED'
  | 'TRANSIENT_FAILURE'
  | 'OFFLINE_SKIPPED';

export type VpnEntitlementStatus = 'ACTIVE' | 'GRACE' | 'REVOKED' | 'NONE';

export type VpnVerificationState = {
  clientName?: string;
  lastVerifiedAt?: string;
  technicalFailureStreak: number;
  firstTechnicalFailureAt?: string;
  inactiveStreak: number;
  firstInactiveAt?: string;
  lastEffectiveStatus: VpnEntitlementStatus;
};

export type VpnProxyVerifyResponse =
  | {
    reqStatus: 'success';
    isClientFound: boolean;
    isClientActive: boolean;
  }
  | {
    reqStatus: 'failed';
  };

export type VpnProxyDemoResponse =
  | {
    reqStatus: 'success';
    demoSubURL: string;
  }
  | {
    reqStatus: 'failed';
  };

export type VpnProxyRequest =
  | {
    purpose: 'verify';
    clientName: string;
  }
  | {
    purpose: 'demo';
  };
