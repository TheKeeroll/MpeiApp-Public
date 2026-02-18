import {
    Alert,
    DeviceEventEmitter, Dimensions,
    LayoutAnimation, ScrollView,
    Text,
    TouchableOpacity,
    View, ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import React, {useEffect, useState} from "react";
import BARSAPI from "../../Common/Globals";
import {LoginState} from "../../API/BARS";
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
import SettingsStack from "../Settings/SettingsStack.tsx";
import AF2Screen from "./AF2Screen";

const Stack = createBottomTabNavigator()
export const Button: React.FC<{title?: string, icon?: string, iconSize?: number, onPress: ()=>void, style: ViewStyle}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <TouchableOpacity onPress={props.onPress} style={[{backgroundColor: colors.surface, borderRadius: 15, alignItems: 'center', justifyContent: 'center'}, props.style]}>
            {typeof props.icon != 'undefined' ?
                <Icon.default name={props.icon} adjustsFontSizeToFit size={props.iconSize} color={colors.textUnderline}/> :
                <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.textUnderline}}>{props.title}</Text>
            }
        </TouchableOpacity>
    )
}

const Help: React.FC<{onBack: ()=>void}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    return (
        <SafeAreaView style={{flex: 1, width: '90%', minHeight: (Dimensions.get("window").height * 0.7), borderRadius: 5, paddingTop: insets.top, paddingBottom: insets.bottom + 36, alignSelf: 'center', justifyContent: 'flex-start'}}>
            <ScrollView style={{flex: 1, width: '100%'}}>
                <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.text, 80)}}>
                    Добро пожаловать!
                </Text>
                <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.warning, 80)}}>
                    Для начала, введите логин и пароль от "БАРС" - чтобы скачивать из систем вуза всё необходимое.
                </Text>
                <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.accent, 80)}}>
                    Данные аккаунта будут сохранены на устройстве - чтобы не вводить их каждый раз.
                    {'\n\n'}
                    MpeiApp не передаёт никаких личных сведений ни разработчику, ни кому-либо постороннему!

                </Text>
              <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.warning, 80)}}>
                При необходимости(если в аккаунте включена 2ФА), приложение будет запрашивать коды подтверждения.
                {'\n'}
                К сожалению, такое может требоваться при каждом входе в MpeiApp по не зависящим от разработчика причинам.
              </Text>
                <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.text, 80)}}>
                    Вам ещё не выдали доступ в "БАРС"?
                    {'\n'}
                    Не беда - 3D-карта с навигатором доступна и без входа в аккаунт, просто нажмите её вкладку!
                    {'\n\n'}
                    Столкнулись с проблемой, есть вопросы/предложения?
                    {'\n'}
                    Смело связывайтесь с разработчиком по кнопке "Поддержка".
                    {'\n\n'}
                    Желаю приятного использования и успехов в учёбе!
                </Text>
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
        <Text style={{fontWeight: 'bold', fontSize: 20, color: withOpacity(colors.text, 40)}}>Кросплатформенный </Text>
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
              {showingHelp ? <Help onBack={shHCb}/>: showLoading ? <LoadingScreen/> :
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
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                                setShowLoading(true)
                                setTimeout(()=>BARSAPI.Login({login, password}).then((r)=>{
                                    if (r === "NEED_2FA") {
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                                        setShowLoading(false)
                                        setShowingAF2(true)
                                        return
                                    }
                                    BARSAPI.LoadOnlineData().finally(()=>{
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                                        setTimeout(()=>setShowLoading(false), 10)
                                        DeviceEventEmitter.emit('LoginState', 'LOGGED_IN')
                                    })
                                }, (e: any)=>{
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                                    setShowLoading(false)
                                    Alert.alert('Ошибка!', isBARSError(e) ? e.message : e.toString())
                                    DeviceEventEmitter.emit('LoginState', 'NOT_LOGGED_IN' as LoginState)
                                }), 250)
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
                name={'other'}
                component={SettingsStack}
                options={{
                    title: 'Настройки',
                    tabBarActiveTintColor: colors.textUnderline,
                    tabBarIcon: ()=><FIcon.default name={'settings'} adjustsFontSizeToFit size={25} style={{color: colors.text}}/>
                }}
            />
        </Stack.Navigator>
    )
}

export default LoginScreenWrapper


