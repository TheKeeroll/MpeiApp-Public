/**
 * The source of truth for ad locations and the matching YANDEX_AD_UNIT_IDS
 * property names on Android and iOS.
 */

export const YANDEX_INLINE_AD_PLACEMENTS = {
  marks: 'inlineBannerMarks',
  drawer: 'inlineBannerDrawer',
  scheduleToday: 'inlineBannerScheduleToday',
  guestScheduleEmpty: 'inlineBannerGuestScheduleEmpty',
} as const;

export const YANDEX_STICKY_AD_PLACEMENTS = {
  loading: 'stickyBannerLoading',
  skippedClasses: 'stickyBannerSkippedClasses',
  detailedMarks: 'stickyBannerDetailedMarks',
  recordBook: 'stickyBannerRecordBook',
  stipends: 'stickyBannerStipends',
} as const;

export const YANDEX_REWARDED_AD_PLACEMENT = 'rewarded' as const;

export type YandexInlineAdPlacement = (
  typeof YANDEX_INLINE_AD_PLACEMENTS[keyof typeof YANDEX_INLINE_AD_PLACEMENTS]
);

export type YandexStickyAdPlacement = (
  typeof YANDEX_STICKY_AD_PLACEMENTS[keyof typeof YANDEX_STICKY_AD_PLACEMENTS]
);

export type YandexBannerPlacement = YandexInlineAdPlacement | YandexStickyAdPlacement;

export type YandexAdUnitPlacement = YandexBannerPlacement | typeof YANDEX_REWARDED_AD_PLACEMENT;

export type YandexBannerFormat = 'inlineBanner' | 'stickyBanner';
export type YandexAdFormat = YandexBannerFormat | 'rewarded';

const PLACEMENT_FORMATS: Record<YandexBannerPlacement, YandexBannerFormat> = {
  [YANDEX_INLINE_AD_PLACEMENTS.marks]: 'inlineBanner',
  [YANDEX_INLINE_AD_PLACEMENTS.drawer]: 'inlineBanner',
  [YANDEX_INLINE_AD_PLACEMENTS.scheduleToday]: 'inlineBanner',
  [YANDEX_INLINE_AD_PLACEMENTS.guestScheduleEmpty]: 'inlineBanner',
  [YANDEX_STICKY_AD_PLACEMENTS.loading]: 'stickyBanner',
  [YANDEX_STICKY_AD_PLACEMENTS.skippedClasses]: 'stickyBanner',
  [YANDEX_STICKY_AD_PLACEMENTS.detailedMarks]: 'stickyBanner',
  [YANDEX_STICKY_AD_PLACEMENTS.recordBook]: 'stickyBanner',
  [YANDEX_STICKY_AD_PLACEMENTS.stipends]: 'stickyBanner',
};

export const getYandexBannerFormat = (placement: YandexBannerPlacement): YandexBannerFormat => (
  PLACEMENT_FORMATS[placement]
);

export const getYandexAdFormat = (placement: YandexAdUnitPlacement): YandexAdFormat => (
  placement === YANDEX_REWARDED_AD_PLACEMENT ? 'rewarded' : getYandexBannerFormat(placement)
);
