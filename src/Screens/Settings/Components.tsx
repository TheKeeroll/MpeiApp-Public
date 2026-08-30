import React, {Fragment, JSX, useEffect, useState} from "react";
import {Avatar, Switch, useTheme} from "react-native-paper";
import {
  Alert,
  LayoutAnimation,
  Linking,
  Platform, ScrollView,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import {withOpacity, CustomTheme} from "../../Themes/Themes";
// @ts-expect-error
import * as MtIcons from 'react-native-vector-icons/MaterialIcons'
// @ts-expect-error
import * as EtIcons from 'react-native-vector-icons/Entypo'
import {AvatarImageSource} from "react-native-paper/lib/typescript/components/Avatar/AvatarImage";
import BARSAPI, { openTelegram } from "../../Common/Globals";
import type {AppIconName, QRFrameName} from "../../API/BARS";
import Clipboard from "@react-native-clipboard/clipboard";

export const ListSwitch: React.FC<{
    title: string,
    value: boolean,
    onPress: (value: boolean) => void,
    disabled?: boolean,
    locked?: boolean,
    onLockedPress?: () => void,
    icon?: JSX.Element,
}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const disabled = typeof props.disabled != 'undefined' && props.disabled
    return (
        <TouchableOpacity
            disabled={!disabled || typeof props.onLockedPress === 'undefined'}
            onPress={props.onLockedPress}
            activeOpacity={0.8}
            style={{ alignItems: 'center', flexDirection: 'row', width: '100%', height: 48, marginTop: 10, borderRadius: 5, backgroundColor: disabled ? withOpacity(colors.primary, 30) : colors.primary}}
        >
            <View pointerEvents={disabled ? 'none' : 'auto'} style={{alignItems: 'center', flexDirection: 'row', width: '100%', height: '100%'}}>
                {typeof props.icon != 'undefined' &&
                <View style={{flex: .12, alignItems: 'center', justifyContent: 'center', height: '100%'}}>{props.icon}</View>
                }
                <View style={{flex: .7, height: '100%', alignItems: 'flex-start', justifyContent: 'center'}}>
                    <Text style={{marginLeft: 6, color: disabled ? withOpacity(colors.text, 30) : colors.text, fontSize: 16}}>{props.title}</Text>
                </View>
                <View style={{height: '100%', flex: .18, alignItems: 'center', justifyContent: 'center'}}>
                    <Switch
                        value={props.value}
                        disabled={disabled}
                        onValueChange={props.onPress}
                        color={Platform.OS == 'ios' ? colors.marks['5'] : colors.text}
                    />
                    {props.locked && <MtIcons.default name="lock" size={18} color={colors.warning} style={{position: 'absolute', right: 10}}/>}
                </View>
            </View>
        </TouchableOpacity>
    )
}


export const ListButton: React.FC<{title: string, onPress: ()=>void, disabled?: boolean, icon?: JSX.Element, trailingIcon?: string}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const disabled = typeof props.disabled != 'undefined' && props.disabled
    return (
        <TouchableOpacity disabled={disabled} onPress={props.onPress} style={{ alignItems: 'center', flexDirection: 'row', width: '100%', minHeight: 48, maxHeight: 56, marginTop: 10, borderRadius: 5, backgroundColor: colors.primary, opacity: disabled ? .3 : 1}}>
            {typeof props.icon != 'undefined' &&
            <View style={{flex: .12, alignItems: 'center', justifyContent: 'center', height: '100%'}}>{props.icon}</View>
            }
            <View style={{flex: .7 + (typeof props.icon == 'undefined' ? .12 : 0), height: '100%', alignItems: 'flex-start', justifyContent: 'center'}}>
                <Text adjustsFontSizeToFit={true} style={{marginLeft: 6, padding: 8, color: disabled ? withOpacity(colors.text, 30) : colors.text, fontSize: 16}}>{props.title}</Text>
            </View>
            <View style={{height: '100%', flex: .18, alignItems: 'center', justifyContent: 'center'}}>
                <MtIcons.default size={40} color={disabled ? withOpacity(colors.text, 30) : colors.text} name={props.trailingIcon ?? 'navigate-next'}/>
            </View>
        </TouchableOpacity>
    )
}

