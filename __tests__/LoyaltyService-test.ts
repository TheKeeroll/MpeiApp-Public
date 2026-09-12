import {LoyaltyService} from '../src/Loyalty/LoyaltyService';

const day = new Date('2026-09-12T12:00:00.000Z');

const createStorage = (initial?: Record<string, unknown>) => {
  const values = new Map<string, string>();
  if (initial) {
    values.set('state', JSON.stringify(initial));
  }
  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, value),
  };
};

describe('loyalty token economy', () => {
  it('uses free attempts first, then one token, and honours premium access', () => {
    const service = new LoyaltyService(createStorage({
      balance: 2,
      dailyUsageDay: '2026-09-12',
      dailyFeatureUses: {route: 2, qrRegistration: 0, scheduleSearch: 0},
    }), () => day, () => 0.5);

    expect(service.recordSuccessfulFeatureUse('route')).toMatchObject({usedFreeAttempt: true, spentTokens: 0});
    expect(service.recordSuccessfulFeatureUse('route')).toMatchObject({usedFreeAttempt: false, spentTokens: 1});
    expect(service.getState().balance).toBe(1);
    expect(service.recordSuccessfulFeatureUse('route', {premiumAccess: true})).toEqual({
      usedFreeAttempt: false,
      spentTokens: 0,
      usedZeroBalanceFallback: false,
      ignored: true,
    });
    expect(service.getState().balance).toBe(1);
  });

  it('grants the fixed first rewards and enforces the daily rewarded limit', () => {
    const service = new LoyaltyService(createStorage(), () => day, () => 0.99);

    expect(service.grantRewardedReward()).toBe(10);
    expect(service.grantRewardedReward()).toBe(6);
    expect(service.grantRewardedReward()).toBe(5);
    expect(service.grantRewardedReward()).toBe(5);
    expect(service.grantRewardedReward()).toBe(5);
    expect(service.grantRewardedReward()).toBeUndefined();
    expect(service.getState().balance).toBe(31);
  });
});
