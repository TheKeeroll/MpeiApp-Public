import React from 'react';
import {Alert, DeviceEventEmitter, Platform} from 'react-native';
import BARSAPI from '../Common/Globals';
import {APP_EVENTS, type VpnEntitlementChangedEvent, type VpnEntitlementStatus} from '../Common/AppEvents';
import {STORAGE_KEYS} from '../Common/Constants';
import type {AppIconName, LoginState} from '../API/BARS';
import {
  getIconLoyaltyCatalogItem,
  getLoyaltyCatalogItem,
  type LoyaltyCatalogItem,
  type LoyaltyItemId,
} from './LoyaltyCatalog';
import {
  DAILY_FREE_ATTEMPT_LIMITS,
  loyaltyService,
  type FeatureUsageResult,
  type LoyaltyFeature,
  type LoyaltyPurchaseResult,
  type LoyaltyState,
} from './LoyaltyService';

export type LoyaltyFeatureStatus = {
  feature: LoyaltyFeature;
  dailyLimit: number;
  usedToday: number;
  freeAttemptsRemaining: number;
  tokenCost: number;
  canStart: boolean;
  allowsZeroBalanceFallback: boolean;
  premiumAccess: boolean;
};

type LoyaltyContextValue = {
  state: LoyaltyState;
  displayedBalance: number | '∞';
  effectiveContentAccess: boolean;
  adsRemovalUnlocked: boolean;
  canUseLightTheme: boolean;
  canUseIcon: (iconName: AppIconName) => boolean;
  isCatalogItemOwned: (item: LoyaltyCatalogItem) => boolean;
  getCatalogItem: (itemId: LoyaltyItemId) => LoyaltyCatalogItem;
  getIconCatalogItem: (iconName: Exclude<AppIconName, 'cool'>) => LoyaltyCatalogItem;
  getFeatureStatus: (feature: LoyaltyFeature) => LoyaltyFeatureStatus;
  recordSuccessfulFeatureUse: (
    feature: LoyaltyFeature,
    options?: {ignore?: boolean},
  ) => FeatureUsageResult;
  getNextRewardedReward: () => number | undefined;
  grantRewardedReward: () => number | undefined;
  purchase: (itemId: LoyaltyItemId) => LoyaltyPurchaseResult | {status: 'PREMIUM_ACCESS'; item: LoyaltyCatalogItem};
};

const getCachedVpnEntitlementStatus = (): VpnEntitlementStatus => {
  const rawState = BARSAPI.mStorage.getString(STORAGE_KEYS.VPN_VERIFICATION_STATE);
  if (!rawState) {
    return 'NONE';
  }

  try {
    const status = (JSON.parse(rawState) as {lastEffectiveStatus?: unknown}).lastEffectiveStatus;
    return status === 'ACTIVE' || status === 'GRACE' || status === 'REVOKED' ? status : 'NONE';
  } catch {
    return 'NONE';
  }
};

const isVpnAccessActive = (status: VpnEntitlementStatus): boolean => (
  status === 'ACTIVE' || status === 'GRACE'
);

const unavailableContext: LoyaltyContextValue = {
  state: loyaltyService.getState(),
  displayedBalance: 0,
  effectiveContentAccess: false,
  adsRemovalUnlocked: false,
  canUseLightTheme: false,
  canUseIcon: iconName => iconName === 'cool',
  isCatalogItemOwned: () => false,
  getCatalogItem: getLoyaltyCatalogItem,
  getIconCatalogItem: getIconLoyaltyCatalogItem,
  getFeatureStatus: feature => ({
    feature,
    dailyLimit: DAILY_FREE_ATTEMPT_LIMITS[feature],
    usedToday: 0,
    freeAttemptsRemaining: DAILY_FREE_ATTEMPT_LIMITS[feature],
    tokenCost: 1,
    canStart: true,
    allowsZeroBalanceFallback: feature !== 'route',
    premiumAccess: false,
  }),
  recordSuccessfulFeatureUse: feature => loyaltyService.recordSuccessfulFeatureUse(feature),
  getNextRewardedReward: () => loyaltyService.getNextRewardedReward(),
  grantRewardedReward: () => loyaltyService.grantRewardedReward(),
  purchase: itemId => loyaltyService.purchase(itemId),
};

const LoyaltyContext = React.createContext<LoyaltyContextValue>(unavailableContext);

