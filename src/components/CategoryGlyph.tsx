import { View, StyleSheet } from 'react-native';
import { T } from './Text';
import { C } from '../lib/tokens';
import { getCategory, type Category } from '../lib/categories';

type Props = {
  category: string;
  size?: number;
  active?: boolean;
  customs?: Category[];
};

export function CategoryGlyph({ category, size = 36, active = false, customs = [] }: Props) {
  const cat = getCategory(category, customs);
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderColor: active ? C.accent : C.border2,
          backgroundColor: active ? C.accentGlowFaint : C.surface,
        },
      ]}>
      <T
        mono
        style={{
          fontSize: size * 0.42,
          color: active ? C.accent : C.text2,
          textAlign: 'center',
        }}>
        {cat.glyph}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
