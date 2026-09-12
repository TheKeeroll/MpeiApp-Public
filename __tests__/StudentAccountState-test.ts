import {
  STUDENT_ACCOUNT_PENDING_MONTHS,
  isStudentAccountPendingMonth,
  maskSavedPassword,
  shouldEnterStudentsNotFoundState,
} from '../src/Login/StudentAccountState';

const dateInMonth = (month: number): Date => new Date(Date.UTC(2026, month - 1, 15, 12));

describe('student account pending rules', () => {
  it.each(STUDENT_ACCOUNT_PENDING_MONTHS)('accepts a post-2FA missing account in month %i', month => {
    const occurredAt = dateInMonth(month);
    expect(isStudentAccountPendingMonth(occurredAt)).toBe(true);
    expect(shouldEnterStudentsNotFoundState({
      isPrimaryOnlineAttempt: true,
      authenticationPhase: 'TWO_FACTOR_ACCEPTED',
      hasStudentData: false,
      occurredAt,
    })).toBe(true);
  });

  it.each([3, 4, 5, 6, 7, 10, 11, 12])('does not classify other months as pending (%i)', month => {
    const occurredAt = dateInMonth(month);
    expect(isStudentAccountPendingMonth(occurredAt)).toBe(false);
    expect(shouldEnterStudentsNotFoundState({
      isPrimaryOnlineAttempt: true,
      authenticationPhase: 'TWO_FACTOR_ACCEPTED',
      hasStudentData: false,
      occurredAt,
    })).toBe(false);
  });

  it('requires an accepted 2FA response from the primary online attempt and no student', () => {
    const occurredAt = dateInMonth(9);
    expect(shouldEnterStudentsNotFoundState({
      isPrimaryOnlineAttempt: true,
      authenticationPhase: 'AWAITING_2FA',
      hasStudentData: false,
      occurredAt,
    })).toBe(false);
    expect(shouldEnterStudentsNotFoundState({
      isPrimaryOnlineAttempt: false,
      authenticationPhase: 'TWO_FACTOR_ACCEPTED',
      hasStudentData: false,
      occurredAt,
    })).toBe(false);
    expect(shouldEnterStudentsNotFoundState({
      isPrimaryOnlineAttempt: true,
      authenticationPhase: 'TWO_FACTOR_ACCEPTED',
      hasStudentData: true,
      occurredAt,
    })).toBe(false);
  });

  it('does not expose the middle of a saved password', () => {
    expect(maskSavedPassword('a')).toBe('a');
    expect(maskSavedPassword('ab')).toBe('ab');
    expect(maskSavedPassword('пароль')).toBe('п****ь');
  });
});
