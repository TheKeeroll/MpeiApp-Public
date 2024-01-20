import React, {Fragment} from "react";
import {SafeAreaView, Text} from "react-native";
import {useTheme} from "react-native-paper";

const SkippedClassesNotFound: React.FC = () => {
  const {colors} = useTheme()
  return(
    <Fragment>
      <SafeAreaView style={{flex: 0, backgroundColor: colors.background}}/>
      <SafeAreaView style={{flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'}}>
        <Text numberOfLines={2} adjustsFontSizeToFit style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>Пропуски занятий не обнаружены.</Text>
      </SafeAreaView>
    </Fragment>
  )
}

export default SkippedClassesNotFound
