import { View, Pressable } from 'react-native';
import { T } from './Text';
import { C } from '../lib/tokens';
import type { Transaction } from '../db/transactions';

type Props = {
  month: number; // 1-12
  year: number;
  todayDay: number | null;
  txs: Transaction[];
  selectedDay: number;
  onSelectDay: (d: number) => void;
};

export function HeatmapMonth({
  month,
  year,
  todayDay,
  txs,
  selectedDay,
  onSelectDay,
}: Props) {
  const totals: Record<number, number> = {};
  for (const t of txs) {
    const d = new Date(t.date);
    if (d.getMonth() + 1 === month && d.getFullYear() === year) {
      const k = d.getDate();
      totals[k] = (totals[k] ?? 0) + t.amount;
    }
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // Sun=0
  const max = Math.max(1, ...Object.values(totals));

  const cells: (
    | { empty: true; key: string }
    | { empty: false; day: number; total: number; intensity: number }
  )[] = [];
  for (let i = 0; i < firstDay; i++)
    cells.push({ empty: true, key: `e${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const tot = totals[d] ?? 0;
    cells.push({
      empty: false,
      day: d,
      total: tot,
      intensity: tot / max,
    });
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 6 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <View key={i} style={{ flex: 1, marginRight: i === 6 ? 0 : 3 }}>
            <T
              mono
              style={{
                fontSize: 9,
                color: C.text4,
                textAlign: 'center',
                letterSpacing: 1,
                paddingVertical: 4,
              }}>
              {d}
            </T>
          </View>
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: 20,
          gap: 3,
        }}>
        {cells.map((c, idx) => {
          const w = `${(100 - 6 * (3 / 50)) / 7}%`; // rough visual balance; we use flexBasis below
          if (c.empty) {
            return (
              <View
                key={c.key}
                style={{ flexBasis: '13.3%', aspectRatio: 1 }}
              />
            );
          }
          const isSelected = c.day === selectedDay;
          const isToday = todayDay != null && c.day === todayDay;
          const hasData = c.total > 0;
          let bg: string = C.surface;
          let border: string = C.border;
          let color: string = C.text4;
          if (hasData) {
            bg = `rgba(245,245,245,${0.08 + c.intensity * 0.35})`;
            color = c.intensity > 0.5 ? '#0A0A0A' : C.text;
          }
          if (isSelected) {
            bg = C.accent;
            color = '#0A0A0A';
            border = C.accent;
          }
          return (
            <Pressable
              key={idx}
              onPress={() => onSelectDay(c.day)}
              style={({ pressed }) => ({
                flexBasis: '13.3%',
                aspectRatio: 1,
                backgroundColor: bg,
                borderWidth: 1,
                borderColor:
                  isToday && !isSelected ? C.accent : border,
                alignItems: 'flex-end',
                justifyContent: 'flex-start',
                paddingTop: 3,
                paddingRight: 5,
                borderRadius: 2,
                transform: [{ scale: pressed ? 0.88 : 1 }],
              })}>
              <T
                mono
                weight={isSelected || isToday ? '600' : '400'}
                style={{ fontSize: 10, color }}>
                {c.day}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
