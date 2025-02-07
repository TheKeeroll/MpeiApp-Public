import React, {Fragment, useState} from "react";
import {useTheme} from "react-native-paper";
import {
    Alert,
    Linking,
    SafeAreaView,
    ScrollView,
    View
} from "react-native";
import {NavigationHeader} from "../CommonComponents/DrawerHeader"
import * as IonIcon from 'react-native-vector-icons/Ionicons'
import * as EnIcon from 'react-native-vector-icons/Entypo'
import * as MtIcon from 'react-native-vector-icons/MaterialIcons'
import * as McIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import * as FaIcon from 'react-native-vector-icons/FontAwesome'
import {
    ListButton,
    IconSelector,
    ListSeparator,
    ListSwitch,
    ListText,
    openSupportChat,
    QRFrameSelector,
} from "./Components";
import {withOpacity} from "../../Themes/Themes"
import BARSAPI from "../../Common/Globals"
import {APP_CONFIG} from "../../Common/Config"

const SettingsScreen: React.FC<{navigation: any, route: any}> = (props) => {
    const {colors, dark} = useTheme()
    const [isDark, setDark] = useState(dark)

    const onThemeChange = (value: boolean) => {
        setDark(p=>!p)
        BARSAPI.SetTheme(value ? 'dark' : 'light')
    }

    return (
        <Fragment>
            <SafeAreaView style={{flex:0, backgroundColor: colors.backdrop}}/>
            <SafeAreaView style={[{alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}]}>
                <NavigationHeader {...props} title={'Настройки'}/>
                <ScrollView style={{width: '90%'}}>
                    <ListSeparator title={'Оформление'}/>
                    <ListSwitch icon={
                        <McIcon.default name={'theme-light-dark'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', color: withOpacity(colors.text, 80)}}/>
                    } title={'Тема'} value={isDark} onPress={onThemeChange.bind(this)}/>
                    <IconSelector items={[]}
                        icon={
                            <IonIcon.default name={'image'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', color: withOpacity(colors.text, 80)}}/>
                        } title={'Иконка'}
                    />
                    <QRFrameSelector items={[]}
                        frame={
                            <IonIcon.default name={'scan'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', color: withOpacity(colors.text, 80)}}/>
                        } title={'QR-Сканер'}
                    />
                    <ListSeparator title={'Прочее'}/>
                    <ListButton icon={
                        <EnIcon.default name={'new'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center',color: withOpacity(colors.text, 80)}}/>
                    }
                                title={'Что нового ?'} onPress={()=>props.navigation.navigate('whatsNew')}/>
                    <ListButton icon={
                        <MtIcon.default name={'developer-mode'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center',color: withOpacity(colors.text, 80)}}/>
                    }
                        title={'Разработчики'} onPress={()=>props.navigation.navigate('devs')}/>
                    <ListButton icon={
                        <McIcon.default name={'robot-love'} adjustsFontSizeToFit size={30} style={{alignSelf: 'center',color: withOpacity(colors.text, 80)}}/>
                    }
                                title={'Спасибо'} onPress={()=>props.navigation.navigate('gratuities')}/>
                    <ListButton icon={
                        <FaIcon.default name={'support'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center',color: withOpacity(colors.text, 80)}}/>
                    }
                                title={'Поддержка'} onPress={openSupportChat}/>
                    {__DEV__ &&
                    <Fragment>
                        <ListSeparator title={'Debug'}/>
                        <ListButton
                            icon={<></>}
                            title={'Clear storage'}
                            onPress={()=> {
                                BARSAPI.ClearStorage()
                                Alert.alert("Clear storage", 'Done!')
                            }
                        }/>
                        <ListButton
                            icon={<></>}
                            title={'App config'}
                            onPress={()=> {
                                Alert.alert("App config", JSON.stringify(APP_CONFIG))
                            }
                            }/>
                        <ListButton
                            icon={<></>}
                            title={'Test screen'}
                            onPress={()=> {
                                props.navigation.navigate('test')
                            }
                            }/>
                    </Fragment>
                    }
                    <View style={{width: '100%', alignItems: 'center', marginTop: 20}}>
                        <ListText textStyle={{color: colors.textUnderline}} onPress={()=>Linking.openURL('https://yandex.ru/legal/maps_termsofuse')} title={'Лицензионное соглашение\n сервиса Яндекс.Карты'}/>
                        <ListText title={''}/>
                        <ListText title={'MpeiApp'} textStyle={{fontSize: 18, opacity: .5}}/>
                        <ListText title={require('../../../package.json').version + (__DEV__ ? ' DEBUG' : '')} textStyle={{fontSize: 14, opacity: .5}}/>
                        <ListText textStyle={{color: colors.textUnderline}} onPress={()=>Linking.openURL('https://github.com/TheKeeroll/MpeiApp-Public')} title={'Проект на GitHub'}/>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </Fragment>
    )
}

export default SettingsScreen
