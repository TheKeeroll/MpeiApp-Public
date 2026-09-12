import {createInitialVpnVerificationState} from '../src/Vpn/VpnSubscriptionStorage';
import {applyVpnVerificationResult} from '../src/Vpn/VpnVerificationPolicy';

const now = new Date('2026-09-12T12:00:00.000Z');

describe('DragoNet verification policy', () => {
  it('resets every failure counter after an active verification', () => {
    const state = applyVpnVerificationResult({
      clientName: 'student',
      technicalFailureStreak: 7,
      firstTechnicalFailureAt: '2026-09-01T12:00:00.000Z',
      inactiveStreak: 2,
      firstInactiveAt: '2026-09-09T12:00:00.000Z',
      lastEffectiveStatus: 'REVOKED',
    }, 'ACTIVE', now);

    expect(state).toEqual({
      ...createInitialVpnVerificationState('student'),
      lastVerifiedAt: now.toISOString(),
      lastEffectiveStatus: 'ACTIVE',
    });
  });

  it('keeps access in grace for transient failures before the threshold', () => {
    const first = applyVpnVerificationResult({
      ...createInitialVpnVerificationState('student'),
      lastEffectiveStatus: 'ACTIVE',
    }, 'TRANSIENT_FAILURE', now);
    const thirdBeforeDeadline = applyVpnVerificationResult({
      ...first,
      technicalFailureStreak: 2,
      firstTechnicalFailureAt: '2026-09-06T12:00:00.000Z',
    }, 'TRANSIENT_FAILURE', now);

    expect(first.lastEffectiveStatus).toBe('GRACE');
    expect(thirdBeforeDeadline.lastEffectiveStatus).toBe('GRACE');
  });

  it('revokes after three technical failures spanning seven days or ten failures immediately', () => {
    const afterGraceDeadline = applyVpnVerificationResult({
      ...createInitialVpnVerificationState('student'),
      technicalFailureStreak: 2,
      firstTechnicalFailureAt: '2026-09-05T12:00:00.000Z',
      lastEffectiveStatus: 'ACTIVE',
    }, 'TRANSIENT_FAILURE', now);
    const tenthFailure = applyVpnVerificationResult({
      ...createInitialVpnVerificationState('student'),
      technicalFailureStreak: 9,
      firstTechnicalFailureAt: '2026-09-12T11:00:00.000Z',
      lastEffectiveStatus: 'ACTIVE',
    }, 'TRANSIENT_FAILURE', now);

    expect(afterGraceDeadline.lastEffectiveStatus).toBe('REVOKED');
    expect(tenthFailure.lastEffectiveStatus).toBe('REVOKED');
  });

  it('revokes after three confirmed inactive checks spanning 72 hours', () => {
    const state = applyVpnVerificationResult({
      ...createInitialVpnVerificationState('student'),
      inactiveStreak: 2,
      firstInactiveAt: '2026-09-09T12:00:00.000Z',
      lastEffectiveStatus: 'ACTIVE',
    }, 'INACTIVE_CONFIRMED', now);

    expect(state.inactiveStreak).toBe(3);
    expect(state.lastEffectiveStatus).toBe('REVOKED');
  });

  it('leaves counters untouched while offline', () => {
    const current = {
      ...createInitialVpnVerificationState('student'),
      technicalFailureStreak: 2,
      firstTechnicalFailureAt: '2026-09-10T12:00:00.000Z',
      lastEffectiveStatus: 'GRACE' as const,
    };
    expect(applyVpnVerificationResult(current, 'OFFLINE_SKIPPED', now)).toEqual(current);
  });
});
