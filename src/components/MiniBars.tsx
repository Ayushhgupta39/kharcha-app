import { View, Pressable } from 'react-native';
import { T } from './Text';
import { C } from '../lib/tokens';

export type Bucket = { label: string; total: number; dateIso?: string };

type Props = {
  days: Bucket[];
  selectedIdx?: number | null;
  onSelect?: (i: number) => void;
  height?: number;
};

export function MiniBars({
  days,
  selectedIdx,
  onSelect,
  height = 88,
}: Props) {
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        height,
        paddingHorizontal: 20,
      }}>
      {days.map((d, i) => {
        const h = Math.max(2, (d.total / max) * (height - 20));
        const selected = i === selectedIdx;
        return (
          <Pressable
            key={i}
            onPress={() => onSelect?.(i)}
            style={{ flex: 1, flexDirection: 'column', gap: 6 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}>
              <View
                style={{
                  height: h,
                  backgroundColor: selected
                    ? C.accent
                    : d.total > 0
                      ? C.text4
                      : C.border2,
                  borderRadius: 1,
                }}
              />
            </View>
            <T
              mono
              style={{
                fontSize: 9,
                color: selected ? C.text : C.text4,
                textAlign: 'center',
                letterSpacing: 0.5,
              }}>
              {d.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