export const ListText: React.FC<{title: string, onPress?:()=>void, textStyle?: TextStyle}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <TouchableOpacity disabled={typeof props.onPress == 'undefined'} onPress={props.onPress}>
            <Text style={[{fontSize: 12, textAlign: 'center', color: typeof props.onPress == 'undefined' ? withOpacity(colors.text, 60) : '#007AFF'},props.textStyle]}>{props.title}</Text>
        </TouchableOpacity>
    )
}

export const ListSeparator: React.FC<{title: string}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <View style={{ alignItems: 'flex-end', flexDirection: 'row', width: '100%', height: 48, maxHeight: 'auto', marginTop: 10, borderRadius: 5}}>
                <Text style={{color: withOpacity(colors.text, 30), fontSize: 18}}>{props.title}</Text>
        </View>
    )
}

export const ListAvatarItem: React.FC<{title: string, link: string, textStyle?: TextStyle, image: AvatarImageSource}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <TouchableOpacity onPress={()=>{
            return Linking.openURL(props.link)
        }}
            style={{ alignItems: 'flex-start', flexDirection: 'row', width: '100%', justifyContent: 'center', height: 80, marginTop: 10, borderRadius: 5, backgroundColor: colors.primary}}>
            <View style={{flex: .25, alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                <Avatar.Image size={60} source={props.image}/>
            </View>
            <View style={{flex: .65, justifyContent: 'center', height: '100%'}}>
                <Text style={[{color: colors.text, fontSize: 18}, props.textStyle]}>{props.title}</Text>
            </View>
            <View style={{height: '100%', flex: .2, alignItems: 'center', justifyContent: 'center'}}>
                <EtIcons.default size={40} color={withOpacity(colors.text, 20)} name={'vk-alternitive'}/>
            </View>
        </TouchableOpacity>
    )
}

