import React from 'react';
import {Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
// @ts-expect-error The bundled icon package has no type declarations.
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {type CustomTheme, withOpacity} from '../Themes/Themes';
import AnimatedActionButton from '../Screens/CommonComponents/AnimatedActionButton';
import type {AppUpdate} from './AppUpdateService';

export const APP_UPDATE_WARNING = 'Зачастую MpeiApp обновляется для исправления значительных проблем/адаптации к изменениям систем МЭИ. Прежние версии могут больше не обеспечивать доступ в БАРС/должное удобство и безопасность - своевременный переход на актуальную версию крайне рекомендован и нередко необходим!';

const AppUpdateModal: React.FC<{update: AppUpdate; onLater: () => void}> = ({update, onLater}) => {
  const {colors} = useTheme<CustomTheme>();
  const [openingStore, setOpeningStore] = React.useState(false);
  const [linkError, setLinkError] = React.useState(false);
  const mounted = React.useRef(false);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const openStore = async () => {
    if (openingStore) return;
    setOpeningStore(true);
    setLinkError(false);
    try {
      await Linking.openURL(update.storeUrl);
      if (mounted.current) onLater();
    } catch {
      if (mounted.current) setLinkError(true);
    } finally {
      if (mounted.current) setOpeningStore(false);
    }
  };
  return <Modal visible transparent animationType="slide" statusBarTranslucent navigationBarTranslucent
    onRequestClose={onLater} supportedOrientations={['portrait', 'landscape']}>
    <SafeAreaProvider>
      <SafeAreaView style={styles.overlay}>
        <View accessibilityViewIsModal style={[styles.sheet, {backgroundColor: colors.background, borderColor: withOpacity(colors.text, 15)}]}>
          <View style={[styles.header, {borderBottomColor: withOpacity(colors.text, 12)}]}>
            <View style={[styles.icon, {backgroundColor: withOpacity(colors.textUnderline, 15)}]}>
              <Icon name="cellphone-arrow-down" size={26} color={colors.textUnderline} accessible={false}/>
            </View>
            <View style={{flex: 1}}>
              <Text style={{color: colors.textUnderline, fontSize: 12, fontWeight: '700'}}>MPEIAPP · {update.storeName.toUpperCase()}</Text>
              <Text accessibilityRole="header" style={{color: colors.text, fontSize: 23, fontWeight: '700', marginTop: 4}}>Доступна новая версия</Text>
            </View>
          </View>
          <ScrollView style={{flex: 1}} contentContainerStyle={styles.content}>
            <Text accessibilityLabel={`Версия ${update.version}`} style={{color: colors.accent, fontSize: 42, fontWeight: '800', marginTop: 24}}>{update.version}</Text>
            <Text accessibilityRole="header" style={{color: colors.text, fontSize: 19, fontWeight: '700', marginTop: 24, marginBottom: 12}}>Что нового</Text>
            <Text selectable style={{color: withOpacity(colors.text, 90), fontSize: 16, lineHeight: 24}}>
              {update.releaseNotes || 'В магазине пока не указан список изменений.'}
            </Text>
            <View style={[styles.warning, {backgroundColor: withOpacity(colors.warning, 10), borderColor: withOpacity(colors.warning, 45)}]}>
              <Icon name="alert-outline" size={24} color={colors.warning} accessible={false}/>
              <Text style={{color: colors.warning, fontSize: 15, lineHeight: 22, flex: 1}}>{APP_UPDATE_WARNING}</Text>
            </View>
            {linkError && <Text accessibilityRole="alert" style={{color: colors.error, marginTop: 12, fontSize: 15}}>
              Не удалось открыть {update.storeName}. Попробуйте ещё раз или обновите приложение позже.
            </Text>}
          </ScrollView>
          <View style={[styles.footer, {borderTopColor: withOpacity(colors.text, 12)}]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Позже" onPress={onLater}
              style={[styles.later, {borderColor: withOpacity(colors.text, 35)}]}>
              <Text style={{color: colors.text, fontSize: 16, fontWeight: '600'}}>Позже</Text>
            </TouchableOpacity>
            <AnimatedActionButton title={`Обновить через ${update.storeName}`} icon="download-outline"
              disabled={openingStore} onPress={openStore}/>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
};

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: '#00000099', alignItems: 'center', justifyContent: 'center', padding: 8},
  sheet: {height: '96%', width: '100%', maxWidth: 680, borderRadius: 24, borderWidth: 1, overflow: 'hidden'},
  header: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderBottomWidth: 1},
  icon: {width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center'},
  content: {paddingHorizontal: 20, paddingBottom: 24},
  warning: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, padding: 14, borderWidth: 1, marginTop: 24},
  footer: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1},
  later: {flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 8},
});

export default AppUpdateModal;
