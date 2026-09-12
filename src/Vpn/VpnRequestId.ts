import {Platform} from 'react-native';

const MOSCOW_TIME_ZONE = 'Europe/Moscow';

const pad = (value: number): string => String(value).padStart(2, '0');

const getMoscowDateFallback = (now: Date): string => {
  const moscow = new Date(now.getTime() + 3 * 60 * 60 * 1_000);
  return `${pad(moscow.getUTCDate())}-${pad(moscow.getUTCMonth() + 1)}-${moscow.getUTCFullYear()}`;
};

/** Builds the Moscow calendar date expected by the proxy request gate. */
export const getMoscowRequestDate = (now = new Date()): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: MOSCOW_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const day = parts.find(part => part.type === 'day')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const year = parts.find(part => part.type === 'year')?.value;
    return day && month && year ? `${day}-${month}-${year}` : getMoscowDateFallback(now);
  } catch {
    return getMoscowDateFallback(now);
  }
};

const normaliseDevicePart = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }
  const normalized = String(value)
    .normalize('NFKC')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized && normalized.length <= 120 ? normalized : undefined;
};

/**
 * Platform constants are synchronous and already available to React Native.
 * No runtime permission is requested: a serial is used only when the native
 * platform has exposed it, otherwise the OS/version/model fallback is stable
 * enough for the proxy's device cooldown gate.
 */
export type VpnRequestDeviceDetails = Readonly<{
  os: unknown;
  version: unknown;
  constants: unknown;
}>;

export const getVpnRequestDeviceIdFromDetails = ({
  os: rawOs,
  version: rawVersion,
  constants: rawConstants,
}: VpnRequestDeviceDetails): string => {
  const constants = rawConstants && typeof rawConstants === 'object'
    ? rawConstants as Record<string, unknown>
    : {};
  const serial = normaliseDevicePart(constants.Serial ?? constants.serial);
  if (serial && !/^unknown$/i.test(serial)) {
    return `serial-${serial}`;
  }

  const os = normaliseDevicePart(rawOs) ?? 'unknown-os';
  const version = normaliseDevicePart(rawVersion) ?? 'unknown-version';
  const model = normaliseDevicePart(constants.Model ?? constants.model ?? constants.systemName) ?? 'unknown-model';
  return `${os}-${version}-${model}`.slice(0, 160);
};

export const getVpnRequestDeviceId = (): string => getVpnRequestDeviceIdFromDetails({
  os: Platform.OS,
  version: Platform.Version,
  constants: Platform.constants,
});

export const createVpnRequestId = (now = new Date(), deviceId = getVpnRequestDeviceId()): string => (
  `DragoNet-${getMoscowRequestDate(now)}-${deviceId}`
);
