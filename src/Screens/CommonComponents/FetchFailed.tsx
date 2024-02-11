import React, {Fragment} from "react";
import {SafeAreaView, Text} from "react-native";
import {useTheme} from "react-native-paper";

const FetchFailed: React.FC = () => {
    const {colors} = useTheme()
    return(
        <Fragment>
            <SafeAreaView style={{flex: 0, backgroundColor: colors.background}}/>
            <SafeAreaView style={{flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'}}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>Не удалось обработать ответ БАРС!</Text>
            </SafeAreaView>
        </Fragment>
    )
}


export default FetchFailed
