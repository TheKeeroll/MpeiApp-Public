import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Animated } from 'react-native';
import YaMap from 'react-native-yamap';
import LoadingScreen from '../LoadingScreen/LoadingScreen';
import { CustomTheme } from '../../Themes/Themes';

interface SafeYaMapProps {
    nightMode?: boolean;
    children?: React.ReactNode;
    style?: object;
    [key: string]: any;
}

export default function SafeYaMap({ style, ...props }: SafeYaMapProps) {
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const onLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setLayout({ width, height });
        }
    };

    useEffect(() => {
        if (layout) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
            }).start();
        }
    }, [layout, fadeAnim]);

    return (
        <View style={[styles.container, style]} onLayout={onLayout}>
            {!layout && <LoadingScreen />}
            {layout && (
                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <YaMap style={styles.map} {...props} />
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
});
