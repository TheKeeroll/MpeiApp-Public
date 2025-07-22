import React from "react";
import {Fragment} from "react";
import {useTheme} from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {ScrollView, View} from "react-native";
import {NavigationHeader} from "../CommonComponents/DrawerHeader";
import {ListAvatarItem, ListSeparator} from "./Components";
import {withOpacity, CustomTheme} from "../../Themes/Themes"

const DevsScreen: React.FC<{navigation: any, route: any}> = (props)=>{
    const {colors} = useTheme<CustomTheme>()
    return (
        <Fragment>
            <SafeAreaView style={{flex:0, paddingTop: -100, backgroundColor: colors.backdrop}}/>
            <View style={[{ alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}]}>
                <NavigationHeader {...props} backable title={'Разработчики'}/>
                <ScrollView style={{width: '90%'}}>
                    <ListSeparator title={'Оригинальная идея, разработка архитектуры, pre-alpha- и alpha-версий'}/>
                    <ListAvatarItem title={`Захар 'TheKeeroll' Степанов`} link={'https://vk.com/ojevohevcoh'} textStyle={{fontWeight: 'bold', color: colors.text}} image={require('../../../assets/images/DevAvatars/Z.webp')}/>

                    <ListSeparator title={'Единственный активный разработчик, админ ВК-сообщества, техподдержка'}/>
                    <ListAvatarItem title={`Антон 'DragonSavA' Савенков`} link={'https://vk.com/dragonsava'} textStyle={{fontWeight: 'bold', color: colors.accent}} image={require('../../../assets/images/DevAvatars/A.webp')}/>
                </ScrollView>
            </View>
        </Fragment>
    )
}

export default DevsScreen
