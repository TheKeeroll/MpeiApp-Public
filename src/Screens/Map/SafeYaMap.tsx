import React, { useState, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import YaMap from 'react-native-yamap';
import LoadingScreen from '../LoadingScreen/LoadingScreen';

interface SafeYaMapProps {
    nightMode?: boolean;
    onMapLoaded?: (event: any) => void;
    children?: React.ReactNode;
    style?: object;
    [key: string]: any;
}

const SafeYaMap = forwardRef<any, SafeYaMapProps>(({ style, onMapLoaded, ...props }, ref) => {
    const [loading, setLoading] = useState(true);

    const handleLoaded = (e: any) => {
        setLoading(false);
        onMapLoaded?.(e);
    };

    return (
        <View style={[styles.container, style]}>
            {loading && <LoadingScreen />}
            <YaMap
                ref={ref}
                style={styles.map}
                {...props}
                onMapLoaded={handleLoaded}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
});

export default SafeYaMap;
