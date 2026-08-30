import {createMMKV, type MMKV} from 'react-native-mmkv';
import type {AppIconName, QRFrameName} from '../API/BARS';
import {
  getLoyaltyCatalogItem,
  type LoyaltyCatalogItem,
  type LoyaltyItemId,
} from './LoyaltyCatalog';

const LOYALTY_STORAGE_KEY = 'state';
const MAX_REWARDED_VIEWS_PER_DAY = 5;

export type LoyaltyFeature = 'route' | 'qrRegistration' | 'scheduleSearch';

export const DAILY_FREE_ATTEMPT_LIMITS: Record<LoyaltyFeature, number> = {
  route: 3,
  qrRegistration: 1,
  scheduleSearch: 3,
};

export type LoyaltyState = {
  balance: number;
  lastLoginRewardDay?: string;
  rewardedDay?: string;
  rewardedViewsToday: number;
  dailyUsageDay: string;
  dailyFeatureUses: Record<LoyaltyFeature, number>;
  unlockedIconIds: Exclude<AppIconName, 'cool'>[];
  unlockedQRFrameIds: Exclude<QRFrameName, 'qr-frame'>[];
  lightThemeUnlocked: boolean;
  adsRemovalUnlocked: boolean;
};

export type FeatureUsageResult = {
  usedFreeAttempt: boolean;
  spentTokens: number;
  usedZeroBalanceFallback: boolean;
  ignored: boolean;
};

export type LoyaltyPurchaseResult =
  | {status: 'PURCHASED'; item: LoyaltyCatalogItem}
  | {status: 'ALREADY_PURCHASED'; item: LoyaltyCatalogItem}
  | {status: 'INSUFFICIENT_BALANCE'; item: LoyaltyCatalogItem};

type LoyaltyStorage = Pick<MMKV, 'getString' | 'set'>;
type LoyaltyListener = (state: LoyaltyState) => void;

export const getLocalDay = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toNonNegativeInteger = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
);

const cloneState = (state: LoyaltyState): LoyaltyState => ({
  ...state,
  dailyFeatureUses: {...state.dailyFeatureUses},
  unlockedIconIds: [...state.unlockedIconIds],
  unlockedQRFrameIds: [...state.unlockedQRFrameIds],
});

const normalizeState = (rawState: Partial<LoyaltyState>, day: string): LoyaltyState => {
  const rawFeatureUses = rawState.dailyUsageDay === day ? rawState.dailyFeatureUses : undefined;
  const unlockedIconIds = Array.isArray(rawState.unlockedIconIds)
    ? rawState.unlockedIconIds.filter((icon): icon is Exclude<AppIconName, 'cool'> => (
      typeof icon === 'string'
      && ['dragons', 'simple', 'matterial', 'gold', 'crymat', 'crysign'].includes(icon)
    ))
    : [];
  const unlockedQRFrameIds = Array.isArray(rawState.unlockedQRFrameIds)
    ? rawState.unlockedQRFrameIds.filter((frame): frame is Exclude<QRFrameName, 'qr-frame'> => (
      typeof frame === 'string'
      && ['empty', 'qr-frame-black', 'qr-frame-green', 'qr-frame-red'].includes(frame)
    ))
    : [];

  return {
    balance: toNonNegativeInteger(rawState.balance),
    lastLoginRewardDay: typeof rawState.lastLoginRewardDay === 'string' ? rawState.lastLoginRewardDay : undefined,
    rewardedDay: rawState.rewardedDay === day ? day : undefined,
    rewardedViewsToday: rawState.rewardedDay === day
      ? Math.min(MAX_REWARDED_VIEWS_PER_DAY, toNonNegativeInteger(rawState.rewardedViewsToday))
      : 0,
    dailyUsageDay: day,
    dailyFeatureUses: {
      route: toNonNegativeInteger(rawFeatureUses?.route),
      qrRegistration: toNonNegativeInteger(rawFeatureUses?.qrRegistration),
      scheduleSearch: toNonNegativeInteger(rawFeatureUses?.scheduleSearch),
    },
    unlockedIconIds: [...new Set(unlockedIconIds)],
    unlockedQRFrameIds: [...new Set(unlockedQRFrameIds)],
    lightThemeUnlocked: rawState.lightThemeUnlocked === true,
    adsRemovalUnlocked: rawState.adsRemovalUnlocked === true,
  };
};

/**
 * All balance and daily-limit mutations pass through this synchronous service.
 * The dedicated MMKV instance deliberately survives BARS.ClearStorage().
 */
export class LoyaltyService {
  private readonly listeners = new Set<LoyaltyListener>();
  private state: LoyaltyState;

  public constructor(
    private readonly storage: LoyaltyStorage = createMMKV({id: 'mpeiapp-loyalty'}),
    private readonly now: () => Date = () => new Date(),
    private readonly random: () => number = Math.random,
  ) {
    this.state = this.readInitialState();
  }

  public getState(): LoyaltyState {
    this.refreshCurrentDay();
    return cloneState(this.state);
  }

