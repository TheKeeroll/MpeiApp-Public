/**
 * Pure rules for the case where BARS accepts 2FA but has not yet prepared a
 * student's personal account. The login flow will use these rules in stage 1.
 */

export const MOSCOW_TIME_ZONE = 'Europe/Moscow';

export const STUDENT_ACCOUNT_PENDING_MONTHS = [1, 2, 8, 9] as const;

export type StudentAccountAuthenticationPhase =
  | 'PASSWORD_SUBMITTED'
  | 'AWAITING_2FA'
  | 'TWO_FACTOR_ACCEPTED'
  | 'STUDENT_DATA_READY';

export type StudentAccountStateCandidate = {
  isPrimaryOnlineAttempt: boolean;
  authenticationPhase: StudentAccountAuthenticationPhase;
  hasStudentData: boolean;
  occurredAt?: Date;
};

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

/**
 * Returns the calendar month in Moscow without relying on the device's local
 * time zone. Undefined means that the platform could not format the date and
 * callers must fail closed rather than misclassify an authentication error.
 */
export const getMoscowMonth = (date: Date = new Date()): number | undefined => {
  if (!isValidDate(date)) {
    return undefined;
  }

  try {
    const monthPart = new Intl.DateTimeFormat('en-US', {
      timeZone: MOSCOW_TIME_ZONE,
      month: 'numeric',
    }).formatToParts(date).find(part => part.type === 'month');
    const month = Number(monthPart?.value);
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined;
  } catch {
    return undefined;
  }
};

export const isStudentAccountPendingMonth = (date: Date = new Date()): boolean => {
  const month = getMoscowMonth(date);
  return month !== undefined && STUDENT_ACCOUNT_PENDING_MONTHS.includes(month as 1 | 2 | 8 | 9);
};

/**
 * A missing student account is a business state only after an accepted 2FA
 * response in a new online login. All other failures remain ordinary login or
 * data-loading errors.
 */
export const shouldEnterStudentsNotFoundState = (
  candidate: StudentAccountStateCandidate,
): boolean => (
  candidate.isPrimaryOnlineAttempt
  && candidate.authenticationPhase === 'TWO_FACTOR_ACCEPTED'
  && !candidate.hasStudentData
  && isStudentAccountPendingMonth(candidate.occurredAt)
);

/**
 * Keeps the first and last visible password symbols, masking every symbol
 * between them. A one- or two-symbol password has no intermediate symbols to
 * mask, so it is returned unchanged.
 */
export const maskSavedPassword = (password: string): string => {
  const symbols = Array.from(password);
  if (symbols.length <= 2) {
    return password;
  }

  return symbols[0] + '*'.repeat(symbols.length - 2) + symbols[symbols.length - 1];
};
