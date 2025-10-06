import React, {Fragment} from "react";
import {View, Text} from "react-native";
import {useTheme} from "react-native-paper";
import {CustomTheme} from "../../Themes/Themes.ts";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const Holidays: React.FC = () => {
  const {colors} = useTheme<CustomTheme>()
  const insets = useSafeAreaInsets();
  return(
    <Fragment>
      <SafeAreaView style={{flex: 1, paddingTop: insets.top, backgroundColor: colors.background}}>
        <View style={{width: '100%', flex:1,justifyContent: "center",alignItems: "center"}}>
          <Text style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>Каникулы!</Text>
          <Text style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>Наслаждайся отдыхом...</Text>
          <Text style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>Или займись чем-нибудь.</Text>
        </View>
      </SafeAreaView>
    </Fragment>
  )
}


export default Holidays
