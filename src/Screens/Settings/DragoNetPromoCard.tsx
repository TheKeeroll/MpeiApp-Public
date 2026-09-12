import Clipboard from '@react-native-clipboard/clipboard';
import React from 'react';
import {useTheme} from 'react-native-paper';
import {
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Linking,
  Modal,
  NativeModules,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// @ts-expect-error
import * as MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// @ts-expect-error
import * as FontAwesome from 'react-native-vector-icons/FontAwesome';
import {withOpacity, type CustomTheme} from '../../Themes/Themes';
import type {VpnDemoAccess, VpnVerificationResult, VpnVerificationState} from '../../Vpn';
import {dragonetTelegramUrl, vpnSubscriptionService} from '../../Vpn/VpnSubscriptionRuntime';

const INCY_APP_STORE_URL = 'https://apps.apple.com/ru/app/incy/id6756943388';
const OWENCLAVE_APK_URLS = {
  'arm64-v8a': 'https://github.com/owenewans/owenclave/releases/download/v0.17.58/Owenclave-0.17.58-arm64-v8a.apk',
  'armeabi-v7a': 'https://github.com/owenewans/owenclave/releases/download/v0.17.58/Owenclave-0.17.58-armeabi-v7a.apk',
  x86: 'https://github.com/owenewans/owenclave/releases/download/v0.17.58/Owenclave-0.17.58-x86.apk',
  x86_64: 'https://github.com/owenewans/owenclave/releases/download/v0.17.58/Owenclave-0.17.58-x86_64.apk',
} as const;
const DEMO_CONFIGURATION_NOTE = 'Часть конфигураций у вас может не работать - это нормально: они рассчитаны на другие приложения/платформы';

type OwenclaveArchitecture = keyof typeof OWENCLAVE_APK_URLS;

const isOwenclaveArchitecture = (value: string): value is OwenclaveArchitecture => (
  Object.prototype.hasOwnProperty.call(OWENCLAVE_APK_URLS, value)
);

export const getOwenclaveApkUrlForAbis = (platform: string, nativeAbis: unknown): string => {
  if (platform !== 'android' || !Array.isArray(nativeAbis)) {
    return OWENCLAVE_APK_URLS['arm64-v8a'];
  }
  const abi = nativeAbis
    .filter((value): value is string => typeof value === 'string')
    .find(isOwenclaveArchitecture);
  return abi ? OWENCLAVE_APK_URLS[abi] : OWENCLAVE_APK_URLS['arm64-v8a'];
};

export const getOwenclaveApkUrl = async (): Promise<string> => {
  if (Platform.OS !== 'android') {
    return OWENCLAVE_APK_URLS['arm64-v8a'];
  }
  const deviceArchitecture = NativeModules.DeviceArchitecture as {
    getSupportedAbis?: () => Promise<unknown>;
  } | undefined;
  try {
    return getOwenclaveApkUrlForAbis('android', await deviceArchitecture?.getSupportedAbis?.());
  } catch {
    return OWENCLAVE_APK_URLS['arm64-v8a'];
  }
};

const openExternalUrl = async (url: string, title: string): Promise<void> => {
  try {
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    // Android 11+ can hide browser handlers from canOpenURL despite openURL working.
    if (!canOpen && Platform.OS !== 'android') {
      Alert.alert(title, 'На устройстве не удалось открыть эту ссылку. Попробуйте ещё раз после проверки подключения к интернету.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert(title, 'Не удалось открыть ссылку. Проверьте подключение к интернету и попробуйте ещё раз.');
  }
};

const openOwenclaveApk = async (): Promise<void> => {
  await openExternalUrl(await getOwenclaveApkUrl(), 'Не удалось открыть страницу загрузки');
};

const ActionButton: React.FC<{
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: string;
  leadingIcon?: React.ReactNode;
  subtle?: boolean;
}> = ({title, onPress, disabled = false, icon, leadingIcon, subtle = false}) => {
  const {colors} = useTheme<CustomTheme>();
  const hasIcon = !!icon || !!leadingIcon;
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 42,
        marginTop: 9,
        paddingHorizontal: 12,
        borderRadius: 7,
        backgroundColor: subtle ? withOpacity(colors.background, 68) : colors.highlight,
        opacity: disabled ? .45 : 1,
      }}
    >
      {leadingIcon}
      {icon && <MaterialIcons.default name={icon} size={20} color={subtle ? colors.text : colors.accent}/>}
      <Text style={{marginLeft: hasIcon ? 7 : 0, color: subtle ? colors.text : colors.accent, fontWeight: 'bold', fontSize: 15}}>{title}</Text>
    </TouchableOpacity>
  );
};

