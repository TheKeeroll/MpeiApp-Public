import React from 'react';
import {Text, TouchableOpacity, type ViewStyle} from 'react-native';
import {useTheme} from 'react-native-paper';
// @ts-expect-error
import * as Fontisto from 'react-native-vector-icons/Fontisto';
import type {CustomTheme} from '../Themes/Themes';

const AuthButton: React.FC<{
  title?: string;
  icon?: string;
  iconSize?: number;
  onPress: () => void;
  style: ViewStyle;
  disabled?: boolean;
  children?: React.ReactNode;
}> = ({title, icon, iconSize, onPress, style, disabled = false, children}) => {
  const {colors} = useTheme<CustomTheme>();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[{backgroundColor: colors.surface, borderRadius: 15, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1}, style]}
    >
      {children}
      {typeof icon !== 'undefined' ? (
        <Fontisto.default name={icon} adjustsFontSizeToFit size={iconSize} color={colors.textUnderline}/>
      ) : (
        <Text style={{maxWidth: '100%', fontSize: 16, fontWeight: 'bold', color: colors.textUnderline, textAlign: 'center'}}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

export default AuthButton;
