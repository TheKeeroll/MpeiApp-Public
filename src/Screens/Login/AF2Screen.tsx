import {
    Alert,
    DeviceEventEmitter, Dimensions,
    LayoutAnimation, Linking, ScrollView,
    Text, TouchableOpacity,
    View,
} from "react-native";
import React, { useEffect, useState } from "react";
import BARSAPI from "../../Common/Globals";
import {LoginState} from "../../API/BARS";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import {TextInput, useTheme} from "react-native-paper";
import {withOpacity, CustomTheme} from "../../Themes/Themes";
import {isBARSError} from "../../API/Error/Error";
import {Button} from "./LoginScreen";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
// @ts-expect-error
import * as FaIcon from "react-native-vector-icons/Fontisto";
import { ListText } from "../Settings/Components.tsx";

interface AF2ScreenProps {
    onBack: () => void;
}

const AF2Screen: React.FC<AF2ScreenProps> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const [code, setCode] = useState('')
    const [showLoading, setShowLoading] = useState(false)
    const [showingHelp, setShowingHelp] = useState(false)

    let isMounted = false
    useEffect(()=>{
        isMounted = true
        return ()=>{isMounted = false}
    })

    const shHCb = ()=> {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        if(isMounted)setShowingHelp(p=>!p)
    }

    const Help: React.FC<{onBack: ()=>void}> = (props) => {
        const {colors} = useTheme<CustomTheme>()
        const insets = useSafeAreaInsets();
        return (
          <SafeAreaView style={{flex: 1, width: '90%', minHeight: (Dimensions.get("window").height * 0.7), borderRadius: 5, paddingTop: insets.top, paddingBottom: insets.bottom + 36, alignSelf: 'center', justifyContent: 'flex-start'}}>
              <ScrollView style={{flex: 1, width: '100%'}}>
                  <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.text, 80)}}>
                      Введите код подтверждения - он должен прийти вам через бота БАРС МЭИ в Telegram/MAX, или от ВК-сообщества БАРС МЭИ, либо быть у вас на руках(если получили временный).
                  </Text>
                  <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.text, 80)}}>
                      Обычно, код приходит почти сразу, но иногда может потребоваться 10 - 30 секунд.
                  </Text>
                  <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.warning, 80)}}>
                      Если вы часто долго ждёте код, и у вас привязан Telegram - отвяжите его на сайте
                      (из-за блокировок РКН код может долго грузиться/не отправляться, а БАРС пытается это сделать, прежде чем пробовать другого провайдера)!
                  </Text>
                  <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.warning, 80)}}>
                      Если не получается войти с временным кодом, убедитесь, что у него не истёк срок действия!
                  </Text>
                  <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.warning, 80)}}>
                      Если код приходит, но войти с ним не получается, убедитесь, что на сайте БАРС МЭИ у вас привязан MAX и что он выбран как один из провайдеров!
                  </Text>
                  <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.warning, 80)}}>
                      Если код не приходит, проверьте возможность его получения!
                      {'\n'}
                      Если на сайте привязали Telegram:
                  </Text>
                  <TouchableOpacity onPress={()=>Linking.openURL('https://t.me/bars_mpei_bot')}>
                      <FaIcon.default name={'telegram'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', justifySelf: 'flex-start', color: colors.textUnderline}}/>
                      <ListText textStyle={{color: colors.textUnderline, marginBottom: 16}} title={'напишите Telegram-боту\nБАРС МЭИ'}/>
                  </TouchableOpacity>
                  <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.warning, 80)}}>
                      Если на сайте привязали VK:
                  </Text>
                  <TouchableOpacity onPress={()=>Linking.openURL('https://vk.com/bars_mpei')}>
                      <FaIcon.default name={'vk'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', justifySelf: 'flex-start', color: colors.textUnderline}}/>
                      <ListText textStyle={{color: colors.textUnderline, marginBottom: 16}} title={'подпишитесь на группу ВК\nБАРС МЭИ и разрешите\nличные сообщения'}/>
                  </TouchableOpacity>
                  <Text style={{padding: '2%', fontSize: 16, fontWeight: 'bold', color: withOpacity(colors.text, 80)}}>
                      Убедившись, что с этим всё в порядке, перезайдите в приложение и попробуйте ещё раз.
                      {'\n'}
                      Если всё это не помогает, свяжитесь с разработчиком по кнопке "Поддержка".
                  </Text>
              </ScrollView>
              <Button title={'Назад'} onPress={props.onBack.bind(this)} style={{marginTop: '2%', marginBottom: 36, alignSelf: 'center', width: '60%', aspectRatio: 4.8}}/>
          </SafeAreaView>
        )
    }

    const handleLogin = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
        setShowLoading(true)
        setTimeout(() => BARSAPI.Login2FA(code).then((r) => {
            BARSAPI.LoadOnlineData().finally(() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                setTimeout(() => setShowLoading(false), 10)
                DeviceEventEmitter.emit('LoginState', 'LOGGED_IN')
            })
        }, (e: any) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
            setShowLoading(false)
            if (isBARSError(e) && e.message.includes("Не удалось войти с использованием двухфакторной аутентификации")) {
                Alert.alert('Ошибка!', e.message)
                props.onBack()
            } else {
                Alert.alert('Ошибка!', isBARSError(e) ? e.message : e.toString())
                DeviceEventEmitter.emit('LoginState', 'NOT_LOGGED_IN' as LoginState)
            }
        }), 250)
    }

    if (showLoading) return <LoadingScreen/>
    if (showingHelp) return <Help onBack={shHCb}/>

    return (
        <View style={{width: '90%', maxWidth: 400, marginTop: '10%'}}>
            <Text style={{
                fontWeight: 'bold',
                fontSize: 20,
                marginBottom: '5%',
                color: withOpacity(colors.text, 90),
                textAlign: 'center'
            }}>
                Двухфакторная аутентификация
            </Text>
            <TextInput
                onChangeText={t => setCode(t)}
                value={code}
                textColor={colors.text}
                placeholder={'Код подтверждения'}
                keyboardType={'number-pad'}
                placeholderTextColor={withOpacity(colors.text, 40)}
                underlineColor={colors.text}
                activeUnderlineColor={colors.textUnderline}
                style={{backgroundColor: colors.background, borderRadius: 0}}
                theme={{colors}}
            />
            <View style={{height: '7%'}}/>
            <View style={{marginBottom: '4%', flexDirection: 'row', width: '90%', alignSelf: 'center', justifyContent: 'space-between'}}>
                <View style={{ flexDirection: 'column',  width: '66%', alignSelf: 'flex-start', alignItems: 'flex-start'}}>
                    <Button title={'Войти'} onPress={handleLogin} style={{ width: '100%', aspectRatio: 4.8, marginVertical: '5%' }}/>
                    <Button title={'Назад'} onPress={props.onBack} style={{ width: '66%', aspectRatio: 4.8, marginVertical: '5%' }}/>
                </View>
                <Button icon={'question'} onPress={shHCb} style={{alignSelf: 'flex-start', width: '20%', aspectRatio: 1, marginVertical: '3%'}}/>
            </View>
        </View>
    )
}

export default AF2Screen;
