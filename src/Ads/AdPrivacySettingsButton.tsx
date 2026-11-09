import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from 'react-native-paper';
// @ts-expect-error The bundled icon package has no type declarations.
import Icon from 'react-native-vector-icons/MaterialIcons';
import {type CustomTheme, withOpacity} from '../Themes/Themes';
import {useAds} from './AdsProvider';

const AdPrivacySettingsButton: React.FC = () => {
  const {colors} = useTheme<CustomTheme>();
  const {isPersonalizedTargetingEnabled, isAdLocationSharingEnabled, openAdPrivacySettings} = useAds();
  const status = (enabled: boolean) => <Text style={{color: enabled ? colors.accent : colors.error, fontWeight: '600'}}>
    {enabled ? 'включена' : 'выключена'}
  </Text>;
  return <TouchableOpacity accessibilityRole="button" onPress={openAdPrivacySettings}
    accessibilityLabel={`Персонализация рекламы: ${isPersonalizedTargetingEnabled ? 'включена' : 'выключена'}. Передача геолокации в рекламные сети: ${isAdLocationSharingEnabled ? 'включена' : 'выключена'}. Изменить настройки`}
    style={{flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 10, paddingVertical: 12, borderRadius: 5, backgroundColor: colors.primary}}>
    <View style={{width: 52, alignItems: 'center'}}>
      <Icon name="privacy-tip" size={25} color={withOpacity(colors.text, 80)} accessible={false}/>
    </View>
    <View style={{flex: 1, minWidth: 0, gap: 6, paddingHorizontal: 6}}>
      <Text style={{color: colors.text, fontSize: 16}}>Персонализация рекламы: {status(isPersonalizedTargetingEnabled)}</Text>
      <Text style={{color: colors.text, fontSize: 16}}>Передача геолокации в рекламные сети: {status(isAdLocationSharingEnabled)}</Text>
    </View>
    <View style={{width: 56, alignItems: 'center'}}>
      <Icon name="navigate-next" size={40} color={colors.text} accessible={false}/>
    </View>
  </TouchableOpacity>;
};

export default AdPrivacySettingsButton;
