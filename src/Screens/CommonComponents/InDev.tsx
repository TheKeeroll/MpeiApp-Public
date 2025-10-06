import React, {Fragment} from "react";
import {useTheme} from "react-native-paper";
import {CustomTheme} from "../../Themes/Themes.ts";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from "react-native";

const InDev: React.FC = ()=>{
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    return(
        <Fragment>
            <SafeAreaView style={{flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, backgroundColor: colors.background}}>
                <View style={{width: '100%', flex:1,justifyContent: "center",alignItems: "center"}}>
                  <Text style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>В разработке...</Text>
                </View>
            </SafeAreaView>
        </Fragment>
    )
}


export default InDev
