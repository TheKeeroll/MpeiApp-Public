import {
    Alert,
    Dimensions,
    LayoutAnimation, Linking, ScrollView,
    Text,
    TouchableOpacity,
    View, ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {loadingProgressService} from "../../Loading/LoadingProgressService";
import {LOADING_PROGRESS_KEYS} from "../../Loading/LoadingProgressKeys";
import React, {useEffect, useState} from "react";
import BARSAPI from "../../Common/Globals";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
// @ts-expect-error
import * as Icon from 'react-native-vector-icons/Fontisto'
// import * as ADIcon from 'react-native-vector-icons/AntDesign'
import {TextInput, useTheme} from "react-native-paper";
import {withOpacity, CustomTheme} from "../../Themes/Themes";
import {isBARSError} from "../../API/Error/Error";
import MapScreen from "../Map/MapScreen";
import {openSupportChat} from "../Settings/Components";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
// @ts-expect-error
import * as FIcon from "react-native-vector-icons/Feather";
// @ts-expect-error
import * as MtIcon from "react-native-vector-icons/MaterialIcons";
import SettingsStack from "../Settings/SettingsStack.tsx";
import AF2Screen from "./AF2Screen";
import {GuestScheduleStack} from "../Schedule/ScheduleStack";
import {maskSavedPassword} from "../../Login/StudentAccountState";

const Stack = createBottomTabNavigator()
const BARS_REGISTRATION_URL = 'https://mpei.ru/Pages/registration.aspx'

export const Button: React.FC<{title?: string, icon?: string, iconSize?: number, onPress: ()=>void, style: ViewStyle, disabled?: boolean}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <TouchableOpacity disabled={props.disabled} onPress={props.onPress} style={[{backgroundColor: colors.surface, borderRadius: 15, alignItems: 'center', justifyContent: 'center', opacity: props.disabled ? 0.45 : 1}, props.style]}>
            {typeof props.icon != 'undefined' ?
                <Icon.default name={props.icon} adjustsFontSizeToFit size={props.iconSize} color={colors.textUnderline}/> :
                <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.textUnderline}}>{props.title}</Text>
            }
        </TouchableOpacity>
    )
}

type HelpSection = 'credentials' | 'twoFactor' | 'guestAccess' | 'privacy' | 'support'

const HelpAccordion: React.FC<{
    title: string
    expanded: boolean
    onPress: () => void
    children: React.ReactNode
}> = ({title, expanded, onPress, children}) => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <View style={{backgroundColor: colors.surface, borderRadius: 12, marginBottom: 10, overflow: 'hidden'}}>
            <TouchableOpacity
                accessible
                accessibilityRole={'button'}
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
    )
}