  public subscribe(listener: LoyaltyListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public refreshCurrentDay(): void {
    const normalized = normalizeState(this.state, getLocalDay(this.now()));
    this.commit(normalized);
  }

  public claimDailyLoginReward(): number {
    const day = getLocalDay(this.now());
    let reward = 0;

    this.mutate(state => {
      if (state.lastLoginRewardDay === day) {
        return;
      }

      reward = 1;
      state.lastLoginRewardDay = day;
      state.balance += reward;
    });

    return reward;
  }

  public getNextRewardedReward(): number | undefined {
    const state = this.getState();
    if (state.rewardedViewsToday >= MAX_REWARDED_VIEWS_PER_DAY) {
      return undefined;
    }

    return this.getRewardedRewardAmount(state.rewardedViewsToday);
  }

  public grantRewardedReward(): number | undefined {
    let reward: number | undefined;

    this.mutate(state => {
      if (state.rewardedViewsToday >= MAX_REWARDED_VIEWS_PER_DAY) {
        return;
      }

      reward = this.getRewardedRewardAmount(state.rewardedViewsToday);
      state.rewardedDay = getLocalDay(this.now());
      state.rewardedViewsToday += 1;
      state.balance += reward;
    });

    return reward;
  }

  public recordSuccessfulFeatureUse(
    feature: LoyaltyFeature,
    options: {ignore?: boolean; premiumAccess?: boolean} = {},
  ): FeatureUsageResult {
    if (options.ignore || options.premiumAccess) {
      return {
        usedFreeAttempt: false,
        spentTokens: 0,
        usedZeroBalanceFallback: false,
        ignored: true,
      };
    }

    let result: FeatureUsageResult = {
      usedFreeAttempt: false,
      spentTokens: 0,
      usedZeroBalanceFallback: false,
      ignored: false,
    };

    this.mutate(state => {
      const limit = DAILY_FREE_ATTEMPT_LIMITS[feature];
      if (state.dailyFeatureUses[feature] < limit) {
        state.dailyFeatureUses[feature] += 1;
        result = {...result, usedFreeAttempt: true};
        return;
      }

      if (state.balance > 0) {
        state.balance -= 1;
        result = {...result, spentTokens: 1};
        return;
      }

      result = {...result, usedZeroBalanceFallback: true};
    });

    return result;
  }

  public purchase(itemId: LoyaltyItemId): LoyaltyPurchaseResult {
    const item = getLoyaltyCatalogItem(itemId);
    let result: LoyaltyPurchaseResult = {status: 'ALREADY_PURCHASED', item};

    this.mutate(state => {
      if (this.isItemOwned(state, item)) {
        result = {status: 'ALREADY_PURCHASED', item};
        return;
      }

      if (state.balance < item.price) {
        result = {status: 'INSUFFICIENT_BALANCE', item};
        return;
      }

      state.balance -= item.price;
      switch (item.kind) {
        case 'theme':
          state.lightThemeUnlocked = true;
          break;
        case 'icon':
          if (item.iconName && !state.unlockedIconIds.includes(item.iconName)) {
            state.unlockedIconIds.push(item.iconName);
          }
          break;
        case 'qr-frame':
          if (item.frameName && !state.unlockedQRFrameIds.includes(item.frameName)) {
            state.unlockedQRFrameIds.push(item.frameName);
          }
          break;
        case 'ads-removal':
          state.adsRemovalUnlocked = true;
          break;
      }
      result = {status: 'PURCHASED', item};
    });

    return result;
  }

  private readInitialState(): LoyaltyState {
    const day = getLocalDay(this.now());
    const raw = this.storage.getString(LOYALTY_STORAGE_KEY);
    if (!raw) {
      const state = normalizeState({}, day);
      this.persist(state);
      return state;
    }

    try {
      const state = normalizeState(JSON.parse(raw) as Partial<LoyaltyState>, day);
      this.persist(state);
      return state;
    } catch {
      const state = normalizeState({}, day);
      this.persist(state);
      return state;
    }
  }

  private mutate(mutator: (state: LoyaltyState) => void): void {
    const state = normalizeState(this.state, getLocalDay(this.now()));
    mutator(state);
    this.commit(normalizeState(state, getLocalDay(this.now())));
  }

  private commit(nextState: LoyaltyState): void {
    if (JSON.stringify(this.state) === JSON.stringify(nextState)) {
      return;
    }

    this.state = cloneState(nextState);
    this.persist(this.state);
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }

  private persist(state: LoyaltyState): void {
    this.storage.set(LOYALTY_STORAGE_KEY, JSON.stringify(state));
  }

  private getSnapshot(): LoyaltyState {
    return cloneState(this.state);
  }

  private getRewardedRewardAmount(successfulViewsToday: number): number {
    if (successfulViewsToday === 0) {
      return 10;
    }
    if (successfulViewsToday === 1) {
      return 6;
    }

    return 2 + Math.floor(Math.max(0, Math.min(0.999999, this.random())) * 4);
  }

  private isItemOwned(state: LoyaltyState, item: LoyaltyCatalogItem): boolean {
    switch (item.kind) {
      case 'theme':
        return state.lightThemeUnlocked;
      case 'icon':
        return item.iconName ? state.unlockedIconIds.includes(item.iconName) : false;
      case 'qr-frame':
        return item.frameName ? state.unlockedQRFrameIds.includes(item.frameName) : false;
      case 'ads-removal':
        return state.adsRemovalUnlocked;
    }
  }
}

export const loyaltyService = new LoyaltyService();
