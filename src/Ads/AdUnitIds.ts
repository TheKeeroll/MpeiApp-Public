import {Platform} from 'react-native';
import * as Secrets from '../config/Secrets';
import {
  getYandexAdFormat,
  type YandexAdFormat,
  type YandexAdUnitPlacement,
} from './AdPlacements';

type OptionalSecrets = {
  YANDEX_AD_UNIT_IDS?: Partial<{
    android: Partial<Record<YandexAdUnitPlacement, string>>;
    ios: Partial<Record<YandexAdUnitPlacement, string>>;
  }>;
};

const DEMO_AD_UNIT_IDS: Record<YandexAdFormat, string> = {
  inlineBanner: 'demo-banner-yandex',
  stickyBanner: 'demo-banner-yandex',
  rewarded: 'demo-rewarded-yandex',
};

const warnedMissingIds = new Set<string>();

const getConfiguredAdUnitId = (
  platform: string,
  placement: YandexAdUnitPlacement,
): string | undefined => {
  if (platform !== 'android' && platform !== 'ios') {
    return undefined;
  }

  const configuration = (Secrets as OptionalSecrets).YANDEX_AD_UNIT_IDS;
  const value = configuration?.[platform]?.[placement];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

type AdUnitIdResolutionOptions = {
  platform: string;
  isDevelopment: boolean;
  configuredId?: string;
};

export const resolveYandexAdUnitId = (
  placement: YandexAdUnitPlacement,
  {platform, isDevelopment, configuredId}: AdUnitIdResolutionOptions,
): string | undefined => {
  const format = getYandexAdFormat(placement);
  if (isDevelopment) {
    return DEMO_AD_UNIT_IDS[format];
  }

  if (platform !== 'android' && platform !== 'ios') {
    return undefined;
  }

  return typeof configuredId === 'string' && configuredId.trim().length > 0
    ? configuredId.trim()
    : undefined;
};

/**
 * Debug builds always use Yandex demo IDs. A release build may only request
 * its configured production ID: falling back to a demo ID here would hide a
 * configuration mistake and ship test advertising to users.
 */
export const getYandexAdUnitId = (placement: YandexAdUnitPlacement): string | undefined => {
  const platform = Platform.OS;
  const id = resolveYandexAdUnitId(placement, {
    platform,
    isDevelopment: __DEV__,
    configuredId: getConfiguredAdUnitId(platform, placement),
  });
  if (id) {
    return id;
  }

  const warningKey = `${platform}:${placement}`;
  if (!__DEV__ && (platform === 'android' || platform === 'ios') && !warnedMissingIds.has(warningKey)) {
    warnedMissingIds.add(warningKey);
    console.warn(`Yandex ${placement} ad slot is disabled because no production ID is configured.`);
  }
  return undefined;
};