const PROMO_ICON_ROW_HEIGHT = 66;
const PROMO_ICON_CELL_WIDTH = 66;
const PROMO_APP_ICONS = [
  {name: 'YouTube', source: require('../../../assets/images/DragoNet/AppIconsForPromo/youtube.webp'), size: 66},
  {name: 'Instagram', source: require('../../../assets/images/DragoNet/AppIconsForPromo/instagram.webp'), size: 66},
  {name: 'TikTok', source: require('../../../assets/images/DragoNet/AppIconsForPromo/tiktok.webp'), size: 60},
  {name: 'Telegram', source: require('../../../assets/images/DragoNet/AppIconsForPromo/telegram.webp'), size: 40},
  {name: 'Spotify', source: require('../../../assets/images/DragoNet/AppIconsForPromo/spotify.webp'), size: 53},
  {name: 'Netflix', source: require('../../../assets/images/DragoNet/AppIconsForPromo/netflix.webp'), size: 46},
  {name: 'Discord', source: require('../../../assets/images/DragoNet/AppIconsForPromo/discord.webp'), size: 53},
  {name: 'Twitch', source: require('../../../assets/images/DragoNet/AppIconsForPromo/twitch.webp'), size: 40},
  {name: 'Microsoft Copilot', source: require('../../../assets/images/DragoNet/AppIconsForPromo/copilot.webp'), size: 42},
  {name: 'Google Gemini', source: require('../../../assets/images/DragoNet/AppIconsForPromo/gemini.webp'), size: 40},
  {name: 'Xbox', source: require('../../../assets/images/DragoNet/AppIconsForPromo/xbox.webp'), size: 40},
  {name: 'Nintendo', source: require('../../../assets/images/DragoNet/AppIconsForPromo/nintendo.webp'), size: 46},
  {name: 'NTE', source: require('../../../assets/images/DragoNet/AppIconsForPromo/nte.webp'), size: 66},
  {name: 'AniTokyoTV', source: require('../../../assets/images/DragoNet/AppIconsForPromo/anitokyotv.webp'), size: 62},
] as const;
const PROMO_ICON_LOOP_WIDTH = PROMO_APP_ICONS.length * PROMO_ICON_CELL_WIDTH;

