import {
    Alert,
    DeviceEventEmitter,
    LayoutAnimation, SafeAreaView,
    Text,
    TouchableOpacity,
    View, ViewStyle,
} from "react-native";
import React, {Fragment, useEffect, useState} from "react";
import BARSAPI from "../../Common/Globals";
import {LoginState} from "../../API/BARS";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import * as Icon from 'react-native-vector-icons/Fontisto'
import {TextInput, useTheme} from "react-native-paper";
import {withOpacity} from "../../Themes/Themes";
import {isBARSError} from "../../API/Error/Error";
import {createStackNavigator} from "@react-navigation/stack";
import MapScreen from "../Map/MapScreen";
import {useNavigation} from "@react-navigation/native";
import {openSupportChat} from "../Settings/Components";

const Stack = createStackNavigator()
export const Button: React.FC<{title?: string, icon?: string, iconSize?: number, onPress:()=>void, style: ViewStyle}> = (props) => {
    const {colors} = useTheme()
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
    const {colors} = useTheme()
    return (
        <View style={{width: '90%', borderRadius: 5, marginTop: '20%', alignSelf: 'center', justifyContent: 'center'}}>
            <Text style={{padding: '2%', color: withOpacity(colors.text, 80)}}>
                Приложение для взаимодействия с сервисами НИУ "МЭИ".
                {'\n\n'}
                Для начала, перейдите на карту или введите ваш логин и пароль от системы "БАРС".
            </Text>
            <Button title={'Назад'} onPress={props.onBack.bind(this)} style={{margin: '2%', alignSelf: 'center', width: '60%', aspectRatio: 4.8}}/>
        </View>
    )
}

const LoginScreen: React.FC = () => {
    const {colors} = useTheme()
    const navigator = useNavigation();
    const [login, setLogin] = useState('')
    const [password, setPassword] = useState('')
    const [showingHelp, setShowingHelp] = useState(false)
    const [showLoading, setShowLoading] = useState(false)
    let isMounted = false
    useEffect(()=>{
        isMounted = true
        return ()=>{isMounted = false}
    })

    const shHCb = ()=> {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        if(isMounted)setShowingHelp(p=>!p)
    }


    return (
      <Fragment>
          <SafeAreaView style={{flex: 0, backgroundColor: colors.background}}/>
          <SafeAreaView style={{flex: 1, backgroundColor: colors.background, alignItems: 'center'}}>
              <View style={{width: '85%', maxWidth: 400, alignItems: 'center'}}>
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
              {showingHelp ? <Help onBack={shHCb}/>: showLoading ? <LoadingScreen/> :
                <View style={{width: '90%', maxWidth: 400, marginTop: '10%'}}>
                    <TextInput
                      onChangeText={t=>setLogin(t)}
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
                        <Button title={'Войти'} onPress={()=>{
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                            setShowLoading(true)
                            setTimeout(()=>BARSAPI.Login({login, password}).then((r)=>{
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
                            }), 900)
                        }} style={{ width: '60%', aspectRatio: 4.8}}/>
                        <Button title={'?'} onPress={shHCb} style={{ width: '12.5%', aspectRatio: 1}}/>
                        <Button icon={'map-marker-alt'} iconSize={25} onPress={()=>{
                            //@ts-ignore
                            navigator.navigate('mapLogin', {fromLoginScreen: true})
                        }} style={{ width: '12.5%', aspectRatio: 1}}/>
                    </View>
                    <View style={{marginBottom: '4%', flexDirection: 'row', width: '90%', alignSelf: 'center', justifyContent: 'space-between'}}>
                        <Button title={'Поддержка'} onPress={openSupportChat} style={{ width: '60%', aspectRatio: 4.8}}/>
                    </View>
                    <View style={{flexDirection: 'row'}}>
                        <Text style={{color: withOpacity(colors.text, 30)}}>Версия: </Text>
                        <Text style={{color: withOpacity(colors.text, 70)}}>{require('../../../package.json').version}</Text>
                    </View>
                </View>
              }
          </SafeAreaView>
      </Fragment>

    )
}

const LoginScreenWrapper : React.FC = () => {
    return (
        <Stack.Navigator
            initialRouteName={'loginMain'}
            screenOptions={{headerShown: false}}
        >
            <Stack.Screen name={'loginMain'} component={LoginScreen}/>
            <Stack.Screen name={'mapLogin'} component={MapScreen}/>
        </Stack.Navigator>
    )
}

export default LoginScreenWrapper


