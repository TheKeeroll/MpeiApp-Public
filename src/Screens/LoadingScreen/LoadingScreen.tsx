import React from "react";
import {ViewStyle} from "react-native";
import LottieView from "lottie-react-native";
// import { AnimationObject } from "lottie-react-native";
import {useTheme} from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {CustomTheme} from "../../Themes/Themes";

import LoadingAnimation from '../../../assets/animations/loading.json';

/*export const getAnimationKeypaths = (animations: AnimationObject[] | AnimationObject) => {
    let keypaths: Set<string> = new Set();

    if(!Array.isArray(animations)) {
        animations.layers.map((l , i) => keypaths.add(l.nm));
    } else {
        animations.map((a, i) => {
            a.layers.map((l , i) => keypaths.add(l.nm));
        })
    }

    return Array.from(keypaths);
}*/

const LoadingScreen: React.FC<{style?: ViewStyle}> = (props) => {
    const source = LoadingAnimation;
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    return (
        <SafeAreaView
          edges={['left', 'right', 'bottom']}
          style={[
            {
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: insets.bottom,
              backgroundColor: colors.background,
            },
            props.style,
          ]}
        >
            <LottieView
                loop
                autoPlay
                speed={0.66}
                resizeMode="contain"
                /*colorFilters={getAnimationKeypaths(source).map(
                    (path, i) => (
                        console.log(path),
                        {
                            keypath: "Modular_2 (Motion)",
                            color: (i % 2 === 0) ? colors.textUnderline : colors.text
                        }
                    )
                )}*/
                style={{ width: 350, height: 350 }} // Задано явно!
                // source={require('../../../assets/animations/loading.json')}
                source={source}
            />
        </SafeAreaView>
    );
}

export default LoadingScreen
