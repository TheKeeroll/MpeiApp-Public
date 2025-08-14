import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Animated } from 'react-native';
import YaMap from 'react-native-yamap';
import LoadingScreen from '../LoadingScreen/LoadingScreen';
import { CustomTheme } from '../../Themes/Themes';

interface SafeYaMapProps {
    nightMode?: boolean;
    onMapLoaded?: (event: any) => void;
    children?: React.ReactNode;
    style?: object;
    [key: string]: any;
}

export default function SafeYaMap({ style, ...props }: SafeYaMapProps) {
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const onLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setLayout({ width, height });
        }
    };

    useEffect(() => {
        if (layout) {
            setLoading(false);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
            }).start();
        }
    }, [layout, fadeAnim]);

    useEffect(() => {
        const failSafeTimeout = setTimeout(() => {
            if (!layout) {
                console.warn("Forcing map load end due to timeout");
            }
            setLoading(false);
        }, 3000);
        return () => clearTimeout(failSafeTimeout);
    }, []);

    return (
        <View style={[styles.container, style]} onLayout={onLayout}>
            {loading && <LoadingScreen />}
            {(layout  || (!loading)) && (
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
