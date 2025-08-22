import React, {Fragment} from "react";
import {SafeAreaView} from "react-native";
import {Title, useTheme} from "react-native-paper";
import {CustomTheme} from "../../Themes/Themes.ts";

const InDev: React.FC = ()=>{
    const {colors} = useTheme<CustomTheme>()

    return(
        <Fragment>
            <SafeAreaView style={{flex: 0, backgroundColor: colors.background}}/>
            <SafeAreaView style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background}}>
                <Title style={{color: colors.text}}>В разработке</Title>
            </SafeAreaView>
        </Fragment>
    )
}


export default InDev
