import React from 'react';
import {
  AccessibilityInfo, Animated, AppState, Linking, Modal, ScrollView,
  StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import {useTheme} from 'react-native-paper';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
// @ts-expect-error The bundled icon package has no type declarations.
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {type CustomTheme, withOpacity} from '../Themes/Themes';
import {requestForegroundLocationPermission} from '../Common/LocationPermission';
import {type AdPrivacyPreferences, PRIVACY_POLICY_URL} from './AdPrivacyPreferences';

type Props = {
  preferences: AdPrivacyPreferences;
  onSave: (preferences: AdPrivacyPreferences) => void;
  onCancel?: () => void;
};

const ConsentButton: React.FC<{disabled: boolean; onPress: () => void}> = ({disabled, onPress}) => {
  const {colors} = useTheme<CustomTheme>();
  const shine = React.useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = React.useState(true);
  const [active, setActive] = React.useState(AppState.currentState === 'active');
  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const appState = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => { mounted = false; motion.remove(); appState.remove(); };
  }, []);
  React.useEffect(() => {
    shine.setValue(0);
    if (disabled || reduceMotion || !active) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(shine, {toValue: 1, duration: 1800, useNativeDriver: true, isInteraction: false}),
      Animated.delay(1600),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, disabled, reduceMotion, shine]);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Согласиться"
    accessibilityState={{disabled}} disabled={disabled} onPress={onPress} activeOpacity={0.8}
    style={[styles.accept, {
      backgroundColor: disabled ? colors.surface : colors.accent,
      borderColor: disabled ? withOpacity(colors.text, 20) : colors.accent,
      shadowColor: colors.accent, shadowOpacity: disabled ? 0 : 0.25,
    }]}>
    {!disabled && !reduceMotion && <Animated.View pointerEvents="none" style={[styles.shine, {
      transform: [{translateX: shine.interpolate({inputRange: [0, 1], outputRange: [-100, 380]})}, {rotate: '22deg'}],
      opacity: shine.interpolate({inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.45, 0.45, 0]}),
    }]}/>}
    <Icon name="check-circle-outline" size={21} color={disabled ? withOpacity(colors.text, 45) : '#102014'} accessible={false}/>
    <Text style={{color: disabled ? withOpacity(colors.text, 45) : '#102014', fontSize: 17, fontWeight: '700', flexShrink: 1, textAlign: 'center'}}>Согласиться</Text>
  </TouchableOpacity>;
};

