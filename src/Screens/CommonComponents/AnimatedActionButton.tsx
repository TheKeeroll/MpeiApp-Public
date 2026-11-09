import React from 'react';
import {AccessibilityInfo, Animated, AppState, StyleSheet, Text, TouchableOpacity} from 'react-native';
import {useTheme} from 'react-native-paper';
// @ts-expect-error The bundled icon package has no type declarations.
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {type CustomTheme, withOpacity} from '../../Themes/Themes';

const AnimatedActionButton: React.FC<{
  title: string;
  icon: string;
  disabled?: boolean;
  onPress: () => void;
}> = ({title, icon, disabled = false, onPress}) => {
  const {colors} = useTheme<CustomTheme>();
  const shine = React.useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = React.useState(true);
  const [active, setActive] = React.useState(AppState.currentState === 'active');
  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => undefined);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const appState = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => { mounted = false; motion.remove(); appState.remove(); };
  }, []);
  React.useEffect(() => {
    shine.setValue(0);
    if (disabled || reduceMotion || !active) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(shine, {toValue: 1, duration: 1800, useNativeDriver: true, isInteraction: false}),
      Animated.delay(1600),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, disabled, reduceMotion, shine]);
  const foreground = disabled ? withOpacity(colors.text, 45) : '#102014';
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{disabled}} disabled={disabled} onPress={onPress} activeOpacity={0.8}
    style={[styles.button, {
      backgroundColor: disabled ? colors.surface : colors.accent,
      borderColor: disabled ? withOpacity(colors.text, 20) : colors.accent,
      shadowColor: colors.accent, shadowOpacity: disabled ? 0 : 0.25,
    }]}>
    {!disabled && !reduceMotion && <Animated.View pointerEvents="none" style={[styles.shine, {
      transform: [{translateX: shine.interpolate({inputRange: [0, 1], outputRange: [-100, 380]})}, {rotate: '22deg'}],
      opacity: shine.interpolate({inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.45, 0.45, 0]}),
    }]}/>}
    <Icon name={icon} size={21} color={foreground} accessible={false}/>
    <Text style={{color: foreground, fontSize: 17, fontWeight: '700', flexShrink: 1, textAlign: 'center'}}>{title}</Text>
  </TouchableOpacity>;
};

const styles = StyleSheet.create({
  button: {flex: 1.4, minHeight: 60, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center',
    borderRadius: 18, borderWidth: 1, padding: 10, overflow: 'hidden', shadowOffset: {width: 0, height: 3}, shadowRadius: 10},
  shine: {position: 'absolute', left: 0, top: -30, bottom: -30, width: 40, backgroundColor: '#FFFFFF'},
});

export default AnimatedActionButton;
