import React from "react";
import {Fragment} from "react";
import {useTheme} from "react-native-paper";
import {SafeAreaView, ScrollView} from "react-native";
import {NavigationHeader} from "../CommonComponents/DrawerHeader";
import {ListAvatarItem} from "./Components";

const DevsScreen: React.FC<{navigation: any, route: any}> = (props)=>{
    const {colors} = useTheme()
    return (
        <Fragment>
            <SafeAreaView style={{flex:0, backgroundColor: colors.backdrop}}/>
            <SafeAreaView style={[{alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}]}>
                <NavigationHeader {...props} backable title={'Разработчики'}/>
                <ScrollView style={{width: '90%'}}>
                    <ListAvatarItem title={'TheKeeroll'} link={'https://vk.com/ojevohevcoh'} textStyle={{fontWeight: 'bold'}} image={require('../../../assets/images/DevAvatars/Z.webp')}/>
                    <ListAvatarItem title={'DragonSavA'} link={'https://vk.com/dragonsava'} textStyle={{fontWeight: 'bold', color: colors.accent}} image={require('../../../assets/images/DevAvatars/A.webp')}/>
                </ScrollView>
            </SafeAreaView>
        </Fragment>
    )
}

export default DevsScreen