/** Mounted per opening, so unsaved choices never leak into SDK consent. */
const AdPrivacyModal: React.FC<Props> = ({preferences, onSave, onCancel}) => {
  const {colors} = useTheme<CustomTheme>();
  const [adultConfirmed, setAdultConfirmed] = React.useState(preferences.adultConfirmed);
  const [locationSharing, setLocationSharing] = React.useState(preferences.locationSharing);
  const [permissionNotice, setPermissionNotice] = React.useState('');
  const [linkError, setLinkError] = React.useState(false);
  const mounted = React.useRef(true);
  const locationRequest = React.useRef(0);
  React.useEffect(() => () => { mounted.current = false; ++locationRequest.current; }, []);

  const toggleAdult = () => {
    setAdultConfirmed(value => !value);
    setLocationSharing(false);
    setPermissionNotice('');
    ++locationRequest.current;
  };
  const toggleLocation = async (enabled: boolean) => {
    if (!adultConfirmed) return;
    const request = ++locationRequest.current;
    setLocationSharing(enabled);
    setPermissionNotice('');
    if (!enabled) return;
    try {
      const granted = await requestForegroundLocationPermission();
      if (!mounted.current || request !== locationRequest.current) return;
      setPermissionNotice(granted
        ? 'Доступ к местоположению разрешён. Выбор будет применён после нажатия «Согласиться».'
        : 'Сейчас доступ к местоположению не разрешён. Согласие сохранится: передача станет возможна, если вы позже разрешите доступ в настройках устройства или на карте.');
    } catch {
      if (mounted.current && request === locationRequest.current) {
        setPermissionNotice('Не удалось запросить доступ к местоположению. Его можно разрешить позже в настройках устройства.');
      }
    }
  };
  const save = (personalizedAds: boolean) => onSave({
    ...preferences, adultConfirmed, personalizedAds,
    locationSharing: personalizedAds && adultConfirmed && locationSharing,
  });
  const paragraphStyle = {color: withOpacity(colors.text, 88), fontSize: 15, lineHeight: 22};
  const headingStyle = {color: colors.text, fontSize: 17, fontWeight: '700' as const, marginTop: 20, marginBottom: 7};

  return <Modal visible transparent animationType="slide" statusBarTranslucent navigationBarTranslucent
    onRequestClose={onCancel ?? (() => save(false))} supportedOrientations={['portrait', 'landscape']}>
    <SafeAreaProvider>
      <SafeAreaView style={styles.overlay}>
        <View accessibilityViewIsModal style={[styles.sheet, {backgroundColor: colors.background, borderColor: withOpacity(colors.text, 15)}]}>
          <View style={[styles.header, {borderBottomColor: withOpacity(colors.text, 12)}]}>
            <View style={[styles.headerIcon, {backgroundColor: withOpacity(colors.textUnderline, 15)}]}>
              <Icon name="shield-account-outline" size={26} color={colors.textUnderline} accessible={false}/>
            </View>
            <View style={{flex: 1}}>
              <Text style={{color: colors.textUnderline, fontSize: 12, fontWeight: '700'}}>БЕСПЛАТНОЕ ПРИЛОЖЕНИЕ · ВАШ ВЫБОР</Text>
              <Text accessibilityRole="header" style={{color: colors.text, fontSize: 23, fontWeight: '700', marginTop: 4}}>Реклама и персонализация</Text>
            </View>
            {onCancel && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Закрыть без изменений"
              onPress={onCancel} style={styles.close}>
              <Icon name="close" size={25} color={colors.text}/>
            </TouchableOpacity>}
          </View>
          <ScrollView style={{flex: 1}} contentContainerStyle={styles.content}>
            <Text style={headingStyle}>Простой способ поддержать разработчика</Text>
            <Text style={paragraphStyle}>MpeiApp — независимое бесплатное приложение, которое финансируется рекламой (ad-funded). Реклама помогает оплачивать инфраструктуру, публикацию в магазинах и дальнейшую разработку. Согласие на персонализацию — простой и эффективный способ поддержать разработчика: более подходящие объявления помогают приложению зарабатывать на рекламе.</Text>
            <Text style={headingStyle}>Решение всегда за вами</Text>
            <Text style={paragraphStyle}>Мы строго соблюдаем действующие правила персонализации и уважаем ваш выбор. Согласие добровольно: при отказе приложение останется доступным, а реклама будет запрашиваться без персонализации. Изменить или отозвать согласие можно в любой момент: «Прочее» → «Настройки» → «Персонализация рекламы». Разрешения и ограничения операционной системы сохраняют силу.</Text>
            <Text style={headingStyle}>Какие данные получают рекламные интеграции</Text>
            <Text style={paragraphStyle}>Реклама загружается через Yandex Mobile Ads и подключённые сети медиации: BIGO Ads, VK Реклама и Chartboost. Для загрузки, показа, статистики и защиты от мошенничества SDK обрабатывают технические сведения об устройстве, ОС и приложении, IP-адрес, события показов и нажатий. Рекламные идентификаторы доступны только в пределах системных разрешений и правил сетей.</Text>
            <Text style={[paragraphStyle, {marginTop: 10}]}>При согласии MpeiApp дополнительно передаёт приблизительный возраст, рассчитанный по году поступления из группы (если его определить нельзя — 19 лет), и предполагаемый пол, определённый по имени. Само имя, номер группы, логин, пароль, оценки и другие учебные данные в рекламные запросы не включаются.</Text>
            <Text style={[paragraphStyle, {marginTop: 10}]}>Координаты устройства могут передаваться только при отдельном согласии ниже и разрешении системы на местоположение, в том числе координаты, полученные при использовании карты в текущем сеансе. Без отдельного согласия MpeiApp не добавляет геолокацию в рекламные запросы и отключает её использование в Yandex Mobile Ads. Регион всё ещё может определяться рекламными сервисами по IP-адресу.</Text>
            <TouchableOpacity accessibilityRole="link" onPress={() => {
              setLinkError(false);
              void Linking.openURL(PRIVACY_POLICY_URL).catch(() => setLinkError(true));
            }} style={[styles.policy, {backgroundColor: colors.primary, borderColor: withOpacity(colors.textUnderline, 35)}]}>
              <Icon name="shield-lock-outline" size={23} color={colors.textUnderline} accessible={false}/>
              <Text style={{flex: 1, color: colors.textUnderline, fontSize: 16}}>Политика конфиденциальности</Text>
              <Icon name="open-in-new" size={20} color={colors.textUnderline} accessible={false}/>
            </TouchableOpacity>
            {linkError && <Text accessibilityRole="alert" style={{color: colors.error, marginTop: 6}}>Не удалось открыть ссылку. Попробуйте ещё раз.</Text>}
            <View style={[styles.choices, {backgroundColor: colors.primary, borderColor: withOpacity(colors.text, 15)}]}>
              <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel="Я совершеннолетний(-яя)"
                accessibilityState={{checked: adultConfirmed}} onPress={toggleAdult} style={styles.adult}>
                <Icon name={adultConfirmed ? 'checkbox-marked' : 'checkbox-blank-outline'} size={28}
                  color={adultConfirmed ? colors.accent : colors.text} accessible={false}/>
                <Text style={{flex: 1, color: colors.text, fontSize: 17, fontWeight: '600'}}>Я совершеннолетний(-яя)</Text>
              </TouchableOpacity>
              <View style={[styles.location, {borderTopColor: withOpacity(colors.text, 15)}]}>
                <Text style={{flex: 1, color: withOpacity(colors.text, adultConfirmed ? 90 : 45), fontSize: 14, lineHeight: 20}}>
                  Также соглашаюсь на передачу в рекламные сети моей геолокации (если сейчас или позже будет выдано разрешение на доступ к местоположению)
                </Text>
                <Switch accessibilityLabel="Передача геолокации в рекламные сети" disabled={!adultConfirmed}
                  value={locationSharing} onValueChange={toggleLocation} trackColor={{true: colors.textUnderline}}/>
              </View>
              {!!permissionNotice && <Text accessibilityLiveRegion="polite" style={[paragraphStyle, {fontSize: 13, lineHeight: 19, marginTop: 10}]}>{permissionNotice}</Text>}
            </View>
            <Text style={[paragraphStyle, {fontSize: 13, lineHeight: 19, marginTop: 12}]}>Нажимая «Согласиться», вы разрешаете обработку данных для персонализации рекламы, а при включённом переключателе — также использование геолокации в рекламе. «Отказаться» выключает оба согласия.</Text>
          </ScrollView>
          <View style={[styles.footer, {borderTopColor: withOpacity(colors.text, 12)}]}>
            <TouchableOpacity accessibilityRole="button" onPress={() => save(false)}
              style={[styles.decline, {borderColor: withOpacity(colors.text, 35)}]}>
              <Text style={{color: colors.text, fontSize: 16, fontWeight: '600'}}>Отказаться</Text>
            </TouchableOpacity>
            <ConsentButton disabled={!adultConfirmed} onPress={() => { if (adultConfirmed) save(true); }}/>
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
  headerIcon: {width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center'},
  close: {minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center'},
  content: {paddingHorizontal: 20, paddingBottom: 20},
  policy: {flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, borderWidth: 1, marginTop: 18, minHeight: 52},
  choices: {borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 22},
  adult: {flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingBottom: 8},
  location: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, borderTopWidth: 1},
  footer: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1},
  decline: {flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 8},
  accept: {flex: 1.4, minHeight: 60, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center',
    borderRadius: 18, borderWidth: 1, padding: 10, overflow: 'hidden', shadowOffset: {width: 0, height: 3}, shadowRadius: 10},
  shine: {position: 'absolute', left: 0, top: -30, bottom: -30, width: 40, backgroundColor: '#FFFFFF'},
});

export default AdPrivacyModal;
