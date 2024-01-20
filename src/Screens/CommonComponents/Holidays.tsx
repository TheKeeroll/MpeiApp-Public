import React, {Fragment} from "react";
import {SafeAreaView, View, Text} from "react-native";
import {useTheme} from "react-native-paper";

const Holidays: React.FC = () => {
  const {colors} = useTheme()
  return(
    <Fragment>
      <SafeAreaView style={{flex: 0, backgroundColor: colors.background}}/>
      <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
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