const PromoAppIconsMarquee: React.FC = () => {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const icons = [...PROMO_APP_ICONS, ...PROMO_APP_ICONS, ...PROMO_APP_ICONS];

  React.useEffect(() => {
    translateX.setValue(0);
    const animation = Animated.loop(Animated.timing(translateX, {
      toValue: -PROMO_ICON_LOOP_WIDTH,
      duration: 48000,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [translateX]);

  return (
    <View accessible={false} style={{height: PROMO_ICON_ROW_HEIGHT, marginTop: 8, overflow: 'hidden'}}>
      <Animated.View style={{flexDirection: 'row', width: PROMO_ICON_LOOP_WIDTH * 3, transform: [{translateX}]}}>
        {icons.map((app, index) => (
          <View key={`${app.name}-${index}`} style={{width: PROMO_ICON_CELL_WIDTH, height: PROMO_ICON_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center'}}>
            <Image source={app.source} accessibilityLabel={app.name} style={{width: app.size, height: app.size, resizeMode: 'contain'}}/>
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const AccordionHeader: React.FC<{
  title: string;
  expanded: boolean;
  onPress: () => void;
  icon: string;
}> = ({title, expanded, onPress, icon}) => {
  const {colors} = useTheme<CustomTheme>();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{expanded}}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 47,
        marginTop: 12,
        paddingHorizontal: 12,
        borderRadius: 7,
        backgroundColor: withOpacity(colors.background, 68),
      }}
    >
      <MaterialIcons.default name={icon} size={22} color={colors.textUnderline}/>
      <Text style={{flex: 1, marginLeft: 9, color: colors.text, fontSize: 16, fontWeight: 'bold'}}>{title}</Text>
      <MaterialIcons.default name={expanded ? 'expand-less' : 'expand-more'} size={28} color={colors.text}/>
    </TouchableOpacity>
  );
};

const InstructionStep: React.FC<{number: number; children: React.ReactNode}> = ({number, children}) => {
  const {colors} = useTheme<CustomTheme>();
  return (
    <View style={{flexDirection: 'row', marginTop: 9}}>
      <Text style={{width: 24, color: colors.textUnderline, fontSize: 15, fontWeight: 'bold'}}>{number}.</Text>
      <Text style={{flex: 1, color: withOpacity(colors.text, 92), fontSize: 15, lineHeight: 21}}>{children}</Text>
    </View>
  );
};

export const ConnectionInstructions: React.FC<{expanded: boolean; onToggle: () => void}> = ({expanded, onToggle}) => {
  const {colors} = useTheme<CustomTheme>();
  const isIos = Platform.OS === 'ios';
  return (
    <>
      <AccordionHeader title="Инструкция по подключению" icon="menu-book" expanded={expanded} onPress={onToggle}/>
      {expanded && (
        <View style={{marginTop: 8, padding: 13, borderRadius: 7, backgroundColor: withOpacity(colors.background, 48)}}>
          {isIos ? (
            <>
              <ActionButton
                title="Открыть в App Store"
                icon="open-in-new"
                onPress={() => void openExternalUrl(INCY_APP_STORE_URL, 'Не удалось открыть App Store')}
              />
              <InstructionStep number={2}>Запустите INCY, скопируйте и вставьте полученную ссылку подписки DragoNet.</InstructionStep>
              <InstructionStep number={3}>Протестируйте появившиеся конфигурации и дождитесь результатов.</InstructionStep>
              <InstructionStep number={4}>Выберите одну из рабочих конфигураций и подключитесь к ней — готово!</InstructionStep>
              <InstructionStep number={5}>Если у вас уже установлен Happ и в нём привычнее, попробуйте настроить подписку аналогично: она совместима с большинством iOS-клиентов.</InstructionStep>
            </>
          ) : (
            <>
              <ActionButton
                title="Загрузить APK"
                icon="download"
                onPress={() => void openOwenclaveApk()}
              />
              <InstructionStep number={2}>Установите приложение, при необходимости разрешив установку из этого источника, и запустите его.</InstructionStep>
              <InstructionStep number={3}>Откройте раздел Groups в нижней панели: он находится справа от исходного раздела.</InstructionStep>
              <InstructionStep number={4}>Находясь именно в Groups, нажмите плюс в правом верхнем углу.</InstructionStep>
              <InstructionStep number={5}>Предварительно скопируйте ссылку подписки DragoNet. В меню выберите Add subscription from URL — ссылка вставится автоматически; нажмите Add & Download. После закрытия окна выберите появившуюся группу, если она не выбралась автоматически.</InstructionStep>
              <InstructionStep number={6}>Вернитесь в Configuration — самый левый пункт нижней панели.</InstructionStep>
              <InstructionStep number={7}>Нажмите кнопку со спидометром сверху и дождитесь результатов тестирования.</InstructionStep>
              <InstructionStep number={8}>Выберите одну из рабочих конфигураций.</InstructionStep>
              <InstructionStep number={9}>Нажмите кнопку включения в крайнем правом пункте нижней панели, чтобы подключиться — готово!</InstructionStep>
              <InstructionStep number={10}>Если вам привычнее другое приложение, попробуйте настроить его аналогично, но совместимость не гарантирована.</InstructionStep>
            </>
          )}
          <Text style={{marginTop: 14, color: colors.text, fontSize: 15, lineHeight: 21}}>{DEMO_CONFIGURATION_NOTE}</Text>
          <Text style={{marginTop: 10, color: withOpacity(colors.text, 78), fontSize: 14, lineHeight: 20}}>Инструкции для других платформ есть в Telegram-боте.</Text>
        </View>
      )}
    </>
  );
};

export const DemoSubscriptionLink: React.FC<{
  access: VpnDemoAccess;
  copied: boolean;
  onCopy: () => void;
  instructionsExpanded: boolean;
  onToggleInstructions: () => void;
}> = ({access, copied, onCopy, instructionsExpanded, onToggleInstructions}) => {
  const {colors} = useTheme<CustomTheme>();
  return (
    <View style={{marginTop: 13, padding: 13, borderRadius: 8, backgroundColor: withOpacity(colors.background, 57), borderWidth: 1, borderColor: withOpacity(colors.textUnderline, 48)}}>
      <Text style={{color: colors.text, fontSize: 16, fontWeight: 'bold'}}>Ссылка подписки</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Скопировать ссылку подписки"
        onPress={onCopy}
        style={{flexDirection: 'row', alignItems: 'center', minHeight: 48, marginTop: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: withOpacity(colors.primary, 84)}}
      >
        <Text numberOfLines={1} ellipsizeMode="middle" style={{flex: 1, color: colors.textUnderline, fontSize: 14, textDecorationLine: 'underline'}}>{access.demoSubURL}</Text>
        <MaterialIcons.default name="content-copy" size={23} color={colors.textUnderline} style={{marginLeft: 10}}/>
      </TouchableOpacity>
      {copied && <Text accessibilityLiveRegion="polite" style={{marginTop: 7, color: colors.accent, fontSize: 14}}>Ссылка скопирована</Text>}
      <ConnectionInstructions expanded={instructionsExpanded} onToggle={onToggleInstructions}/>
    </View>
  );
};

const getVerificationDescription = (
  state: VpnVerificationState,
  result: VpnVerificationResult | undefined,
  checking: boolean,
): string => {
  if (!state.clientName) {
    return 'Ссылка на подписку ещё не добавлена.';
  }
  if (checking) {
    return 'Проверяем активность подписки…';
  }
  switch (result) {
    case 'ACTIVE': return 'Подписка активна - пользуйтесь MpeiApp без рекламы и ограничений!';
    case 'INACTIVE_CONFIRMED': return state.lastEffectiveStatus === 'REVOKED'
      ? 'Активная подписка не подтверждена.'
      : 'Подписка временно не подтверждена; действует grace-период.';
    case 'TRANSIENT_FAILURE': return state.lastEffectiveStatus === 'GRACE'
      ? 'Проверка временно недоступна; доступ сохранён на grace-период.'
      : 'Проверка временно недоступна. Попробуйте снова позже.';
    case 'OFFLINE_SKIPPED': return 'Нет подключения: статус подписки не изменён.';
  }
  switch (state.lastEffectiveStatus) {
    case 'ACTIVE': return 'Подписка активна - пользуйтесь MpeiApp без рекламы и ограничений!';
    case 'GRACE': return 'Доступ временно сохранён на grace-период.';
    case 'REVOKED': return 'Подписка неактивна.';
    case 'NONE': return 'Ссылка сохранена. Выполните проверку.';
  }
};

const VerificationSection: React.FC<{
  expanded: boolean;
  onToggle: () => void;
  state: VpnVerificationState;
  result: VpnVerificationResult | undefined;
  checking: boolean;
  onVerify: () => void;
  editorVisible: boolean;
  onToggleEditor: () => void;
  link: string;
  onChangeLink: (link: string) => void;
  onSaveLink: () => void;
  onPasteLink: () => void;
  onDisconnect: () => void;
}> = props => {
  const {colors} = useTheme<CustomTheme>();
  const hasLink = !!props.state.clientName;
  const hasConfirmedActiveSubscription = props.state.lastEffectiveStatus === 'ACTIVE';
  return (
    <>
      {!hasConfirmedActiveSubscription && (
        <View style={{marginTop: 14, paddingHorizontal: 2}}>
          <Text style={{color: '#FFFFFF', fontSize: 16, fontWeight: 'bold'}}>Уже пользуетесь DragoNet?</Text>
          <Text style={{marginTop: 4, color: withOpacity('#FFFFFF', 88), fontSize: 15, lineHeight: 21}}>Проверьте подписку, чтобы отключить рекламу и открыть полный доступ к возможностям MpeiApp.</Text>
        </View>
      )}
      <AccordionHeader title="Проверка активной подписки" icon="verified-user" expanded={props.expanded} onPress={props.onToggle}/>
      {props.expanded && (
        <View style={{marginTop: 8, padding: 13, borderRadius: 7, backgroundColor: withOpacity(colors.background, 48)}}>
          <Text style={{color: withOpacity(colors.text, 88), fontSize: 15, lineHeight: 21}}>{getVerificationDescription(props.state, props.result, props.checking)}</Text>
          {hasLink && <ActionButton title={props.checking ? 'Проверяем…' : props.result ? 'Проверить снова' : 'Проверить'} icon="refresh" disabled={props.checking} onPress={props.onVerify}/>} 
          <ActionButton title={hasLink ? 'Сменить ссылку' : 'Добавить ссылку'} icon="link" subtle onPress={props.onToggleEditor}/>
          {props.editorVisible && (
            <View style={{marginTop: 10}}>
              <TextInput
                value={props.link}
                onChangeText={props.onChangeLink}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="Вставьте ссылку подписки"
                placeholderTextColor={withOpacity(colors.text, 45)}
                style={{minHeight: 48, paddingHorizontal: 11, color: colors.text, fontSize: 14, borderRadius: 6, borderWidth: 1, borderColor: withOpacity(colors.text, 32), backgroundColor: withOpacity(colors.primary, 84)}}
              />
              <ActionButton title="Вставить из буфера" icon="content-paste" subtle onPress={props.onPasteLink}/>
              <ActionButton title="Сохранить ссылку" icon="check" onPress={props.onSaveLink}/>
            </View>
          )}
          {hasLink && <ActionButton title="Отключить на этом устройстве" icon="link-off" subtle onPress={props.onDisconnect}/>} 
        </View>
      )}
    </>
  );
};

export const DemoResultSheet: React.FC<{
  visible: boolean;
  access: VpnDemoAccess | undefined;
  copied: boolean;
  onCopy: () => void;
  instructionsExpanded: boolean;
  onToggleInstructions: () => void;
  onClose: () => void;
}> = props => {
  const {colors} = useTheme<CustomTheme>();
  if (!props.access) {
    return null;
  }
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={{flex: 1, justifyContent: 'flex-end', backgroundColor: withOpacity('#000000', 60)}}>
        <View style={{maxHeight: '88%', padding: 18, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: colors.backdrop}}>
          <ScrollView contentContainerStyle={{paddingBottom: 2}}>
            <Text style={{color: colors.text, fontSize: 21, fontWeight: 'bold'}}>Демо-доступ готов</Text>
            <Text style={{marginTop: 6, color: withOpacity(colors.text, 84), fontSize: 15, lineHeight: 21}}>Скопируйте ссылку и импортируйте её в VPN-клиент.</Text>
            <DemoSubscriptionLink
              access={props.access}
              copied={props.copied}
              onCopy={props.onCopy}
              instructionsExpanded={props.instructionsExpanded}
              onToggleInstructions={props.onToggleInstructions}
            />
            <ActionButton title="Готово" onPress={props.onClose}/>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const DragoNetPromoCard: React.FC = () => {
  const {colors} = useTheme<CustomTheme>();
  const [snapshot, setSnapshot] = React.useState(() => vpnSubscriptionService.getSnapshot());
  const [isDemoRequesting, setDemoRequesting] = React.useState(false);
  const [isChecking, setChecking] = React.useState(false);
  const [isDemoSheetVisible, setDemoSheetVisible] = React.useState(false);
  const [isInstructionsExpanded, setInstructionsExpanded] = React.useState(false);
  const [isVerificationExpanded, setVerificationExpanded] = React.useState(false);
  const [isLinkEditorVisible, setLinkEditorVisible] = React.useState(false);
  const [subscriptionLink, setSubscriptionLink] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const copiedTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    const unsubscribe = vpnSubscriptionService.subscribe(setSnapshot);
    const expiryWatcher = setInterval(() => setSnapshot(vpnSubscriptionService.getSnapshot()), 60_000);
    return () => {
      unsubscribe();
      clearInterval(expiryWatcher);
      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current);
      }
    };
  }, []);

  const copyDemoLink = React.useCallback(() => {
    const access = vpnSubscriptionService.getSnapshot().demoAccess;
    if (!access) {
      return;
    }
    Clipboard.setString(access.demoSubURL);
    setCopied(true);
    if (copiedTimer.current) {
      clearTimeout(copiedTimer.current);
    }
    copiedTimer.current = setTimeout(() => setCopied(false), 2_000);
  }, []);

  const requestDemo = async () => {
    if (isDemoRequesting) {
      return;
    }
    setDemoRequesting(true);
    const result = await vpnSubscriptionService.requestDemo();
    setDemoRequesting(false);
    setSnapshot(vpnSubscriptionService.getSnapshot());
    if (result.kind === 'ready') {
      setDemoSheetVisible(true);
      return;
    }
    Alert.alert('Демо-доступ недоступен', 'Не удалось выдать демо-доступ. Во избежание злоупотреблений запросить демо можно лишь раз в месяц. Попробуйте позже.');
  };

  const verifySubscription = async () => {
    if (isChecking) {
      return;
    }
    if (!snapshot.verificationState.clientName) {
      setLinkEditorVisible(true);
      return;
    }
    setChecking(true);
    await vpnSubscriptionService.verify();
    setChecking(false);
  };

  const saveSubscriptionLink = () => {
    if (!vpnSubscriptionService.setSubscriptionLink(subscriptionLink.trim())) {
      Alert.alert('Не удалось сохранить ссылку', 'Проверьте, что это ссылка подписки DragoNet, и вставьте её полностью.');
      return;
    }
    setSubscriptionLink('');
    setLinkEditorVisible(false);
  };

  const pasteSubscriptionLink = async () => {
    try {
      setSubscriptionLink(await Clipboard.getString());
    } catch {
      Alert.alert('Не удалось вставить ссылку', 'Скопируйте ссылку подписки и попробуйте ещё раз.');
    }
  };

  const disconnect = () => {
    vpnSubscriptionService.disconnect();
    setSubscriptionLink('');
    setLinkEditorVisible(false);
  };

  const hasConfirmedActiveSubscription = snapshot.verificationState.lastEffectiveStatus === 'ACTIVE';

  return (
    <>
      <View style={{width: '100%', marginTop: 14, overflow: 'hidden', borderRadius: 10, backgroundColor: colors.primary}}>
        <ImageBackground source={require('../../../assets/images/DragoNet/DragoNet.webp')} imageStyle={{borderRadius: 10}} style={{width: '100%'}}>
          <View style={{padding: 16, backgroundColor: withOpacity('#09070B', 78)}}>
            <View style={{minHeight: 31, paddingRight: 194}}>
              <Text style={{color: colors.accent, fontSize: 25, fontWeight: 'bold'}}>Drago{'\u200B'}Net</Text>
            </View>
            <View pointerEvents="none" style={{position: 'absolute', top: 14, right: 16, maxWidth: 190, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5, backgroundColor: withOpacity('#120B24', 76)}}>
              <Text style={{color: colors.accent, fontSize: 11, fontWeight: '600', lineHeight: 14, textAlign: 'right', textShadowColor: withOpacity('#000000', 72), textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2}}>Чтобы был не "Чебурнет" -{'\n'}подключайте DragoNet!</Text>
            </View>
            <PromoAppIconsMarquee/>
            {hasConfirmedActiveSubscription ? (
              <Text style={{marginTop: 8, color: '#FFFFFF', fontSize: 16, lineHeight: 22}}>Вы уже пользуетесь DragoNet! В качестве благодарности за выбор нашего сервиса в приложении отключена вся реклама и убраны ограничения - наслаждайтесь!</Text>
            ) : (
              <Text style={{marginTop: 8, color: '#FFFFFF', fontSize: 16, lineHeight: 22}}>
                - Стабильный доступ к любым приложениям и сайтам
                {'\n'}
                - Сервисы РФ доступны без отключения VPN
                {'\n'}
                - Нестандартные протоколы(ниже риски блокировок в будущем)
                {'\n'}
                - Без подписок на каналы
                {'\n'}
                - Без лимитов на устройства
                {'\n'}
                - От 80 ₽ в месяц
              </Text>
            )}
            <ActionButton title={hasConfirmedActiveSubscription ? 'Перейти к боту' : 'Подключить DragoNet'} leadingIcon={<FontAwesome.default name="telegram" size={20} color={colors.accent}/>} onPress={() => void openExternalUrl(dragonetTelegramUrl, 'Не удалось открыть Telegram')}/>
            {!hasConfirmedActiveSubscription && !snapshot.demoAccess && <ActionButton title={isDemoRequesting ? 'Получаем демо-доступ…' : 'Бесплатный демо-доступ'} icon="card-giftcard" disabled={isDemoRequesting} subtle onPress={() => void requestDemo()}/>}
            {snapshot.demoAccess && (
              <DemoSubscriptionLink
                access={snapshot.demoAccess}
                copied={copied}
                onCopy={copyDemoLink}
                instructionsExpanded={isInstructionsExpanded}
                onToggleInstructions={() => setInstructionsExpanded(expanded => !expanded)}
              />
            )}
            <VerificationSection
              expanded={isVerificationExpanded}
              onToggle={() => setVerificationExpanded(expanded => !expanded)}
              state={snapshot.verificationState}
              result={snapshot.lastVerificationResult}
              checking={isChecking}
              onVerify={() => void verifySubscription()}
              editorVisible={isLinkEditorVisible}
              onToggleEditor={() => setLinkEditorVisible(visible => !visible)}
              link={subscriptionLink}
              onChangeLink={setSubscriptionLink}
              onSaveLink={saveSubscriptionLink}
              onPasteLink={() => void pasteSubscriptionLink()}
              onDisconnect={disconnect}
            />
          </View>
        </ImageBackground>
      </View>
      <DemoResultSheet
        visible={isDemoSheetVisible}
        access={snapshot.demoAccess}
        copied={copied}
        onCopy={copyDemoLink}
        instructionsExpanded={isInstructionsExpanded}
        onToggleInstructions={() => setInstructionsExpanded(expanded => !expanded)}
        onClose={() => setDemoSheetVisible(false)}
      />
    </>
  );
};

export default DragoNetPromoCard;
