/**
 * Shared DragoNet contracts. They contain no credentials and perform no I/O;
 * they are used by the transport, MMKV persistence, policy, and React UI.
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

export type VpnDemoAccess = {
  demoSubURL: string;
  /** ISO time at which the proxy returned the demo subscription URL. */
  receivedAt: string;
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
    /** Missing on legacy proxies; never infer a cooldown from an unknown failure. */
    reason?: 'demo_cooldown' | 'service_error';
  };

export type VpnProxyRequest =
  | {
    purpose: 'verify';
    clientName: string;
  }
  | {
    purpose: 'demo';
  };
