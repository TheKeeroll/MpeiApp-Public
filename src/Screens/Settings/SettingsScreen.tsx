import React, {Fragment, useState} from "react";
import {useTheme} from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Alert,
    Linking, Platform,
    ScrollView, Text, TouchableOpacity,
    View
} from "react-native";
import {NavigationHeader} from "../CommonComponents/DrawerHeader"
// @ts-expect-error
import * as IonIcon from 'react-native-vector-icons/Ionicons'
// @ts-expect-error
import * as EnIcon from 'react-native-vector-icons/Entypo'
// @ts-expect-error
import * as MtIcon from 'react-native-vector-icons/MaterialIcons'
// @ts-expect-error
import * as McIcon from 'react-native-vector-icons/MaterialCommunityIcons'
// @ts-expect-error
import * as FaIcon from 'react-native-vector-icons/FontAwesome'
// @ts-expect-error
import * as FIcon from 'react-native-vector-icons/Fontisto'
import {
    ListButton,
    IconSelector,
    ListSeparator,
    ListSwitch,
    ListText,
    openSupportChat,
    QRFrameSelector,
} from "./Components";
import {withOpacity, CustomTheme} from "../../Themes/Themes"
import BARSAPI from "../../Common/Globals"
import {APP_CONFIG} from "../../Common/Config"
import type {AppIconName, QRFrameName} from "../../API/BARS";
import {
    getIconLoyaltyCatalogItem,
    getLoyaltyCatalogItem,
    getQRFrameLoyaltyCatalogItem,
} from "../../Loyalty/LoyaltyCatalog";
import {showInsufficientTokensAlert} from "../../Loyalty/LoyaltyAlerts";
import {useLoyalty} from "../../Loyalty/LoyaltyProvider";

