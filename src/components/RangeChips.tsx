import { View, Pressable, StyleSheet } from 'react-native';
import { T } from './Text';
import { C } from '../lib/tokens';

type Props = {
  value: string;
  onChange: (v: string) => void;
  options?: string[];
};

export function RangeChips({
  value,
  onChange,
  options = ['W', '15D', 'M', 'Y'],
}: Props) {
  return (
    <View style={styles.group}>
      {options.map((o, i) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? C.text : 'transparent',
                borderLeftWidth: i === 0 ? 0 : 1,
                borderLeftColor: C.border2,
              },
            ]}>
            <T
              mono
              weight="600"
              color={active ? '#0A0A0A' : C.text2}
              style={{ fontSize: 11, letterSpacing: 0.8 }}>
              {o}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
