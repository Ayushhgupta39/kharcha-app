import { Text as RNText, type TextProps, StyleSheet } from 'react-native';
import { C, F } from '../lib/tokens';

type Variant = 'hero' | 'h1' | 'h2' | 'body' | 'meta' | 'label' | 'micro';

type Props = TextProps & {
  variant?: Variant;
  mono?: boolean;
  weight?: '400' | '500' | '600' | '700';
  color?: string;
  uppercase?: boolean;
};

const VARIANT_SIZE: Record<Variant, number> = {
  hero: 44,
  h1: 28,
  h2: 22,
  body: 15,
  meta: 13,
  label: 11,
  micro: 10,
};

function fontFamily(mono: boolean, weight: string): string {
  if (mono) {
    switch (weight) {
      case '500':
        return F.monoMedium;
      case '600':
        return F.monoSemi;
      case '700':
        return F.monoBold;
      default:
        return F.mono;
    }
  }
  switch (weight) {
    case '500':
      return F.interMedium;
    case '600':
    case '700':
      return F.interSemi;
    default:
      return F.inter;
  }
}

export function T({
  variant = 'body',
  mono = false,
  weight = '400',
  color = C.text,
  uppercase,
  style,
  children,
  ...rest
}: Props) {
  return (
    <RNText
      allowFontScaling
      {...rest}
      style={StyleSheet.flatten([
        {
          fontFamily: fontFamily(mono, weight),
          fontSize: VARIANT_SIZE[variant],
          color,
          letterSpacing: variant === 'label' || variant === 'micro' ? 1.2 : 0,
          textTransform: uppercase ? 'uppercase' : undefined,
          includeFontPadding: false,
        },
        style,
      ])}>
      {children}
    </RNText>
  );
}

// Common "tag" style — small, mono, uppercase, letter-spaced
export function Tag({ children, color = C.text3, style, ...rest }: TextProps & { color?: string }) {
  return (
    <RNText
      {...rest}
      style={StyleSheet.flatten([
        {
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 1.2,
          color,
          textTransform: 'uppercase',
          includeFontPadding: false,
        },
        style,
      ])}>
      {children}
    </RNText>
  );
}
