import React from "react";
import {Animated, Text, View, ViewStyle} from "react-native";
import LottieView from "lottie-react-native";
// import { AnimationObject } from "lottie-react-native";
import {useTheme} from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {CustomTheme} from "../../Themes/Themes";
import {AD_PLACEMENTS} from "../../Ads/AdsProvider";
import StickyBannerSlot from "../../Ads/StickyBannerSlot";
import {
    loadingProgressService,
    type LoadingProgressSnapshot,
} from "../../Loading/LoadingProgressService";

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

type LoadingScreenProps = {
    style?: ViewStyle;
    showStickyAd?: boolean;
    progressKey?: string;
    fallbackLabel?: string;
};

const EMPTY_PROGRESS: LoadingProgressSnapshot = {};

const LoadingScreen: React.FC<LoadingScreenProps> = (props) => {
    const source = LoadingAnimation;
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    const [progress, setProgress] = React.useState<LoadingProgressSnapshot>(EMPTY_PROGRESS);
    const currentOpacity = React.useRef(new Animated.Value(1)).current;
    const currentTranslateY = React.useRef(new Animated.Value(0)).current;
    const previousOpacity = React.useRef(new Animated.Value(0)).current;
    const previousTranslateY = React.useRef(new Animated.Value(-6)).current;

    React.useEffect(() => {
        if (!props.progressKey) {
            setProgress(EMPTY_PROGRESS);
            return undefined;
        }

        return loadingProgressService.subscribe(props.progressKey, setProgress);
    }, [props.progressKey]);

    React.useEffect(() => {
        currentOpacity.setValue(0);
        currentTranslateY.setValue(16);
        previousOpacity.setValue(progress.previous ? 0 : 1);
        previousTranslateY.setValue(0);

        Animated.parallel([
            Animated.timing(currentOpacity, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(currentTranslateY, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(previousOpacity, {
                toValue: progress.previous ? 0.58 : 0,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(previousTranslateY, {
                toValue: -8,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start();
    }, [
        currentOpacity,
        currentTranslateY,
        previousOpacity,
        previousTranslateY,
        progress.current?.label,
        progress.previous?.label,
        progress.previous?.status,
    ]);

    const currentLabel = progress.current?.label ?? props.fallbackLabel ?? 'Загрузка...';
    const previous = progress.previous;
    return (
        <SafeAreaView
          edges={['left', 'right', 'bottom']}
          style={[
            {
              flex: 1,
              paddingBottom: insets.bottom,
              backgroundColor: colors.background,
            },
            props.style,
          ]}
        >
            <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
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
                <View style={{height: 64, width: '92%', alignItems: 'center', justifyContent: 'center'}}>
                    {previous ? (
                        <Animated.View
                            style={{
                                opacity: previousOpacity,
                                transform: [{translateY: previousTranslateY}],
                                position: 'absolute',
                                top: 0,
                                width: '100%',
                            }}
                        >
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                style={{
                                    color: '#FFFFFF',
                                    fontSize: 15,
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    textShadowColor: 'rgba(0, 0, 0, 0.7)',
                                    textShadowRadius: 3,
                                }}
                            >
                                {previous.label}{' '}
                                <Text style={{color: previous.status === 'success' ? '#55D66B' : '#FF6B6B'}}>
                                    {previous.status === 'success' ? 'успешно' : 'не удалось'}
                                </Text>
                            </Text>
                        </Animated.View>
                    ) : null}
                    <Animated.View
                        style={{
                            opacity: currentOpacity,
                            transform: [{translateY: currentTranslateY}],
                            position: 'absolute',
                            bottom: 0,
                            width: '100%',
                        }}
                    >
                        <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={{
                                color: '#FFFFFF',
                                fontSize: 16,
                                fontWeight: '700',
                                textAlign: 'center',
                                textShadowColor: 'rgba(0, 0, 0, 0.7)',
                                textShadowRadius: 3,
                            }}
                        >
                            {currentLabel}
                        </Text>
                    </Animated.View>
                </View>
            </View>
            {props.showStickyAd ? (
                <StickyBannerSlot placement={AD_PLACEMENTS.loading}/>
            ) : null}
        </SafeAreaView>
    );
}

export default LoadingScreen
