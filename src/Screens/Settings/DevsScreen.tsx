import React from "react";
import {Fragment} from "react";
import {useTheme} from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {ScrollView, View} from "react-native";
import {NavigationHeader} from "../CommonComponents/DrawerHeader";
import {ListAvatarItem, ListSeparator} from "./Components";
import {CustomTheme} from "../../Themes/Themes"

const DevsScreen: React.FC<{navigation: any, route: any}> = (props)=>{
    const {colors} = useTheme<CustomTheme>()
    return (
      // <SafeAreaView edges={['left', 'right', 'bottom']} style={{flex:1, justifyContent: 'flex-start', backgroundColor: colors.backdrop}}>
      <Fragment>
        <NavigationHeader {...props} backable title={'Разработчики'}/>
          <View style={[{ alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}]}>
              <ScrollView style={{width: '90%'}}>
                  <ListSeparator title={'Оригинальная идея, разработка pre-alpha- и alpha-версий'}/>
                  <ListAvatarItem title={`Захар 'TheKeeroll' Степанов`} link={'https://vk.com/ojevohevcoh'} textStyle={{fontWeight: 'bold', color: colors.text}} image={require('../../../assets/images/DevAvatars/Z.webp')}/>

                  <ListSeparator title={'Действующий разработчик, админ группы ВК, техподдержка'}/>
                  <ListAvatarItem title={`Антон 'DragonSavA' Савенков`} link={'https://vk.com/dragonsava'} textStyle={{fontWeight: 'bold', color: colors.accent}} image={require('../../../assets/images/DevAvatars/A.webp')}/>
              </ScrollView>
          </View>
      </Fragment>
      // </SafeAreaView>
    )
}

export default DevsScreen