const SettingsScreen: React.FC<{navigation: any, route: any}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const {dark} = useTheme()
    const [isDark, setDark] = useState(dark)
    const [isMonetizationExplanationVisible, setMonetizationExplanationVisible] = useState(false)
    const {canUseIcon, canUseLightTheme, canUseQRFrame, state} = useLoyalty()
    const allIcons: AppIconName[] = ['cool', 'dragons', 'simple', 'matterial', 'gold', 'crymat', 'crysign']
    const allQRFrames: QRFrameName[] = ['qr-frame', 'empty', 'qr-frame-black', 'qr-frame-green', 'qr-frame-red']
    const availableIcons = allIcons.filter(canUseIcon)
    const availableQRFrames = allQRFrames.filter(canUseQRFrame)

    React.useEffect(() => {
        setDark(dark)
    }, [dark])

    const onThemeChange = (value: boolean) => {
        if (!value && !canUseLightTheme) return
        setDark(value)
        BARSAPI.SetTheme(value ? 'dark' : 'light')
    }

    const onLockedThemePress = () => {
        const item = getLoyaltyCatalogItem('light-theme')
        if (state.balance < item.price) {
            showInsufficientTokensAlert(item.title, item.price)
            return
        }

        Alert.alert('Тема заблокирована', `Откройте «${item.title}» за ${item.price} токенов на экране «Лояльность».`)
    }

    const onLockedIconPress = (iconName: Exclude<AppIconName, 'cool'>) => {
        const item = getIconLoyaltyCatalogItem(iconName)
        if (state.balance < item.price) {
            showInsufficientTokensAlert(item.title, item.price)
            return
        }

        Alert.alert('Иконка заблокирована', `Откройте «${item.title}» за ${item.price} токенов на экране «Лояльность».`)
    }

    const onLockedQRFramePress = (frameName: Exclude<QRFrameName, 'qr-frame'>) => {
        const item = getQRFrameLoyaltyCatalogItem(frameName)
        if (state.balance < item.price) {
            showInsufficientTokensAlert(item.title, item.price)
            return
        }

        Alert.alert('Рамка заблокирована', `Откройте «${item.title}» за ${item.price} токенов на экране «Лояльность».`)
    }
    return (
      // <SafeAreaView edges={['left', 'right', 'bottom']} style={{flex:1, justifyContent: 'flex-start', backgroundColor: colors.backdrop}}>
      <Fragment>
            <View style={[{ alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}]}>
                <NavigationHeader {...props} title={'Прочее'}/>
                <ScrollView style={{width: '90%'}}>
                    <ListSeparator title={'Оформление'}/>
                    <ListSwitch icon={
                        <McIcon.default name={'theme-light-dark'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', color: withOpacity(colors.text, 80)}}/>
                    } title={'Тема'} value={isDark} disabled={!canUseLightTheme} locked={!canUseLightTheme} onLockedPress={onLockedThemePress} onPress={onThemeChange}/>
                    <IconSelector items={[]} availableIcons={availableIcons} onLockedIconPress={onLockedIconPress}
                        icon={
                            <IonIcon.default name={'image'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', color: withOpacity(colors.text, 80)}}/>
                        } title={'Иконка'}
                    />
                    <QRFrameSelector items={[]} availableFrames={availableQRFrames} onLockedFramePress={onLockedQRFramePress}
                        frame={
                            <IonIcon.default name={'scan'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', color: withOpacity(colors.text, 80)}}/>
                        } title={'QR-Сканер'}
                    />
                    <ListSeparator title={'Разное'}/>
                    <ListButton icon={
                        <MtIcon.default name={'loyalty'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center',color: withOpacity(colors.text, 80)}}/>
                    }
                                title={'Лояльность'} onPress={()=>props.navigation.navigate('loyalty')}/>
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
                                title={'Благодарности'} onPress={()=>props.navigation.navigate('gratuities')}/>
                    <ListButton
                        icon={
                            <MtIcon.default name={'help-outline'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', color: withOpacity(colors.text, 80)}}/>
                        }
                        title={'Почему появилась реклама и токены?'}
                        trailingIcon={isMonetizationExplanationVisible ? 'expand-less' : 'expand-more'}
                        onPress={() => setMonetizationExplanationVisible(visible => !visible)}
                    />
                    {isMonetizationExplanationVisible &&
                        <View style={{width: '100%', marginTop: 10, padding: 14, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 1, borderColor: withOpacity(colors.text, 15)}}>
                            <Text style={{color: colors.text, fontSize: 17, fontWeight: 'bold'}}>Независимый проект</Text>
                            <Text style={{color: withOpacity(colors.text, 85), fontSize: 15, lineHeight: 21, marginTop: 6}}>MpeiApp — неофициальное приложение. Переговоры с представителями МЭИ неоднократно начинались, но не привели к совместной работе: университет никогда не оказывал проекту финансовой или иной поддержки.</Text>

                            <Text style={{color: colors.text, fontSize: 17, fontWeight: 'bold', marginTop: 14}}>Поддерживать стало сложнее</Text>
                            <Text style={{color: withOpacity(colors.text, 85), fontSize: 15, lineHeight: 21, marginTop: 6}}>Разработчик уже давно не является студентом МЭИ. Личный аккаунт БАРС больше недоступен, поэтому об изменениях БАРС и других связанных систем иногда удаётся узнать не сразу — даже если их нужно отразить в приложении.</Text>

                            <Text style={{color: colors.text, fontSize: 17, fontWeight: 'bold', marginTop: 14}}>Как это поможет приложению</Text>
                            <Text style={{color: withOpacity(colors.text, 85), fontSize: 15, lineHeight: 21, marginTop: 6}}>Полностью некоммерческий статус не позволял компенсировать расходы и усилия на поддержку, включая ежегодную оплату Apple Developer, чтобы MpeiApp оставался доступен в App Store. Реклама и будущая интеграция с другими проектами разработчика помогут покрывать эти затраты и сохранять бесплатную доступность приложения в магазинах.</Text>
                        </View>
                    }
                    <ListSeparator title={'Поддержка'}/>
                    <ListButton icon={
                        <FaIcon.default name={'vk'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center',color: withOpacity(colors.text, 80)}}/>
                    }
                                title={'ЛС ВК-сообщества приложения'} onPress={() => openSupportChat("vk")}/>
                    <ListButton icon={
                        <FaIcon.default name={'telegram'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center',color: withOpacity(colors.text, 80)}}/>
                    }
                                title={'ЛС разработчика в Telegram'} onPress={() => openSupportChat("tg")}/>
                    <ListSeparator title={'Оставить оценку/отзыв'}/>
                    {Platform.OS === 'android' && <ListButton icon={
                        <EnIcon.default name={'google-play'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center',color: withOpacity(colors.text, 80)}}/>
                    }
                                title={'Страница приложения в Google Play'} onPress={()=>Linking.openURL('https://play.google.com/store/apps/details?id=com.mpeiapp')}/>
                    }
                    {Platform.OS === 'ios' && <ListButton icon={
                        <FIcon.default name={'app-store'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center',color: withOpacity(colors.text, 80)}}/>
                    }
                                title={'Страница приложения в App Store'} onPress={()=>Linking.openURL('https://apps.apple.com/ru/app/mpeiapp/id1618910681')}/>
                    }
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
                    <View style={{width: '100%', flexDirection: 'column', alignItems: 'center', marginTop: 20}}>
                        <ListText title={''}/>
                        <ListText title={'MpeiApp'} textStyle={{color: colors.text, fontWeight: 'bold', fontSize: 18, opacity: .5}}/>
                        <ListText title={require('../../../package.json').version + (__DEV__ ? ' DEBUG' : '')} textStyle={{color: colors.text, fontSize: 14, opacity: .5}}/>
                        <ListText title={''}/>
                        <View style={{width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: "flex-start", marginVertical: 8}}>
                            <View style={{width: '50%', flexDirection: 'column', alignItems: 'center'}}>
                                <TouchableOpacity onPress={()=>Linking.openURL('https://yandex.ru/legal/maps_api/')}>
                                    <FIcon.default name={'yandex'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center',color: colors.textUnderline}}/>
                                    <ListText textStyle={{color: colors.textUnderline}} title={'Условия использования\nотдельных сервисов «Яндекс.Карт»'}/>
                                </TouchableOpacity>
                            </View>
                            <View style={{width: '50%', flexDirection: 'column', alignItems: 'center', marginTop: -14, justifyContent: 'flex-start'}}>
                                <TouchableOpacity onPress={()=>Linking.openURL('https://github.com/TheKeeroll/MpeiApp-Public')}>
                                    <FIcon.default name={'github'} adjustsFontSizeToFit size={25} style={{alignSelf: 'center', justifySelf: 'flex-start', color: colors.textUnderline}}/>
                                    <ListText textStyle={{color: colors.textUnderline, marginBottom: 16}} title={'Проект на GitHub'}/>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
      </Fragment>
      // </SafeAreaView>
    )
}

export default SettingsScreen
