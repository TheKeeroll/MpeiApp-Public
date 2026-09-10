/**
 * Public template for src/config/Secrets.ts.
 *
 * Copy this file to Secrets.ts and fill values locally. Do not commit
 * Secrets.ts: it is intentionally ignored by Git.
 */
export const YANDEX_MAPS_API_KEY = '';

// Public DragoNet endpoint settings. Copy these fields to the ignored
// Secrets.ts before making a production build; they never contain panel
// credentials or a subscription URL.
export const DRAGONET_PROXY_DOMAIN = '';
export const DRAGONET_PROXY_PORT = 8443;
export const DRAGONET_PROXY_PATH = '';
export const DRAGONET_SUBSCRIPTION_PORT = 443;
export const DRAGONET_SUBSCRIPTION_PATH_PREFIX = '/sub';
export const DRAGONET_TELEGRAM_URL = 'https://t.me/DragonSavA';

export const YANDEX_AD_UNIT_IDS = {
  android: {
    inlineBannerMarks: '',
    inlineBannerDrawer: '',
    inlineBannerScheduleToday: '',
    inlineBannerGuestScheduleEmpty: '',
    stickyBannerLoading: '',
    stickyBannerSkippedClasses: '',
    stickyBannerDetailedMarks: '',
    stickyBannerRecordBook: '',
    stickyBannerStipends: '',
    rewarded: '',
  },
  ios: {
    inlineBannerMarks: '',
    inlineBannerDrawer: '',
    inlineBannerScheduleToday: '',
    inlineBannerGuestScheduleEmpty: '',
    stickyBannerLoading: '',
    stickyBannerSkippedClasses: '',
    stickyBannerDetailedMarks: '',
    stickyBannerRecordBook: '',
    stickyBannerStipends: '',
    rewarded: '',
  },
} as const;
