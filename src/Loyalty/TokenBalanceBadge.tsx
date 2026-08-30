import React from 'react';
import {Animated, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from 'react-native-paper';
// @ts-expect-error
import * as MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {withOpacity, type CustomTheme} from '../Themes/Themes';
import {useLoyalty} from './LoyaltyProvider';

const TokenBalanceBadge: React.FC = () => {
  const {colors} = useTheme<CustomTheme>();
  const insets = useSafeAreaInsets();
  const {displayedBalance, state} = useLoyalty();
  const scale = React.useRef(new Animated.Value(1)).current;
  const previousBalance = React.useRef<number | undefined>(undefined);
  const [balanceDelta, setBalanceDelta] = React.useState<number | undefined>();

  React.useEffect(() => {
    const previous = previousBalance.current;
    previousBalance.current = state.balance;
    if (typeof previous === 'undefined' || previous === state.balance) {
      return;
    }

    const delta = state.balance - previous;
    setBalanceDelta(delta);
    Animated.sequence([
      Animated.timing(scale, {toValue: 1.22, duration: 150, useNativeDriver: true}),
      Animated.spring(scale, {toValue: 1, useNativeDriver: true}),
    ]).start();

    const timer = setTimeout(() => setBalanceDelta(undefined), 1_100);
    return () => clearTimeout(timer);
  }, [scale, state.balance]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        right: 8,
        zIndex: 100,
        minWidth: 58,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: withOpacity(colors.surface, 94),
        borderWidth: 1,
        borderColor: withOpacity(colors.textUnderline, 70),
        transform: [{scale}],
      }}
    >
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
        <MaterialIcons.default name="loyalty" size={18} color={colors.textUnderline}/>
        <Text style={{marginLeft: 4, color: colors.text, fontWeight: 'bold', fontSize: 16}}>
          {displayedBalance}
        </Text>
      </View>
      {typeof balanceDelta !== 'undefined' && (
        <Text style={{alignSelf: 'center', marginTop: 1, color: balanceDelta > 0 ? colors.accent : colors.warning, fontWeight: 'bold', fontSize: 12}}>
          {balanceDelta > 0 ? '+' : ''}{balanceDelta}
        </Text>
      )}
    </Animated.View>
  );
};

export default TokenBalanceBadge;
