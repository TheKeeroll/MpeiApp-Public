import React from 'react';
import {Alert, Image, type ImageSourcePropType, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from 'react-native-paper';
// @ts-expect-error
import * as MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {NavigationHeader} from '../CommonComponents/DrawerHeader';
import {useAds} from '../../Ads/AdsProvider';
import {rewardedAdService, type RewardedAdState} from '../../Ads/RewardedAdService';
import {YANDEX_REWARDED_AD_PLACEMENT} from '../../Ads/AdPlacements';
import {getLoyaltyCatalogItem, LOYALTY_CATALOG, type LoyaltyCatalogItem} from '../../Loyalty/LoyaltyCatalog';
import {showInsufficientTokensAlert} from '../../Loyalty/LoyaltyAlerts';
import {useLoyalty} from '../../Loyalty/LoyaltyProvider';
import {withOpacity, type CustomTheme} from '../../Themes/Themes';
import type {AppIconName, QRFrameName} from '../../API/BARS';

const iconPreviewSources: Record<Exclude<AppIconName, 'cool'>, ImageSourcePropType> = {
  dragons: require('../../../assets/images/dragons.webp'),
  simple: require('../../../assets/images/simple.webp'),
  matterial: require('../../../assets/images/matterial.webp'),
  gold: require('../../../assets/images/gold.webp'),
  crymat: require('../../../assets/images/crymat.webp'),
  crysign: require('../../../assets/images/crysign.webp'),
};

const qrFramePreviewSources: Record<Exclude<QRFrameName, 'qr-frame'>, ImageSourcePropType> = {
  empty: require('../../../assets/images/QRScan/qr-no_frame_text.webp'),
  'qr-frame-black': require('../../../assets/images/QRScan/qr-frame-black.webp'),
  'qr-frame-green': require('../../../assets/images/QRScan/qr-frame-green.webp'),
  'qr-frame-red': require('../../../assets/images/QRScan/qr-frame-red.webp'),
};

const CatalogPreview: React.FC<{item: LoyaltyCatalogItem, owned: boolean}> = ({item, owned}) => {
  const {colors} = useTheme<CustomTheme>();

  if (item.kind === 'icon' && item.iconName) {
    return <Image source={iconPreviewSources[item.iconName]} style={{height: 46, width: 46, borderRadius: 10, opacity: owned ? .75 : 1}}/>;
  }

  if (item.kind === 'qr-frame' && item.frameName) {
    return <Image source={qrFramePreviewSources[item.frameName]} resizeMode="contain" style={{height: 50, width: 50, opacity: owned ? .75 : 1}}/>;
  }

  return <MaterialIcons.default name="light-mode" size={29} color={owned ? colors.accent : colors.textUnderline}/>;
};

const customizationCatalog = LOYALTY_CATALOG.filter(item => item.kind !== 'ads-removal');
const adsRemovalItem = getLoyaltyCatalogItem('ads-removal');

const LoyaltyScreen: React.FC<{navigation: any, route: any}> = props => {
  const {colors} = useTheme<CustomTheme>();
  const {adsEnabled, createAdRequest} = useAds();
  const {
    adsRemovalUnlocked,
    displayedBalance,
    effectiveContentAccess,
    grantRewardedReward,
    isCatalogItemOwned,
    purchase,
    state,
  } = useLoyalty();
  const [rewardedAdState, setRewardedAdState] = React.useState<RewardedAdState>(rewardedAdService.state);
  const rewardedAdRequest = React.useMemo(
    () => createAdRequest(YANDEX_REWARDED_AD_PLACEMENT),
    [createAdRequest],
  );
  const rewardedLeft = Math.max(0, 5 - state.rewardedViewsToday);
  const adsRemovalOwned = isCatalogItemOwned(adsRemovalItem);
  const adsRemovalStatusText = adsRemovalOwned
    ? effectiveContentAccess ? 'Временно отключено с DragoNet' : 'Отключено навсегда'
    : `${adsRemovalItem.price} токенов`;
  const nextRewardText = state.rewardedViewsToday === 0
    ? '10 токенов'
    : state.rewardedViewsToday === 1
      ? '6 токенов'
      : state.rewardedViewsToday < 5
        ? '2–5 токенов'
        : undefined;

  React.useEffect(() => rewardedAdService.subscribe(setRewardedAdState), []);

  React.useEffect(() => {
    if (!adsEnabled || !rewardedAdRequest || rewardedLeft === 0) {
      return;
    }

    void rewardedAdService.preload(rewardedAdRequest);
  }, [adsEnabled, rewardedAdRequest, rewardedAdState, rewardedLeft]);

  const showRewardedAd = async () => {
    if (!rewardedAdRequest || rewardedLeft === 0 || !adsEnabled) {
      return;
    }

    if (rewardedAdState !== 'LOADED') {
      await rewardedAdService.preload(rewardedAdRequest);
      return;
    }

    await rewardedAdService.show(() => {
      grantRewardedReward();
    });
  };

  const purchaseItem = (item: LoyaltyCatalogItem) => {
    if (isCatalogItemOwned(item)) {
      return;
    }
    if (state.balance < item.price) {
      showInsufficientTokensAlert(item.title, item.price);
      return;
    }

    Alert.alert(
      'Подтвердите покупку',
      `Открыть «${item.title}» за ${item.price} токенов?`,
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Купить',
          onPress: () => {
            const result = purchase(item.id);
            if (result.status === 'INSUFFICIENT_BALANCE') {
              showInsufficientTokensAlert(item.title, item.price);
              return;
            }
            if (result.status === 'PURCHASED') {
              Alert.alert('Готово', `«${item.title}» разблокирован.`);
            }
          },
        },
      ],
    );
  };

  const rewardedButtonTitle = !adsEnabled
    ? 'Реклама недоступна'
    : rewardedLeft === 0
      ? 'Лимит рекламы на сегодня исчерпан'
      : rewardedAdState === 'LOADED'
        ? 'Посмотреть рекламу'
        : 'Загружаем рекламу…';

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <NavigationHeader backable {...props} title="Лояльность"/>
      <ScrollView contentContainerStyle={{width: '90%', alignSelf: 'center', paddingBottom: 28}}>
        <View style={{marginTop: 18, padding: 16, borderRadius: 12, backgroundColor: colors.primary}}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
            <MaterialIcons.default name="loyalty" size={28} color={colors.textUnderline}/>
            <Text style={{marginLeft: 8, fontSize: 26, fontWeight: 'bold', color: colors.text}}>{displayedBalance}</Text>
          </View>
          <Text style={{marginTop: 5, textAlign: 'center', color: withOpacity(colors.text, 75)}}>токенов лояльности</Text>
          {effectiveContentAccess && (
            <Text style={{marginTop: 7, textAlign: 'center', color: colors.textUnderline}}>DragoNet временно открывает все преимущества</Text>
          )}
        </View>

        {adsEnabled ? (
          <View style={{marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: colors.surface}}>
            <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.text}}>Награда за рекламу</Text>
            <Text style={{marginTop: 4, color: withOpacity(colors.text, 80)}}>
              Просмотров сегодня: {state.rewardedViewsToday}/5 · осталось {rewardedLeft}{nextRewardText ? ` · следующая награда ${nextRewardText}` : ''}
            </Text>
            <TouchableOpacity
              disabled={rewardedLeft === 0 || rewardedAdState !== 'LOADED'}
              onPress={() => void showRewardedAd()}
              style={{
                marginTop: 12,
                minHeight: 48,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primary,
                opacity: rewardedLeft === 0 || rewardedAdState !== 'LOADED' ? 0.5 : 1,
              }}
            >
              <Text style={{fontWeight: 'bold', color: colors.textUnderline}}>{rewardedButtonTitle}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: colors.surface}}>
            <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.text}}>Реклама отключена</Text>
            <Text style={{marginTop: 4, color: withOpacity(colors.text, 80)}}>
              {effectiveContentAccess
                ? 'DragoNet временно отключает рекламу и доступ к rewarded-наградам.'
                : adsRemovalUnlocked
                  ? 'Постоянное отключение рекламы куплено для этого устройства.'
                  : 'Реклама временно недоступна.'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          disabled={adsRemovalOwned}
          onPress={() => purchaseItem(adsRemovalItem)}
          style={{
            marginTop: 24,
            padding: 16,
            minHeight: 106,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary,
            borderWidth: 1,
            borderColor: adsRemovalOwned ? withOpacity(colors.accent, 55) : withOpacity(colors.textUnderline, 55),
            opacity: adsRemovalOwned ? .78 : 1,
          }}
        >
          <View style={{height: 54, width: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: withOpacity(colors.backdrop, 45)}}>
            <MaterialIcons.default name="block" size={31} color={adsRemovalOwned ? colors.accent : colors.textUnderline}/>
          </View>
          <View style={{marginLeft: 13, flex: 1}}>
            <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.text}}>Без рекламы навсегда</Text>
            <Text style={{marginTop: 3, color: withOpacity(colors.text, 78)}}>Убирает баннеры и rewarded-рекламу на этом устройстве.</Text>
            <Text style={{marginTop: 6, fontWeight: 'bold', color: adsRemovalOwned ? colors.accent : colors.textUnderline}}>{adsRemovalStatusText}</Text>
          </View>
          {!adsRemovalOwned && <MaterialIcons.default name="lock" size={22} color={withOpacity(colors.text, 70)}/>}
        </TouchableOpacity>

        <Text style={{marginTop: 24, marginBottom: 4, color: colors.text, fontSize: 18, fontWeight: 'bold'}}>Предметы кастомизации</Text>
        {customizationCatalog.map(item => {
          const owned = isCatalogItemOwned(item);
          const statusText = owned
            ? effectiveContentAccess ? 'Доступно с DragoNet' : 'Куплено'
            : `${item.price} токенов`;

          return (
            <TouchableOpacity
              key={item.id}
              disabled={owned}
              onPress={() => purchaseItem(item)}
              style={{
                marginTop: 10,
                padding: 13,
                minHeight: 62,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.primary,
                opacity: owned ? 0.7 : 1,
              }}
            >
              <CatalogPreview item={item} owned={owned}/>
              <View style={{marginLeft: 12, flex: 1}}>
                <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.text}}>{item.title}</Text>
                <Text style={{marginTop: 2, color: owned ? colors.accent : colors.textUnderline}}>{statusText}</Text>
              </View>
              {!owned && <MaterialIcons.default name="lock" size={22} color={withOpacity(colors.text, 70)}/>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default LoyaltyScreen;
