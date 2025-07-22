import React from "react";
import {Platform, Text, TouchableOpacity, View} from "react-native";
// @ts-ignore
import * as Icon from "react-native-vector-icons/FontAwesome";
import {useTheme} from "react-native-paper";
import {CustomTheme} from "../../Themes/Themes";
// @ts-ignore
import * as MtIcons from "react-native-vector-icons/MaterialIcons";
import {useSafeAreaInsets} from "react-native-safe-area-context";

const DrawerHeader: React.FC<{ navigation: any; title: string }> = ({ navigation, title }) => {
    const { colors } = useTheme<CustomTheme>();
    const insets = useSafeAreaInsets();

    return (
        <View
            style={{
                paddingTop: insets.top,
                height: insets.top + 56, // стандартная высота тулбара
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.backdrop,
                shadowOpacity: 0.4,
                shadowColor: '#00000040',
                shadowOffset: { height: 4, width: 0 },
                zIndex: 10,
            }}
        >
            <TouchableOpacity
                onPress={navigation.openDrawer}
                style={{
                    position: 'absolute',
                    left: 10,
                    top: insets.top + 8, // немного ниже от верхней грани
                }}
            >
                <Icon.default name={'bars'} size={25} color={colors.text} />
            </TouchableOpacity>
            <Text
                style={{
                    fontWeight: '600',
                    textAlign: 'center',
                    fontSize: 20,
                    color: colors.text,
                }}
            >
                {title}
            </Text>
        </View>
    );
};

export const NavigationHeader: React.FC<{navigation: any, title: string, beforeGoBack?: ()=>void, backable?: boolean, }> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    const backable = typeof props.backable != 'undefined' && props.backable
    return (
        <View style={{shadowOpacity: .4, shadowColor: '#00000040', shadowOffset: {height: 4, width: 0}, width: '100%', height: Platform.OS == 'android' ? '10%' : '5%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backdrop}}>
            {backable &&
                <TouchableOpacity onPress={()=>{
                    if(typeof props.beforeGoBack != 'undefined') props.beforeGoBack()
                    else props.navigation.goBack()

                }} style={{height: '100%', zIndex: 10, position: 'absolute', top: 20, left: 0}}>
                    <MtIcons.default size={40} color={colors.text} name={'navigate-before'} adjustsFontSizeToFit/>
                </TouchableOpacity>}
            <View style={{flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center'}}>
                <Text adjustsFontSizeToFit numberOfLines={2} style={{alignSelf: 'center', fontWeight: '600', width: '80%', textAlign: 'center',  fontSize: 20, color: colors.text}}>{props.title}</Text>
            </View>
        </View>
    )
}
export default DrawerHeader
