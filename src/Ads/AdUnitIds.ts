import {Platform} from 'react-native';
import * as Secrets from '../config/Secrets';

export type YandexAdFormat = 'inlineBanner' | 'stickyBanner' | 'rewarded';

type OptionalSecrets = {
  YANDEX_AD_UNIT_IDS?: Partial<{
    android: Partial<Record<YandexAdFormat, string>>;
    ios: Partial<Record<YandexAdFormat, string>>;
  }>;
};

const DEMO_AD_UNIT_IDS: Record<YandexAdFormat, string> = {
  inlineBanner: 'demo-banner-yandex',
  stickyBanner: 'demo-banner-yandex',
  rewarded: 'demo-rewarded-yandex',
};

const warnedMissingIds = new Set<string>();

const getConfiguredAdUnitId = (format: YandexAdFormat): string | undefined => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return undefined;
  }

  const configuration = (Secrets as OptionalSecrets).YANDEX_AD_UNIT_IDS;
  const value = configuration?.[Platform.OS]?.[format];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

/**
 * Debug builds always use Yandex demo IDs. A release build uses a configured
 * production ID when present, otherwise the demo ID so internal APK testing
 * never turns an ad placement into an empty request.
 */
export const getYandexAdUnitId = (format: YandexAdFormat): string | undefined => {
  if (__DEV__) {
    return DEMO_AD_UNIT_IDS[format];
  }

  const id = getConfiguredAdUnitId(format);
  if (id) {
    return id;
  }

  const warningKey = `${Platform.OS}:${format}`;
  if (!warnedMissingIds.has(warningKey)) {
    warnedMissingIds.add(warningKey);
    console.warn(`Yandex ${format} ad slot uses a demo ID because no production ID is configured.`);
  }
  return DEMO_AD_UNIT_IDS[format];
};
