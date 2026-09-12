import React from 'react';
import {Alert, Linking, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import {withOpacity, type CustomTheme} from '../Themes/Themes';

export const BARS_REGISTRATION_URL = 'https://mpei.ru/Pages/registration.aspx';

export const openBarsRegistration = async (
  linking: Pick<typeof Linking, 'canOpenURL' | 'openURL'> = Linking,
  showAlert: (title: string, message: string) => void = Alert.alert,
): Promise<void> => {
  try {
    const canOpen = await linking.canOpenURL(BARS_REGISTRATION_URL);
    if (!canOpen) {
      throw new Error('Registration URL cannot be opened');
    }
    await linking.openURL(BARS_REGISTRATION_URL);
  } catch {
    showAlert('Не удалось открыть страницу', 'Попробуйте открыть её позже через браузер.');
  }
};

export const HelpAccordion: React.FC<{
  title: string;
  expanded: boolean;
  onPress: () => void;
  children: React.ReactNode;
}> = ({title, expanded, onPress, children}) => {
  const {colors} = useTheme<CustomTheme>();
  return (
    <View style={{backgroundColor: colors.surface, borderRadius: 12, marginBottom: 10, overflow: 'hidden'}}>
      <TouchableOpacity
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${expanded ? 'Развёрнутый раздел' : 'Свёрнутый раздел'}`}
        accessibilityState={{expanded}}
        onPress={onPress}
        style={{minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center'}}
      >
        <Text style={{flex: 1, fontSize: 16, fontWeight: 'bold', color: colors.text}}>{title}</Text>
        <Text accessible={false} style={{fontSize: 24, color: colors.textUnderline, marginLeft: 12}}>{expanded ? '−' : '+'}</Text>
      </TouchableOpacity>
      {expanded && <View style={{paddingHorizontal: 16, paddingBottom: 16}}>{children}</View>}
    </View>
  );
};
