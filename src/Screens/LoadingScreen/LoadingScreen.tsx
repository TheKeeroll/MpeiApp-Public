import React from "react";
import {ViewStyle} from "react-native";
import LottieView from "lottie-react-native";
import {useTheme} from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {CustomTheme} from "../../Themes/Themes";

const LoadingScreen: React.FC<{style?: ViewStyle}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    return(
        <SafeAreaView style={[{flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom, height: '100%', width: '100%', backgroundColor: colors.background}, props.style]}>
            <LottieView
                loop
                autoPlay
                speed={0.5}
                resizeMode={"center"}
                style={{backgroundColor: colors.textUnderline}}
                source={require('../../../assets/animations/loading.json')}
            />
        </SafeAreaView>
    )
}

export default LoadingScreen