export const LoyaltyProvider: React.FC<React.PropsWithChildren> = ({children}) => {
  const [state, setState] = React.useState<LoyaltyState>(() => loyaltyService.getState());
  const [vpnEntitlementStatus, setVpnEntitlementStatus] = React.useState<VpnEntitlementStatus>(
    getCachedVpnEntitlementStatus,
  );
  const effectiveContentAccess = isVpnAccessActive(vpnEntitlementStatus);

  React.useEffect(() => loyaltyService.subscribe(setState), []);

  React.useEffect(() => {
    loyaltyService.refreshCurrentDay();
    const timer = setInterval(() => loyaltyService.refreshCurrentDay(), 60_000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const vpnSubscription = DeviceEventEmitter.addListener(
      APP_EVENTS.VPN_ENTITLEMENT_CHANGED,
      (event: VpnEntitlementChangedEvent | VpnEntitlementStatus) => {
        const status = typeof event === 'string' ? event : event?.status;
        setVpnEntitlementStatus(
          status === 'ACTIVE' || status === 'GRACE' || status === 'REVOKED' ? status : 'NONE',
        );
      },
    );
    const loginSubscription = DeviceEventEmitter.addListener('LoginState', (loginState: LoginState) => {
      if (loginState === 'LOGGED_IN') {
        loyaltyService.claimDailyLoginReward();
      }
    });

    if (BARSAPI.LoginState === 'LOGGED_IN') {
      loyaltyService.claimDailyLoginReward();
    }

    return () => {
      vpnSubscription.remove();
      loginSubscription.remove();
    };
  }, []);

  const canUseLightTheme = effectiveContentAccess || state.lightThemeUnlocked;

  React.useEffect(() => {
    if (!canUseLightTheme && !BARSAPI.Theme.dark) {
      BARSAPI.SetTheme('dark');
    }
  }, [canUseLightTheme]);

  const canUseIcon = React.useCallback((iconName: AppIconName): boolean => (
    iconName === 'cool'
    || effectiveContentAccess
    || state.unlockedIconIds.includes(iconName as Exclude<AppIconName, 'cool'>)
  ), [effectiveContentAccess, state.unlockedIconIds]);

  const hadVpnContentAccess = React.useRef(effectiveContentAccess);
  React.useEffect(() => {
    const lostVpnContentAccess = hadVpnContentAccess.current && !effectiveContentAccess;
    hadVpnContentAccess.current = effectiveContentAccess;
    if (!lostVpnContentAccess || canUseIcon(BARSAPI.Icon as AppIconName)) {
      return;
    }

    const restoreBaseIcon = () => {
      void BARSAPI.ChangeIcon('cool').catch(() => {
        console.warn('Failed to restore the base app icon after VPN entitlement loss');
      });
    };

    if (Platform.OS === 'android') {
      Alert.alert(
        'Доступ к иконке закончился',
        'Выбранная иконка была доступна через DragoNet. Для возврата базовой иконки приложение будет закрыто.',
        [{text: 'Закрыть и вернуть базовую иконку', onPress: restoreBaseIcon}],
        {cancelable: false},
      );
      return;
    }

    restoreBaseIcon();
  }, [canUseIcon, effectiveContentAccess]);

  const isCatalogItemOwned = React.useCallback((item: LoyaltyCatalogItem): boolean => {
    if (effectiveContentAccess) {
      return true;
    }

    switch (item.kind) {
      case 'theme':
        return state.lightThemeUnlocked;
      case 'icon':
        return item.iconName ? state.unlockedIconIds.includes(item.iconName) : false;
      case 'ads-removal':
        return state.adsRemovalUnlocked;
    }
  }, [effectiveContentAccess, state.adsRemovalUnlocked, state.lightThemeUnlocked, state.unlockedIconIds]);

  const getFeatureStatus = React.useCallback((feature: LoyaltyFeature): LoyaltyFeatureStatus => {
    const dailyLimit = DAILY_FREE_ATTEMPT_LIMITS[feature];
    const usedToday = state.dailyFeatureUses[feature] ?? 0;
    const freeAttemptsRemaining = effectiveContentAccess ? dailyLimit : Math.max(0, dailyLimit - usedToday);
    const requiresToken = !effectiveContentAccess && freeAttemptsRemaining === 0;

    return {
      feature,
      dailyLimit,
      usedToday,
      freeAttemptsRemaining,
      tokenCost: 1,
      canStart: !requiresToken || feature !== 'route' || state.balance > 0,
      allowsZeroBalanceFallback: !effectiveContentAccess && feature !== 'route' && requiresToken && state.balance === 0,
      premiumAccess: effectiveContentAccess,
    };
  }, [effectiveContentAccess, state.balance, state.dailyFeatureUses]);

  const recordSuccessfulFeatureUse = React.useCallback((
    feature: LoyaltyFeature,
    options: {ignore?: boolean} = {},
  ) => loyaltyService.recordSuccessfulFeatureUse(feature, {
    ignore: options.ignore,
    premiumAccess: effectiveContentAccess,
  }), [effectiveContentAccess]);

  const purchase = React.useCallback((itemId: LoyaltyItemId) => {
    const item = getLoyaltyCatalogItem(itemId);
    if (effectiveContentAccess) {
      return {status: 'PREMIUM_ACCESS' as const, item};
    }

    return loyaltyService.purchase(itemId);
  }, [effectiveContentAccess]);

  const contextValue = React.useMemo<LoyaltyContextValue>(() => ({
    state,
    displayedBalance: effectiveContentAccess ? '∞' : state.balance,
    effectiveContentAccess,
    adsRemovalUnlocked: state.adsRemovalUnlocked,
    canUseLightTheme,
    canUseIcon,
    isCatalogItemOwned,
    getCatalogItem: getLoyaltyCatalogItem,
    getIconCatalogItem: getIconLoyaltyCatalogItem,
    getFeatureStatus,
    recordSuccessfulFeatureUse,
    getNextRewardedReward: () => loyaltyService.getNextRewardedReward(),
    grantRewardedReward: () => loyaltyService.grantRewardedReward(),
    purchase,
  }), [
    canUseIcon,
    canUseLightTheme,
    effectiveContentAccess,
    getFeatureStatus,
    isCatalogItemOwned,
    purchase,
    recordSuccessfulFeatureUse,
    state,
  ]);

  return <LoyaltyContext.Provider value={contextValue}>{children}</LoyaltyContext.Provider>;
};

export const useLoyalty = (): LoyaltyContextValue => React.useContext(LoyaltyContext);