const Help: React.FC<{onBack: ()=>void}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    const [expandedSection, setExpandedSection] = useState<HelpSection>()

    const toggleSection = (section: HelpSection) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        setExpandedSection(current => current === section ? undefined : section)
    }

    const openBarsRegistration = async () => {
        try {
            const canOpen = await Linking.canOpenURL(BARS_REGISTRATION_URL)
            if (!canOpen) {
                throw new Error('Registration URL cannot be opened')
            }
            await Linking.openURL(BARS_REGISTRATION_URL)
        } catch {
            Alert.alert('Не удалось открыть страницу', 'Попробуйте открыть её позже через браузер.')
        }
    }

    const paragraphStyle = {fontSize: 15, lineHeight: 22, color: withOpacity(colors.text, 85), marginBottom: 12}
    const warningStyle = {...paragraphStyle, color: withOpacity(colors.warning, 90)}
    return (
        <SafeAreaView style={{flex: 1, width: '90%', minHeight: (Dimensions.get("window").height * 0.7), borderRadius: 5, paddingTop: insets.top, paddingBottom: insets.bottom + 36, alignSelf: 'center', justifyContent: 'flex-start'}}>
            <ScrollView style={{flex: 1, width: '100%'}} contentContainerStyle={{paddingVertical: '2%'}}>
                <Text style={{fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 8}}>Добро пожаловать!</Text>
                <Text style={{fontSize: 16, lineHeight: 23, color: withOpacity(colors.text, 85), marginBottom: 18}}>
                    Для работы с личными данными нужны логин и пароль БАРС. Они сохраняются только на устройстве, чтобы не вводить их при каждом запуске. Карта с навигатором и поиск расписания доступны и без входа.
                </Text>

                <HelpAccordion title={'Где взять логин и пароль БАРС?'} expanded={expandedSection === 'credentials'} onPress={() => toggleSection('credentials')}>
                    <Text style={paragraphStyle}>
                        Проверьте личный кабинет абитуриента на сайте приёмной комиссии. Важно: логин и пароль от него не подходят для БАРС — это разные системы.
                    </Text>
                    <Text style={paragraphStyle}>
                        Проверьте основную почту и папку «Спам». Вам могли прислать приветственное сообщение с логином и идентификационным номером.
                    </Text>
                    <Text style={paragraphStyle}>
                        Если эти данные есть, зарегистрируйтесь в БАРС, чтобы получить пароль.
                    </Text>
                    <Button title={'Зарегистрироваться в БАРС'} onPress={openBarsRegistration} style={{width: '100%', aspectRatio: 4.8, marginBottom: 14}}/>
                    <Text style={warningStyle}>
                        Не рассчитывайте на активацию через 20 минут: на практике ожидание занимает минимум сутки, а иногда и неделю.
                    </Text>
                    <Text style={{...paragraphStyle, marginBottom: 0}}>
                        Если этот путь не подходит и других сведений вам не передали, дождитесь информации от старосты или представителей вуза и периодически проверяйте личный кабинет приёмной комиссии. Доступ могут выдать уже после начала учёбы, в том числе не на первой учебной неделе: единого способа для всех групп нет.
                    </Text>
                </HelpAccordion>

                <HelpAccordion title={'Как работает двухфакторная аутентификация?'} expanded={expandedSection === 'twoFactor'} onPress={() => toggleSection('twoFactor')}>
                    <Text style={paragraphStyle}>
                        Если в вашем аккаунте включена 2ФА, MpeiApp запросит код подтверждения и подскажет, где его искать: в VK, MAX, Telegram, приложении-аутентификаторе или среди временных кодов.
                    </Text>
                    <Text style={paragraphStyle}>
                        Обычно код приходит быстро, но иногда нужно подождать 10–30 секунд. По причинам на стороне БАРС запрос 2ФА может потребоваться при каждом входе.
                    </Text>
                    <Text style={{...warningStyle, marginBottom: 0}}>
                        Если код приходит, но вход не выполняется, проверьте на сайте БАРС привязанные способы 2ФА и выбранных провайдеров. Временный код должен быть действующим.
                    </Text>
                </HelpAccordion>

                <HelpAccordion title={'Что доступно без входа?'} expanded={expandedSection === 'guestAccess'} onPress={() => toggleSection('guestAccess')}>
                    <Text style={{...paragraphStyle, marginBottom: 0}}>
                        Без аккаунта остаются доступны 3D-карта с навигатором и поиск расписаний. Перейдите на соответствующие вкладки внизу экрана.
                    </Text>
                </HelpAccordion>

                <HelpAccordion title={'Конфиденциальность и реклама'} expanded={expandedSection === 'privacy'} onPress={() => toggleSection('privacy')}>
                    <Text style={paragraphStyle}>
                        По умолчанию MpeiApp не передаёт личные сведения разработчику или посторонним лицам. Данные БАРС нужны приложению только для работы ваших экранов.
                    </Text>
                    <Text style={{...paragraphStyle, marginBottom: 0}}>
                        При отдельном согласии в рекламные интеграции могут передаваться приблизительные данные о поле и возрасте, а геопозиция — только если вы разрешили её для карты.
                    </Text>
                </HelpAccordion>

                <HelpAccordion title={'Нужна помощь?'} expanded={expandedSection === 'support'} onPress={() => toggleSection('support')}>
                    <Text style={{...paragraphStyle, marginBottom: 0}}>
                        Если что-то не получается, закройте справку и нажмите «Поддержка» на экране входа. Там можно сообщить о проблеме, задать вопрос или предложить улучшение.
                    </Text>
                </HelpAccordion>
            </ScrollView>
            <Button title={'Назад'} onPress={props.onBack.bind(this)} style={{marginTop: '2%', marginBottom: 36, alignSelf: 'center', width: '60%', aspectRatio: 4.8}}/>
        </SafeAreaView>
    )
}

