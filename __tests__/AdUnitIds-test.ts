import {resolveYandexAdUnitId} from '../src/Ads/AdUnitIds';
import type {YandexAdUnitPlacement} from '../src/Ads/AdPlacements';

const mockAndroidIds = {
  inlineBannerMarks: 'android-marks',
  inlineBannerDrawer: 'android-drawer',
  inlineBannerScheduleToday: 'android-schedule-today',
  inlineBannerGuestScheduleEmpty: 'android-guest-schedule-empty',
  stickyBannerLoading: 'android-loading',
  stickyBannerSkippedClasses: 'android-skipped-classes',
  stickyBannerDetailedMarks: 'android-detailed-marks',
  stickyBannerRecordBook: 'android-record-book',
  stickyBannerStipends: 'android-stipends',
  rewarded: 'android-rewarded',
};

describe('resolveYandexAdUnitId', () => {
  it('uses the production ID configured for every Android placement in release builds', () => {
    (Object.entries(mockAndroidIds) as Array<[YandexAdUnitPlacement, string]>).forEach(([placement, id]) => {
      expect(resolveYandexAdUnitId(placement, {
        platform: 'android',
        isDevelopment: false,
        configuredId: id,
      })).toBe(id);
    });
  });

  it('uses demo IDs only in development and disables a missing release placement', () => {
    const placement: YandexAdUnitPlacement = 'stickyBannerStipends';

    expect(resolveYandexAdUnitId(placement, {
      platform: 'android',
      isDevelopment: true,
    })).toBe('demo-banner-yandex');
    expect(resolveYandexAdUnitId(placement, {
      platform: 'android',
      isDevelopment: false,
    })).toBeUndefined();
  });
});
