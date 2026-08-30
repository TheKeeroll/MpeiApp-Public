import React from 'react';
import {StyleProp, Text, View, ViewStyle} from 'react-native';
import {useTheme} from 'react-native-paper';
import {withOpacity, type CustomTheme} from '../Themes/Themes';
import {useLoyalty} from './LoyaltyProvider';
import type {LoyaltyFeature} from './LoyaltyService';

type DailyUsageBadgeProps = {
  feature: LoyaltyFeature;
  style?: StyleProp<ViewStyle>;
};

const DailyUsageBadge: React.FC<DailyUsageBadgeProps> = ({feature, style}) => {
  const {colors} = useTheme<CustomTheme>();
  const {getFeatureStatus} = useLoyalty();
  const status = getFeatureStatus(feature);

  let firstLine: string;
  let secondLine: string;
  if (status.premiumAccess) {
    firstLine = '∞';
    secondLine = 'без лимита';
  } else if (status.freeAttemptsRemaining > 0) {
    firstLine = `${status.freeAttemptsRemaining}/${status.dailyLimit}`;
    secondLine = 'бесплатно сегодня';
  } else if (status.allowsZeroBalanceFallback) {
    firstLine = '1 токен';
    secondLine = 'при 0 — бесплатно';
  } else {
    firstLine = '1 токен';
    secondLine = 'после лимита';
  }

  return (
    <View style={[
      {
        minWidth: 94,
        paddingHorizontal: 6,
        paddingVertical: 3,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: withOpacity(colors.backdrop, 88),
        borderWidth: 1,
        borderColor: withOpacity(colors.textUnderline, 45),
      },
      style,
    ]}>
      <Text style={{fontWeight: 'bold', fontSize: 12, color: colors.text}}>{firstLine}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{fontSize: 10, color: withOpacity(colors.text, 80)}}>{secondLine}</Text>
    </View>
  );
};

export default DailyUsageBadge;
