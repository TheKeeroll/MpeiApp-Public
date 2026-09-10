import type {VpnEntitlementStatus, VpnVerificationResult, VpnVerificationState} from './types';
import {createInitialVpnVerificationState, normalizeVpnVerificationState} from './VpnSubscriptionStorage';

export const VPN_VERIFICATION_THRESHOLDS = Object.freeze({
  maxTechnicalFailureStreak: 10,
  technicalFailureGraceCount: 3,
  technicalFailureGraceDays: 7,
  inactiveGraceCount: 3,
  inactiveGraceDays: 3,
});

const DAY_MS = 24 * 60 * 60 * 1000;

const hasActiveEntitlement = (status: VpnEntitlementStatus): boolean => (
  status === 'ACTIVE' || status === 'GRACE'
);

const reachedGraceDeadline = (firstFailureAt: string | undefined, days: number, now: Date): boolean => {
  if (!firstFailureAt) {
    return false;
  }

  const firstFailureTime = Date.parse(firstFailureAt);
  return Number.isFinite(firstFailureTime) && now.getTime() - firstFailureTime >= days * DAY_MS;
};

const getNonActiveStatus = (
  previousStatus: VpnEntitlementStatus,
  shouldRevoke: boolean,
): VpnEntitlementStatus => {
  if (shouldRevoke) {
    return 'REVOKED';
  }
  return hasActiveEntitlement(previousStatus) ? 'GRACE' : previousStatus;
};

/** Applies the grace/revoke policy without performing any I/O. */
export const applyVpnVerificationResult = (
  currentState: VpnVerificationState,
  result: VpnVerificationResult,
  now = new Date(),
): VpnVerificationState => {
  const current = normalizeVpnVerificationState(currentState);
  const nowIso = now.toISOString();

  switch (result) {
    case 'ACTIVE':
      return {
        ...createInitialVpnVerificationState(current.clientName),
        lastVerifiedAt: nowIso,
        lastEffectiveStatus: 'ACTIVE',
      };
    case 'INACTIVE_CONFIRMED': {
      const inactiveStreak = current.inactiveStreak + 1;
      const firstInactiveAt = current.firstInactiveAt ?? nowIso;
      const shouldRevoke = inactiveStreak >= VPN_VERIFICATION_THRESHOLDS.inactiveGraceCount
        && reachedGraceDeadline(firstInactiveAt, VPN_VERIFICATION_THRESHOLDS.inactiveGraceDays, now);
      return {
        ...current,
        technicalFailureStreak: 0,
        firstTechnicalFailureAt: undefined,
        inactiveStreak,
        firstInactiveAt,
        lastEffectiveStatus: getNonActiveStatus(current.lastEffectiveStatus, shouldRevoke),
      };
    }
    case 'TRANSIENT_FAILURE': {
      const technicalFailureStreak = current.technicalFailureStreak + 1;
      const firstTechnicalFailureAt = current.firstTechnicalFailureAt ?? nowIso;
      const shouldRevoke = technicalFailureStreak >= VPN_VERIFICATION_THRESHOLDS.maxTechnicalFailureStreak
        || (
          technicalFailureStreak >= VPN_VERIFICATION_THRESHOLDS.technicalFailureGraceCount
          && reachedGraceDeadline(
            firstTechnicalFailureAt,
            VPN_VERIFICATION_THRESHOLDS.technicalFailureGraceDays,
            now,
          )
        );
      return {
        ...current,
        technicalFailureStreak,
        firstTechnicalFailureAt,
        inactiveStreak: 0,
        firstInactiveAt: undefined,
        lastEffectiveStatus: getNonActiveStatus(current.lastEffectiveStatus, shouldRevoke),
      };
    }
    case 'OFFLINE_SKIPPED':
      return current;
  }
};

export const isVpnEntitlementActive = (status: VpnEntitlementStatus): boolean => (
  status === 'ACTIVE' || status === 'GRACE'
);
