import {
  getActiveStickyPlacement,
  isAdEntitlementEligible,
  normalizeStickyReservedHeight,
} from '../src/Ads/AdVisibilityPolicy';

describe('ad placement visibility policy', () => {
  it.each([
    ['NONE', false, true],
    ['REVOKED', false, true],
    ['ACTIVE', false, false],
    ['GRACE', false, false],
    ['NONE', true, false],
  ] as const)('allows ads for %s with loyalty unlock %s: %s', (status, adsRemovalUnlocked, expected) => {
    expect(isAdEntitlementEligible(status, adsRemovalUnlocked)).toBe(expected);
  });

  it('keeps exactly one sticky placement active in registration order', () => {
    expect(getActiveStickyPlacement(['loading', 'recordBook', 'stipends'])).toBe('loading');
    expect(getActiveStickyPlacement([])).toBeUndefined();
  });

  it('never reserves a negative sticky-ad padding', () => {
    expect(normalizeStickyReservedHeight(-24)).toBe(0);
    expect(normalizeStickyReservedHeight(56)).toBe(56);
  });
});
