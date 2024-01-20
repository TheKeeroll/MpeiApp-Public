import React from "react";
import {View, ViewStyle} from "react-native";
import LottieView from "lottie-react-native";
import {useTheme} from "react-native-paper";

const LoadingScreen: React.FC<{style?: ViewStyle}> = (props) => {
    const {colors} = useTheme()
    return(
        <View style={[{alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%'}, props.style]}>
            <LottieView
                loop
                autoPlay
                speed={0.2}
                style={{backgroundColor: colors.background}}
                source={require('../../../assets/animations/loading.json')}/>
        </View>
    )
}

export default LoadingScreen
