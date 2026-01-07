import {
    Alert,
    DeviceEventEmitter,
    LayoutAnimation,
    Text,
    View,
} from "react-native";
import React, {useState} from "react";
import BARSAPI from "../../Common/Globals";
import {LoginState} from "../../API/BARS";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import {TextInput, useTheme} from "react-native-paper";
import {withOpacity, CustomTheme} from "../../Themes/Themes";
import {isBARSError} from "../../API/Error/Error";
import {Button} from "./LoginScreen";

interface AF2ScreenProps {
    onBack: () => void;
}

const AF2Screen: React.FC<AF2ScreenProps> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const [code, setCode] = useState('')
    const [showLoading, setShowLoading] = useState(false)

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
        }), 900)
    }

    if (showLoading) return <LoadingScreen/>

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
            </View>
        </View>
    )
}

export default AF2Screen;
