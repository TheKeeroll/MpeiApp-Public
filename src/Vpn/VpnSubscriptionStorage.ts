import type {VpnDemoAccess, VpnEntitlementStatus, VpnVerificationState} from './types';

export const VPN_DEMO_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
export const VPN_DEMO_MINIMUM_REMAINING_MS = 60 * 60 * 1000;

export type VpnStorageBackend = Readonly<{
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}>;

export type VpnStorageKeys = Readonly<{
  verificationState: string;
  demoAccess: string;
}>;

export type VpnSubscriptionStorage = Readonly<{
  readVerificationState: () => VpnVerificationState;
  writeVerificationState: (state: VpnVerificationState) => void;
  clearVerificationState: () => void;
  readDemoAccess: () => VpnDemoAccess | undefined;
  writeDemoAccess: (access: VpnDemoAccess) => void;
  clearDemoAccess: () => void;
}>;

const isEntitlementStatus = (value: unknown): value is VpnEntitlementStatus => (
  value === 'ACTIVE' || value === 'GRACE' || value === 'REVOKED' || value === 'NONE'
);

const toNonNegativeInteger = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
);

const toIsoTimestamp = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
};

const isValidClientName = (value: unknown): value is string => (
  typeof value === 'string'
  && value.length > 0
  && value.length <= 256
  && !/[\u0000-\u001F\u007F-\u009F/]/.test(value)
  && !value.includes('/')
  && !value.includes('\\')
);

const isValidDemoUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname.length > 1;
  } catch {
    return false;
  }
};

export const createInitialVpnVerificationState = (clientName?: string): VpnVerificationState => ({
  ...(clientName ? {clientName} : {}),
  technicalFailureStreak: 0,
  inactiveStreak: 0,
  lastEffectiveStatus: 'NONE',
});

export const normalizeVpnVerificationState = (value: unknown): VpnVerificationState => {
  const raw = value && typeof value === 'object' ? value as Partial<VpnVerificationState> : {};
  const clientName = isValidClientName(raw.clientName) ? raw.clientName : undefined;

  return {
    ...(clientName ? {clientName} : {}),
    ...(toIsoTimestamp(raw.lastVerifiedAt) ? {lastVerifiedAt: toIsoTimestamp(raw.lastVerifiedAt)} : {}),
    technicalFailureStreak: toNonNegativeInteger(raw.technicalFailureStreak),
    ...(toIsoTimestamp(raw.firstTechnicalFailureAt)
      ? {firstTechnicalFailureAt: toIsoTimestamp(raw.firstTechnicalFailureAt)}
      : {}),
    inactiveStreak: toNonNegativeInteger(raw.inactiveStreak),
    ...(toIsoTimestamp(raw.firstInactiveAt) ? {firstInactiveAt: toIsoTimestamp(raw.firstInactiveAt)} : {}),
    lastEffectiveStatus: isEntitlementStatus(raw.lastEffectiveStatus) ? raw.lastEffectiveStatus : 'NONE',
  };
};

export const getDemoAccessExpiresAt = (access: VpnDemoAccess): Date | undefined => {
  const receivedAt = Date.parse(access.receivedAt);
  return Number.isFinite(receivedAt) ? new Date(receivedAt + VPN_DEMO_DURATION_MS) : undefined;
};

export const isDemoAccessAvailable = (access: VpnDemoAccess, now = new Date()): boolean => {
  const expiresAt = getDemoAccessExpiresAt(access);
  return !!expiresAt && expiresAt.getTime() - now.getTime() >= VPN_DEMO_MINIMUM_REMAINING_MS;
};

const normalizeDemoAccess = (value: unknown): VpnDemoAccess | undefined => {
  const raw = value && typeof value === 'object' ? value as Partial<VpnDemoAccess> : {};
  const receivedAt = toIsoTimestamp(raw.receivedAt);
  return isValidDemoUrl(raw.demoSubURL) && receivedAt
    ? {demoSubURL: raw.demoSubURL, receivedAt}
    : undefined;
};

/**
 * Stores the small, device-local DragoNet state in the app MMKV instance.
 * A demo URL is retained only until its three-day server lifetime has less
 * than one hour remaining, so reopening the app cannot make a valid demo
 * link disappear before the student has had a chance to import it.
 */
export const createVpnSubscriptionStorage = (
  storage: VpnStorageBackend,
  keys: VpnStorageKeys,
  now: () => Date = () => new Date(),
): VpnSubscriptionStorage => ({
  readVerificationState: () => {
    const raw = storage.getString(keys.verificationState);
    if (!raw) {
      return createInitialVpnVerificationState();
    }

    try {
      return normalizeVpnVerificationState(JSON.parse(raw));
    } catch {
      storage.remove(keys.verificationState);
      return createInitialVpnVerificationState();
    }
  },
  writeVerificationState: state => {
    storage.set(keys.verificationState, JSON.stringify(normalizeVpnVerificationState(state)));
  },
  clearVerificationState: () => storage.remove(keys.verificationState),
  readDemoAccess: () => {
    const raw = storage.getString(keys.demoAccess);
    if (!raw) {
      return undefined;
    }

    try {
      const access = normalizeDemoAccess(JSON.parse(raw));
      if (!access || !isDemoAccessAvailable(access, now())) {
        storage.remove(keys.demoAccess);
        return undefined;
      }
      return access;
    } catch {
      storage.remove(keys.demoAccess);
      return undefined;
    }
  },
  writeDemoAccess: access => {
    const normalized = normalizeDemoAccess(access);
    if (!normalized || !isDemoAccessAvailable(normalized, now())) {
      storage.remove(keys.demoAccess);
      return;
    }
    storage.set(keys.demoAccess, JSON.stringify(normalized));
  },
  clearDemoAccess: () => storage.remove(keys.demoAccess),
});
