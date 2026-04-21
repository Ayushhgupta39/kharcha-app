import {
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { T } from './Text';
import { C, F } from '../lib/tokens';

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        disabled && { opacity: 0.35 },
        pressed && isPrimary && { backgroundColor: C.accentDim },
        pressed && !isPrimary && { backgroundColor: C.surface2 },
        style,
      ]}>
      <T
        mono
        weight="600"
        uppercase
        style={{
          fontSize: isPrimary ? 13 : 12,
          letterSpacing: 1.2,
          color: isPrimary ? '#0A0A0A' : C.text,
        }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  primary: {
    backgroundColor: C.accent,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.border2,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
});

export function Hair({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: C.border }, style]} />;
}

export { F };
