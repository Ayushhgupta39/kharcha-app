import { useState } from 'react';
import { View, Pressable, LayoutChangeEvent } from 'react-native';
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

const GAP = 3;
const H_PAD = 20;
const COLS = 7;

export function HeatmapMonth({ month, year, todayDay, txs, selectedDay, onSelectDay }: Props) {
  const [gridWidth, setGridWidth] = useState(0);

  const onGridLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== gridWidth) setGridWidth(w);
  };

  const cellSize = gridWidth > 0 ? Math.floor((gridWidth - GAP * (COLS - 1)) / COLS) : 0;

  const totals: Record<number, number> = {};
  for (const t of txs) {
    if (t.type === 'credit' || t.category === 'transfer') continue;
    const d = new Date(t.date);
    if (d.getMonth() + 1 === month && d.getFullYear() === year) {
      const k = d.getDate();
      totals[k] = (totals[k] ?? 0) + t.amount;
    }
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // Sun=0

  const max = Math.max(1, ...Object.values(totals));

  // Build a flat 7-slot-per-row grid
  const slots: ({ empty: true } | { empty: false; day: number; intensity: number })[] = [];
  for (let i = 0; i < firstDay; i++) slots.push({ empty: true });
  for (let d = 1; d <= daysInMonth; d++) {
    slots.push({ empty: false, day: d, intensity: (totals[d] ?? 0) / max });
  }
  // Pad to full rows
  while (slots.length % COLS !== 0) slots.push({ empty: true });

  // Split into rows
  const rows: (typeof slots)[] = [];
  for (let i = 0; i < slots.length; i += COLS) rows.push(slots.slice(i, i + COLS));

  const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={{ paddingHorizontal: H_PAD }}>
      {/* Day-of-week header */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {DOW.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <T mono style={{ fontSize: 9, color: C.text4, letterSpacing: 1 }}>
              {d}
            </T>
          </View>
        ))}
      </View>

      {/* Grid rows — measure width once on the outer container */}
      <View onLayout={onGridLayout}>
        {rows.map((row, ri) => (
          <View
            key={ri}
            style={{
              flexDirection: 'row',
              marginBottom: ri < rows.length - 1 ? GAP : 0,
            }}>
            {row.map((slot, ci) => {
              if (slot.empty) {
                return (
                  <View
                    key={ci}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      marginRight: ci < COLS - 1 ? GAP : 0,
                    }}
                  />
                );
              }
              const isSelected = slot.day === selectedDay;
              const isToday = todayDay != null && slot.day === todayDay;

              let bg: string;
              let border: string;
              let color: string;

              if (isSelected) {
                bg = C.accent;
                border = C.accent;
                color = '#0A0A0A';
              } else if (isToday) {
                // Today unselected: accent border, heat bg
                const heat = slot.intensity > 0 ? Math.round(18 + slot.intensity * 38) : 14;
                bg = `rgb(${heat},${heat},${heat})`;
                border = C.accent;
                color = C.text;
              } else if (slot.intensity > 0) {
                // Heat: low spend = near-surface dark, high spend = noticeably lighter
                const heat = Math.round(18 + slot.intensity * 38);
                bg = `rgb(${heat},${heat},${heat})`;
                border = C.border;
                color = slot.intensity > 0.5 ? C.text : C.text2;
              } else {
                bg = C.surface;
                border = C.border;
                color = C.text3;
              }

              return (
                <HeatCell
                  key={ci}
                  day={slot.day}
                  size={cellSize}
                  bg={bg}
                  borderColor={border}
                  textColor={color}
                  bold={isSelected || isToday}
                  marginRight={ci < COLS - 1 ? GAP : 0}
                  onPress={() => onSelectDay(slot.day)}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

type CellProps = {
  day: number;
  size: number;
  bg: string;
  borderColor: string;
  textColor: string;
  bold: boolean;
  marginRight: number;
  onPress: () => void;
};

function HeatCell({
  day,
  size,
  bg,
  borderColor,
  textColor,
  bold,
  marginRight,
  onPress,
}: CellProps) {
  const [pressed, setPressed] = useState(false);
  if (!size) return null;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        paddingTop: 5,
        paddingRight: 5,
        borderRadius: 0,
        marginRight,
        opacity: pressed ? 0.65 : 1,
      }}>
      <T mono weight={bold ? '700' : '400'} style={{ fontSize: 11, color: textColor }}>
        {day}
      </T>
    </Pressable>
  );
}
