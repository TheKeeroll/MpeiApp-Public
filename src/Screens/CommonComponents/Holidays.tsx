import React from "react";
import {View, Text} from "react-native";
import {useTheme} from "react-native-paper";
import {CustomTheme} from "../../Themes/Themes.ts";

const Holidays: React.FC = () => {
  const {colors} = useTheme<CustomTheme>()
  return(
    <View style={{width: '100%', flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background}}>
      <Text style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>Каникулы!</Text>
      <Text style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>Наслаждайся отдыхом...</Text>
      <Text style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>Или займись чем-нибудь.</Text>
    </View>
  )
}


export default Holidays
