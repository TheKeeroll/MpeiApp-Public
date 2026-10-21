import React from 'react';
import {AccessibilityInfo, Animated, AppState, Easing, View} from 'react-native';
import {Avatar} from 'react-native-paper';
import type {AvatarImageSource} from 'react-native-paper/lib/typescript/components/Avatar/AvatarImage';

const AVATAR_SIZE = 48;
const GAP = 8;
const CELL_WIDTH = AVATAR_SIZE + GAP;

export interface GratitudeAvatar {title: string; image: AvatarImageSource}

export const GratitudeAvatarStrip: React.FC<{people: readonly GratitudeAvatar[]; active: boolean}> = ({people, active}) => {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const [width, setWidth] = React.useState(0);
  const [foreground, setForeground] = React.useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const cycleWidth = people.length * CELL_WIDTH;
  const overflow = width > 0 && cycleWidth - GAP > width;
  const moving = overflow && active && foreground && !reduceMotion;

  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const appState = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { mounted = false; motion.remove(); appState.remove(); };
  }, []);

  React.useEffect(() => {
    translateX.setValue(0);
    if (!moving) return;
    const animation = Animated.loop(Animated.timing(translateX, {
      toValue: -cycleWidth,
      duration: Math.round(cycleWidth / 16 * 1000),
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [translateX, moving, cycleWidth]);

  // With overflow a second copy covers the viewport through the entire cycle.
  const copies = moving ? 2 : 1;
  return (
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{width: '100%', height: AVATAR_SIZE, marginTop: 8, overflow: 'hidden'}}>
      <Animated.View style={{flexDirection: 'row', width: cycleWidth * copies, transform: [{translateX}]}}>
        {Array.from({length: copies}, (_, copy) => people.map((person, index) => (
          <View key={`${copy}-${index}`} style={{width: !overflow && index === people.length - 1 ? AVATAR_SIZE : CELL_WIDTH, height: AVATAR_SIZE}}>
            <Avatar.Image size={AVATAR_SIZE} source={person.image} accessible={false}/>
          </View>
        )))}
      </Animated.View>
    </View>
  );
};
