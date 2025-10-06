import React, {Fragment} from "react";
import {Text} from "react-native";
import {useTheme} from "react-native-paper";
import {CustomTheme} from "../../Themes/Themes.ts";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const SkippedClassesNotFound: React.FC = () => {
  const {colors} = useTheme<CustomTheme>()
  const insets = useSafeAreaInsets();
  return(
    <Fragment>
      <SafeAreaView style={{flex: 1, paddingTop: insets.top,  backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'}}>
        <Text numberOfLines={2} adjustsFontSizeToFit style={{color: colors.text, fontSize: 20, fontWeight: '700'}}>Пропуски занятий не обнаружены.</Text>
      </SafeAreaView>
    </Fragment>
  )
}

export default SkippedClassesNotFound