export const LoginScreenHeader: React.FC = () => {
  const {colors} = useTheme<CustomTheme>()
  return (
    <View style={{ width: '85%', maxWidth: 400, alignItems: 'center' }}>
      <Text style={{
        fontWeight: 'bold',
        fontSize: 48,
        marginBottom: '5%',
        color: withOpacity(colors.text, 90),
        textAlign: 'center',
        flexWrap: 'wrap'
      }}>
        MpeiApp
      </Text>
      <View style={{width: '100%', flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap'}}>
        <Text style={{fontWeight: 'bold', fontSize: 20, color: withOpacity(colors.text, 40)}}>Кроссплатформенный </Text>
        <Text style={{fontWeight: 'bold', fontSize: 20, color: withOpacity(colors.text, 90)}}>БАРС</Text>
      </View>
      <View style={{width: '100%', flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap'}}>
        <Text style={{fontWeight: 'bold', fontSize: 20, color: withOpacity(colors.text, 40)}}>c </Text>
        <Text style={{fontWeight: 'bold', fontSize: 20, color: withOpacity(colors.text, 90)}}>расписанием</Text>
        <Text style={{fontWeight: 'bold', fontSize: 20, color: withOpacity(colors.text, 40)}}> и </Text>
        <Text style={{fontWeight: 'bold', fontSize: 20, color: withOpacity(colors.text, 90)}}>картой </Text>
      </View>
      <View style={{width: '100%', flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap'}}>
        <Text style={{fontWeight: 'bold', fontSize: 20, color: withOpacity(colors.text, 90)}}>в кармане</Text>
        <Text style={{fontWeight: 'bold', fontSize: 20, color: withOpacity(colors.text, 40)}}>.</Text>
      </View>
    </View>
  )
}

const StudentsNotFoundPanel: React.FC = () => {
    const {colors} = useTheme<CustomTheme>()
    const credentials = BARSAPI.GetCreds()
    const [isRetrying, setIsRetrying] = useState(false)

    const retry = () => {
        if (isRetrying) return

        LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
        setIsRetrying(true)
        void BARSAPI.RetryStudentAccountCheck()
    }

    return (
        <View style={{width: '90%', maxWidth: 400, marginTop: '10%'}}>
            <View
                accessible
                accessibilityLabel={`Сохранённые данные аккаунта. Логин: ${credentials.login}. Пароль скрыт.`}
                style={{backgroundColor: colors.surface, borderRadius: 15, padding: '5%', marginBottom: '6%'}}
            >
                <Text style={{fontWeight: 'bold', fontSize: 15, color: withOpacity(colors.text, 65), marginBottom: '2%'}}>Логин</Text>
                <Text selectable={false} style={{fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: '5%'}}>{credentials.login}</Text>
                <Text style={{fontWeight: 'bold', fontSize: 15, color: withOpacity(colors.text, 65), marginBottom: '2%'}}>Пароль</Text>
                <Text
                    accessible={false}
                    selectable={false}
                    style={{fontSize: 18, fontWeight: 'bold', color: colors.text}}
                >
                    {maskSavedPassword(credentials.password)}
                </Text>
            </View>
            <Text style={{fontSize: 16, lineHeight: 23, color: withOpacity(colors.text, 90), marginBottom: '8%'}}>
                Вход в аккаунт БАРС выполнен, но не найдено ни одного Личного Кабинета студента. Если вы недавно поступили в МЭИ, то это нормально — вуз ещё не успел всё подготовить, просто пробуйте снова через несколько дней. Если проблема сохранится дольше пары недель — свяжитесь с разработчиком.
            </Text>
            <Button
                title={'Проверить снова'}
                disabled={isRetrying}
                onPress={retry}
                style={{width: '100%', aspectRatio: 4.8, marginBottom: '4%'}}
            />
            <Button
                title={'Выйти из аккаунта'}
                disabled={isRetrying}
                onPress={() => BARSAPI.Logout()}
                style={{width: '100%', aspectRatio: 4.8}}
            />
        </View>
    )
}

const LoginScreen: React.FC = () => {
    const {colors} = useTheme<CustomTheme>()
    const [login, setLogin] = useState('')
    const [password, setPassword] = useState('')
    const [showingHelp, setShowingHelp] = useState(false)
    const [showLoading, setShowLoading] = useState(false)
    const [showingAF2, setShowingAF2] = useState(false)
    let isMounted = false
    useEffect(()=>{
        isMounted = true
        return ()=>{isMounted = false}
    })

    const shHCb = ()=> {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        if(isMounted)setShowingHelp(p=>!p)
    }

    const insets = useSafeAreaInsets();
    return (
        <SafeAreaView style={{
            flex: 1,
            backgroundColor: colors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            alignItems: 'center',
        }}>
          <LoginScreenHeader/>
              {BARSAPI.LoginState === 'STUDENTS_NOT_FOUND' ? <StudentsNotFoundPanel/> : showingHelp ? <Help onBack={shHCb}/>: showLoading ? <LoadingScreen progressKey={LOADING_PROGRESS_KEYS.login} fallbackLabel={'Проверка логина и пароля...'}/> :
                showingAF2 ? <AF2Screen onBack={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                    setShowingAF2(false)
                }}/> :
                <View style={{width: '90%', maxWidth: 400, marginTop: '10%'}}>
                    <TextInput
                      onChangeText={t=>setLogin(t)}
                      value={login}
                      textColor={colors.text}
                      placeholder={'Логин'}
                      textContentType={'username'}
                      placeholderTextColor={withOpacity(colors.text, 40)}
                      underlineColor={colors.text}
                      activeUnderlineColor={colors.textUnderline}
                      style={{backgroundColor: colors.background, borderRadius: 0}}
                      theme={{colors}}
                    />
                    <TextInput
                      onChangeText={t=>setPassword(t)}
                      value={password}
                      textColor={colors.text}
                      placeholder={'Пароль'}
                      textContentType={'password'}
                      secureTextEntry
                      placeholderTextColor={withOpacity(colors.text, 40)}
                      underlineColor={colors.text}
                      activeUnderlineColor={colors.textUnderline}
                      style={{backgroundColor: colors.background, borderRadius: 0}}
                      theme={{colors}}
                    />
                    <View style={{height: '7%'}}/>
                    <View style={{marginBottom: '4%', flexDirection: 'row', width: '90%', alignSelf: 'center', justifyContent: 'space-between'}}>
                        <View style={{ flexDirection: 'column',  width: '66%', alignSelf: 'flex-start', alignItems: 'flex-start'}}>
                            <Button title={'Войти'} onPress={()=>{
                                const progress = loadingProgressService.start(
                                    LOADING_PROGRESS_KEYS.login,
                                    'Проверка логина и пароля...',
                                )
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                                setShowLoading(true)
                                setTimeout(()=>{
                                    loadingProgressService.advance(progress, 'Запрос к БАРС...')
                                    BARSAPI.Login({login, password}).then((r)=>{
                                    if (r === "NEED_2FA") {
                                        loadingProgressService.complete(progress)
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                                        setShowLoading(false)
                                        setShowingAF2(true)
                                        return
                                    }
                                    if (r === 'STUDENTS_NOT_FOUND') {
                                        loadingProgressService.complete(progress)
                                        BARSAPI.EnterStudentsNotFoundState()
                                        return
                                    }
                                    if (r === 'CANCELLED') {
                                        loadingProgressService.fail(progress)
                                        return
                                    }
                                    if (r === 'ONLINE') {
                                        loadingProgressService.complete(progress)
                                        void BARSAPI.LoadOnlineData()
                                    }
                                }, (e: any)=>{
                                    loadingProgressService.fail(progress)
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                                    setShowLoading(false)
                                    Alert.alert('Ошибка!', isBARSError(e) ? e.message : e.toString())
                                    BARSAPI.SetLoginState('NOT_LOGGED_IN')
                                })
                              }, 250)
                            }} style={{ width: '100%', aspectRatio: 4.8, marginVertical: '5%' }}/>

                            <View style={{marginBottom: '4%', flexDirection: 'row', width: '100%', alignSelf: 'center', justifyContent: 'space-between'}}>
                                <Button title={'Поддержка'} onPress={() => openSupportChat('vk')} style={{ width: '66%', aspectRatio: 4.8, marginVertical: '5%' }}/>
                            </View>
                        </View>
                        <Button icon={'question'} onPress={shHCb} style={{alignSelf: 'flex-start', width: '20%', aspectRatio: 1, marginVertical: '3%'}}/>
                    </View>
                    <View style={{flexDirection: 'row'}}>
                        <Text style={{fontWeight: 'bold', color: withOpacity(colors.text, 30)}}>Версия: </Text>
                        <Text style={{fontWeight: 'bold', color: withOpacity(colors.text, 90)}}>{require('../../../package.json').version}</Text>
                    </View>
                </View>
              }
        </SafeAreaView>
    )
}

const LoginScreenWrapper : React.FC = () => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <Stack.Navigator
            initialRouteName={'loginMain'}
            screenOptions={{headerShown: false,
                tabBarStyle:{borderTopWidth: 0, backgroundColor: colors.backdrop}}}
        >
            <Stack.Screen
                name={'loginMain'}
                component={LoginScreen}
                options={{
                    title: 'Вход',
                    tabBarActiveTintColor: colors.textUnderline,
                    tabBarIcon: ()=><FIcon.default name={'log-in'} adjustsFontSizeToFit size={25} style={{color: colors.text}}/>
                }}
            />
            <Stack.Screen
                name={'map'}
                component={MapScreen}
                options={{
                    title: 'Карта',
                    tabBarActiveTintColor: colors.textUnderline,
                    tabBarIcon: ()=><FIcon.default name={'map-pin'} adjustsFontSizeToFit size={25} style={{color: colors.text}}/>
                }}
            />
            <Stack.Screen
                name={'schedule'}
                component={GuestScheduleStack}
                options={{
                    title: 'Расписание',
                    tabBarActiveTintColor: colors.textUnderline,
                    tabBarIcon: ()=><FIcon.default name={'calendar'} adjustsFontSizeToFit size={25} style={{color: colors.text}}/>
                }}
            />
            <Stack.Screen
                name={'other'}
                component={SettingsStack}
                options={{
                    title: 'Прочее',
                    tabBarActiveTintColor: colors.textUnderline,
                    tabBarIcon: ()=><MtIcon.default name={'miscellaneous-services'} adjustsFontSizeToFit size={25} style={{color: colors.text}}/>
                }}
            />
        </Stack.Navigator>
    )
}

export default LoginScreenWrapper


