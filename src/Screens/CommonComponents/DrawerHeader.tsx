import React from "react";
import {Platform, Text, TouchableOpacity, View} from "react-native";
import * as Icon from "react-native-vector-icons/FontAwesome";
import {useTheme} from "react-native-paper";
import * as MtIcons from "react-native-vector-icons/MaterialIcons";

const DrawerHeader: React.FC<{navigation: any, title: string}> = (props) => {
    const {colors} = useTheme()
    return (
        <View style={{shadowOpacity: .4, shadowColor: '#00000040', shadowOffset: {height: 4, width: 0}, width: '100%', height: Platform.OS == 'android' ? '10%' : '5%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backdrop}}>
            <TouchableOpacity onPress={props.navigation.openDrawer}
                              style={{position: 'absolute', alignSelf: 'center', left: 10}}>
                <Icon.default name={'bars'} size={25} adjustsFontSizeToFit color={colors.text}/>
            </TouchableOpacity>
            <Text style={{alignSelf: 'center', fontWeight: '600', textAlign: 'center',  fontSize: 20, color: colors.text}}>{props.title}</Text>
        </View>
    )
}

export const NavigationHeader: React.FC<{navigation: any, title: string, beforeGoBack?: ()=>void, backable?: boolean, }> = (props) => {
    const {colors} = useTheme()
    const backable = typeof props.backable != 'undefined' && props.backable
    return (
        <View style={{shadowOpacity: .4, shadowColor: '#00000040', shadowOffset: {height: 4, width: 0}, width: '100%', height: Platform.OS == 'android' ? '10%' : '5%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backdrop}}>
            {backable &&
                <TouchableOpacity onPress={()=>{
                    if(typeof props.beforeGoBack != 'undefined') props.beforeGoBack()
                    else props.navigation.goBack()

                }} style={{height: '100%', zIndex: 10, position: 'absolute', left: 0}}>
                    <MtIcons.default size={40} color={colors.text} name={'navigate-before'} adjustsFontSizeToFit/>
                </TouchableOpacity>}
            <View style={{flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center'}}>
                <Text adjustsFontSizeToFit numberOfLines={2} style={{alignSelf: 'center', fontWeight: '600', width: '80%', textAlign: 'center',  fontSize: 20, color: colors.text}}>{props.title}</Text>
            </View>
        </View>
    )
}
export default DrawerHeader