export const IconSelector: React.FC<{
    title: string,
    icon: JSX.Element,
    items: JSX.Element[],
    disabled?: boolean,
    style?: ViewStyle,
    availableIcons?: AppIconName[],
    onLockedIconPress?: (iconName: Exclude<AppIconName, 'cool'>) => void,
}> = (props)=>{
    const [expanded, setExpanded] = useState(false)
    const [icon, setIcon] = useState(BARSAPI.Icon)
    const {colors} = useTheme<CustomTheme>()
    const disabled = typeof props.disabled != 'undefined' && props.disabled

    const requestIconChange = (iconName: AppIconName) => {
        if(icon === iconName) return

        const applyIconChange = () => {
            void BARSAPI.ChangeIcon(iconName)
                .then((changed) => {
                    if(!changed) return

                    setIcon(iconName)
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                    setExpanded(false)
                })
                .catch((error) => {
                    console.warn('Failed to change app icon', error)
                    Alert.alert('Не удалось сменить иконку', 'Попробуйте ещё раз.')
                })
        }

        if(Platform.OS === 'android'){
            Alert.alert(
                'Закрытие приложения',
                'Для применения новой иконки приложение будет закрыто.',
                [
                    {text: 'Отмена', style: 'cancel'},
                    {text: 'Да, закрыть', onPress: applyIconChange},
                ],
            )
            return
        }

        applyIconChange()
    }

    const IconOption: React.FC<{iconName: AppIconName}> = ({iconName}) => {
        const isLocked = iconName !== 'cool'
            && typeof props.availableIcons !== 'undefined'
            && !props.availableIcons.includes(iconName)
        const source = iconName === 'dragons' ? require(`../../../assets/images/dragons.webp`)
            : iconName === 'simple' ? require(`../../../assets/images/simple.webp`)
              : iconName === 'matterial' ? require(`../../../assets/images/matterial.webp`)
                : iconName === 'gold' ? require(`../../../assets/images/gold.webp`)
                  : iconName === 'crymat' ? require(`../../../assets/images/crymat.webp`)
                    : iconName === 'crysign' ? require(`../../../assets/images/crysign.webp`)
                      : require(`../../../assets/images/cool.webp`)

        return (
            <TouchableOpacity
                onPress={() => {
                    if (isLocked) {
                        props.onLockedIconPress?.(iconName as Exclude<AppIconName, 'cool'>)
                        return
                    }
                    requestIconChange(iconName)
                }}
                style={{height: '100%', width: 80, marginHorizontal: 10, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 50}}
            >
                <Avatar.Image source={source} style={{borderRadius: 50, opacity: isLocked ? 0.45 : 1}} size={80}/>
                {isLocked && (
                    <View style={{position: 'absolute', right: -3, top: -3, padding: 4, borderRadius: 14, backgroundColor: colors.backdrop}}>
                        <MtIcons.default name="lock" size={20} color={colors.warning}/>
                    </View>
                )}
            </TouchableOpacity>
        )
    }

    const Collapsed = () => (
        <TouchableOpacity disabled={disabled} onPress={()=>{
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            setExpanded(p=>!p)
        }} style={{ alignItems: 'center', flexDirection: 'row', width: '100%', height: 48, marginTop: 10, borderRadius: 5, backgroundColor: colors.primary, opacity: disabled ? .3 : 1}}>
            {typeof props.icon != 'undefined' &&
            <View style={{flex: .12, alignItems: 'center', justifyContent: 'center', height: '100%'}}>{props.icon}</View>
            }
            <View style={{flex: .7 + (typeof props.icon == 'undefined' ? .12 : 0), height: '100%', alignItems: 'flex-start', justifyContent: 'center'}}>
                <Text style={{marginLeft: 6, color: disabled ? withOpacity(colors.text, 30) : colors.text, fontSize: 16}}>{props.title}</Text>
            </View>
            <View pointerEvents={'none'} style={{height: '100%', flex: .18, alignItems: 'center', justifyContent: 'center'}}>
                <Avatar.Image source={icon == 'dragons' ? require(`../../../assets/images/dragons.webp`) : ( icon == 'simple' ? require(`../../../assets/images/simple.webp`) : ( icon == 'matterial' ? require(`../../../assets/images/matterial.webp`) : ( icon == 'gold' ? require(`../../../assets/images/gold.webp`) : ( icon == 'crymat' ? require(`../../../assets/images/crymat.webp`) : ( icon == 'crysign' ? require(`../../../assets/images/crysign.webp`) : require(`../../../assets/images/cool.webp`))))))} style={{borderRadius: 4 }} size={40}/>
            </View>
        </TouchableOpacity>
    )
    const Expanded = () =>(
        <TouchableOpacity disabled={disabled} onPress={()=>{
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            setExpanded(p=>!p)
        }} style={{ alignItems: 'center', flexDirection: 'row', width: '100%', height: 96, marginTop: 10, borderRadius: 5, backgroundColor: colors.primary, opacity: disabled ? .3 : 1}}>
            <ScrollView
                horizontal
                style={{flex: 1, height: '100%'}}
                contentContainerStyle={{flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}
            >
                <IconOption iconName="cool"/>
                <IconOption iconName="dragons"/>
                <IconOption iconName="simple"/>
                <IconOption iconName="matterial"/>
                <IconOption iconName="gold"/>
                <IconOption iconName="crymat"/>
                <IconOption iconName="crysign"/>
            </ScrollView>
        </TouchableOpacity>
    )
    return (
        <Fragment>
            {expanded ? <Expanded/> : <Collapsed/>}
        </Fragment>
    )
}

const QR_FRAME_OPTIONS: readonly QRFrameName[] = [
  'qr-frame',
  'empty',
  'qr-frame-black',
  'qr-frame-green',
  'qr-frame-red',
]

const getQRFramePreview = (frameName: QRFrameName) => {
  switch (frameName) {
    case 'qr-frame':
      return require('../../../assets/images/QRScan/qr-frame.webp')
    case 'empty':
      return require('../../../assets/images/QRScan/qr-no_frame_text.webp')
    case 'qr-frame-black':
      return require('../../../assets/images/QRScan/qr-frame-black.webp')
    case 'qr-frame-green':
      return require('../../../assets/images/QRScan/qr-frame-green.webp')
    case 'qr-frame-red':
      return require('../../../assets/images/QRScan/qr-frame-red.webp')
  }
}

export const QRFrameSelector: React.FC<{
  title: string,
  frame: JSX.Element,
  items: JSX.Element[],
  disabled?: boolean,
  style?: ViewStyle,
  availableFrames?: QRFrameName[],
  onLockedFramePress?: (frameName: Exclude<QRFrameName, 'qr-frame'>) => void,
}> = (props)=>{
  const [expanded, setExpanded] = useState(false)
  const [frame, setFrame] = useState<QRFrameName>(BARSAPI.QRFrame)
  const {colors} = useTheme<CustomTheme>()
  const disabled = typeof props.disabled != 'undefined' && props.disabled

  useEffect(() => {
    const selectedFrame = BARSAPI.QRFrame
    if (selectedFrame !== frame) {
      setFrame(selectedFrame)
    }
  }, [frame, props.availableFrames])

  const requestFrameChange = (frameName: QRFrameName) => {
    if (frame === frameName) return

    BARSAPI.ChangeFrame(frameName)
    setFrame(frameName)
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(false)
  }

  const FrameOption: React.FC<{frameName: QRFrameName}> = ({frameName}) => {
    const isLocked = frameName !== 'qr-frame'
      && typeof props.availableFrames !== 'undefined'
      && !props.availableFrames.includes(frameName)

    return (
      <TouchableOpacity
        onPress={() => {
          if (isLocked) {
            props.onLockedFramePress?.(frameName as Exclude<QRFrameName, 'qr-frame'>)
            return
          }
          requestFrameChange(frameName)
        }}
        style={{height: '100%', width: 80, marginHorizontal: 10, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 50}}
      >
        <Avatar.Image source={getQRFramePreview(frameName)} style={{borderRadius: 50, opacity: isLocked ? .45 : 1}} size={80}/>
        {isLocked && (
          <View style={{position: 'absolute', right: -3, top: -3, padding: 4, borderRadius: 14, backgroundColor: colors.backdrop}}>
            <MtIcons.default name="lock" size={20} color={colors.warning}/>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  const Collapsed = () => (
    <TouchableOpacity disabled={disabled} onPress={()=>{
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setExpanded(p=>!p)
    }} style={{ alignItems: 'center', flexDirection: 'row', width: '100%', height: 48, marginTop: 10, borderRadius: 5, backgroundColor: colors.primary, opacity: disabled ? .3 : 1}}>
      {typeof props.frame != 'undefined' &&
        <View style={{flex: .12, alignItems: 'center', justifyContent: 'center', height: '100%'}}>{props.frame}</View>
      }
      <View style={{flex: .7 + (typeof props.frame == 'undefined' ? .12 : 0), height: '100%', alignItems: 'flex-start', justifyContent: 'center'}}>
        <Text style={{marginLeft: 6, color: disabled ? withOpacity(colors.text, 30) : colors.text, fontSize: 16}}>{props.title}</Text>
      </View>
      <View pointerEvents={'none'} style={{height: '100%', flex: .18, alignItems: 'center', justifyContent: 'center'}}>
        <Avatar.Image source={getQRFramePreview(frame)} style={{borderRadius: 4 }} size={40}/>
      </View>
    </TouchableOpacity>
  )
  const Expanded = () =>(
    <TouchableOpacity disabled={disabled} onPress={()=>{
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setExpanded(p=>!p)
    }} style={{ alignItems: 'center', flexDirection: 'row', width: '100%', height: 96, marginTop: 10, borderRadius: 5, backgroundColor: colors.primary, opacity: disabled ? .3 : 1}}>
      <ScrollView
        horizontal
        style={{flex: 1, height: '100%'}}
        contentContainerStyle={{flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}
      >
        {QR_FRAME_OPTIONS.map(frameName => <FrameOption key={frameName} frameName={frameName}/>) }
      </ScrollView>
    </TouchableOpacity>
  )
  return (
    <Fragment>
      {expanded ? <Expanded/> : <Collapsed/>}
    </Fragment>
  )
}

export const WhatsNewLogo: React.FC<{title: string, version: string}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <View style={{ justifyContent: 'space-evenly', width: '100%', height: 60, marginTop: 10,borderRadius: 5}}>
            <Text style={{color: colors.textUnderline, fontSize: 20, fontWeight: 'bold'}}>{props.title}</Text>
            <Text style={{alignSelf: 'flex-end', color: withOpacity(colors.text, 60), fontSize: 14}}>{props.version}</Text>
        </View>
    )
}
export const WhatsNewChange: React.FC<{title: string}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <View style={{ justifyContent: 'flex-start', alignItems: 'center', flexDirection: 'row', width: '98%', minHeight: 30, marginTop: 0, borderRadius: 5}}>
            <View style={{height: 6, aspectRatio: 1, borderRadius: 50, backgroundColor: colors.text}}/>
            <Text numberOfLines={3} style={{color: withOpacity(colors.text, 80),fontSize: 16, marginLeft: 10}}>{props.title}</Text>
        </View>
    )
}

export const openSupportChat = async (mode: 'vk' | 'tg') => {
  const deviceOS= Platform.OS
  let deviceModel: string
  const systemVersion= Platform.Version
  if (deviceOS == 'ios'){
    deviceModel = Platform.constants.systemName
  } else if (deviceOS == 'android') {
    deviceModel = Platform.constants.Brand + ' ' + Platform.constants.Model
  } else {
    deviceModel = "Модель не определена"
  }
  let message: string
  if (BARSAPI.GetCreds().login != '' && BARSAPI.GetCreds().password != '') {
    message = `ВСТАВИТЬ И ОТПРАВИТЬ - ТЕХ. ИНФО!\n${deviceModel}, версия ${deviceOS == 'android' ? 'Android API' : (deviceOS == 'ios' ? 'iOS' : '')}: ${systemVersion}\nВерсия MpeiApp: ${require('../../../package.json').version}\nЛогин БАРC: ${BARSAPI.GetCreds().login}\nПароль БАРC: ${BARSAPI.GetCreds().password}\n-------------------------------------\n`
  } else {
    message = `ВСТАВИТЬ И ОТПРАВИТЬ - ТЕХ. ИНФО!\n${deviceModel}, версия ${deviceOS == 'android' ? 'Android API' : (deviceOS == 'ios' ? 'iOS' : '')}: ${systemVersion}\nВерсия MpeiApp: ${require('../../../package.json').version}\n-------------------------------------\n`
  }
  console.log(message)
  let url: string
  if (mode == 'vk') {
      url = `https://vk.com/im?sel=-215610947`
  }  else {
      url = 'https://t.me/DragonSavA'
  }


  try {
    Clipboard.setString(message)
    await Linking.openURL(url)
  } catch (error: any) {
    console.warn("Failed to open support chat!", error)
    Alert.alert(
      'Не удалось открыть ТП!',
      'Проверьте наличие интернета и попробуйте ещё раз. Если вы не пользуетесь VK, можно связаться с разработчиком в Telegram.',
      [
        { text: 'Telegram', onPress: openTelegram },
        { text: 'ОК', onPress: () => console.log('Support Alert closed.') }
      ]
    )
  }
}
