import { useEffect, useRef, useState } from 'react';
import { View, Pressable, LayoutChangeEvent, PanResponder, Modal, Animated } from 'react-native';
import { T } from './Text';
import { C } from '../lib/tokens';
import { Icon } from './Icon';
import type { Transaction } from '../db/transactions';

type Props = {
  month: number; // 1-12
  year: number;
  todayDay: number | null; // day-of-month if the viewed month is the current month, else null
  txs: Transaction[];
  selectedDay: number;
  onSelectDay: (d: number) => void;
  onChangeMonth: (month: number, year: number) => void;
};

const GAP = 3;
const H_PAD = 20;
const COLS = 7;
const SWIPE_THRESHOLD = 48;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const SLIDE_MS = 200;

function shiftMonth(month: number, year: number, delta: number): [number, number] {
  const idx = month - 1 + delta;
  const y = year + Math.floor(idx / 12);
  const m = ((idx % 12) + 12) % 12;
  return [m + 1, y];
}

// A month is in the future (relative to now) and thus not navigable-to.
function isFutureMonth(month: number, year: number): boolean {
  const now = new Date();
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  return year * 12 + (month - 1) > nowIdx;
}

export function HeatmapMonth({
  month,
  year,
  todayDay,
  txs,
  selectedDay,
  onSelectDay,
  onChangeMonth,
}: Props) {
  const [gridWidth, setGridWidth] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const canGoNext = !isFutureMonth(...shiftMonth(month, year, 1));

  const onGridLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== gridWidth) setGridWidth(w);
  };

  // Three pages sit side by side in a row 3× the grid width; the middle one is
  // the current month. translateX offsets the row so the current page shows,
  // and animates by one page width to slide neighbours into view.
  const translateX = useRef(new Animated.Value(0)).current;
  const [prevM, prevY] = shiftMonth(month, year, -1);
  const [nextM, nextY] = shiftMonth(month, year, 1);

  // Snap the row back to the centered page whenever the month prop settles.
  const key = `${year}-${month}`;
  useEffect(() => {
    translateX.setValue(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Guards against a second swipe/tap landing while a slide is mid-flight — an
  // interrupted animation still fires its callback, which would change the month
  // without the row being reset and leave translateX stuck off-center (taps then
  // miss the visible cells until a remount).
  const animatingRef = useRef(false);

  const settle = (delta: number) => {
    if (gridWidth === 0 || animatingRef.current) return;
    animatingRef.current = true;
    // delta = +1 means move to next month: row slides left by one page width.
    // JS-driven (not native): a native-driven transform leaves Android's touch
    // hit-testing on the old bounds, so after settling, taps on the recentred
    // grid were missed until a remount. JS driver keeps layout authoritative.
    Animated.timing(translateX, {
      toValue: -delta * gridWidth,
      duration: SLIDE_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
      animatingRef.current = false;
      if (!finished) {
        // Interrupted: snap back to center, don't change the month.
        translateX.setValue(0);
        return;
      }
      // Recenter the row before swapping the month so the neighbour page that
      // just slid in becomes the new center with no visual jump — and, crucially,
      // translateX is 0 regardless of whether the key-effect fires.
      translateX.setValue(0);
      const [m, y] = shiftMonth(month, year, delta);
      onChangeMonth(m, y);
    });
  };

  const commit = (delta: number) => {
    if (delta > 0 && !canGoNext) {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
      return;
    }
    settle(delta);
  };

  // Latest values for the once-created PanResponder closure.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const canGoNextRef = useRef(canGoNext);
  canGoNextRef.current = canGoNext;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !animatingRef.current &&
        Math.abs(g.dx) > 16 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        if (animatingRef.current) return;
        // Resist dragging toward the future (finger moving left); past follows freely.
        let dx = g.dx;
        if (dx < 0 && !canGoNextRef.current) dx *= 0.25;
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_THRESHOLD) commitRef.current(1);
        else if (g.dx >= SWIPE_THRESHOLD) commitRef.current(-1);
        else Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start(),
    })
  ).current;

  const goPrev = () => commit(-1);
  const goNext = () => commit(1);

  const cellSize = gridWidth > 0 ? Math.floor((gridWidth - GAP * (COLS - 1)) / COLS) : 0;

  const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={{ paddingHorizontal: H_PAD }}>
      {/* Month navigation header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
        <NavArrow dir="prev" onPress={goPrev} />
        <Pressable
          onPress={() => setPickerOpen(true)}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T mono weight="600" style={{ fontSize: 13, letterSpacing: 1 }}>
            {MONTHS[month - 1]} {year}
          </T>
          <Icon name="chevron-d" size={13} color={C.text3} />
        </Pressable>
        <NavArrow dir="next" onPress={goNext} disabled={!canGoNext} />
      </View>

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

      {/* Carousel — prev | current | next pages slide together like a FlatList.
          The outer view measures one page and clips; the row holds all three. */}
      <View onLayout={onGridLayout} style={{ overflow: 'hidden' }} {...panResponder.panHandlers}>
        {gridWidth > 0 ? (
          <Animated.View
            style={{
              flexDirection: 'row',
              width: gridWidth * 3,
              marginLeft: -gridWidth,
              transform: [{ translateX }],
            }}>
            <View style={{ width: gridWidth }}>
              <MonthGrid month={prevM} year={prevY} txs={txs} cellSize={cellSize} />
            </View>
            <View style={{ width: gridWidth }}>
              <MonthGrid
                month={month}
                year={year}
                txs={txs}
                cellSize={cellSize}
                todayDay={todayDay}
                selectedDay={selectedDay}
                onSelectDay={onSelectDay}
              />
            </View>
            <View style={{ width: gridWidth }}>
              <MonthGrid month={nextM} year={nextY} txs={txs} cellSize={cellSize} />
            </View>
          </Animated.View>
        ) : null}
      </View>

      <MonthPicker
        visible={pickerOpen}
        month={month}
        year={year}
        onClose={() => setPickerOpen(false)}
        onSelect={(m, y) => {
          onChangeMonth(m, y);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

type GridProps = {
  month: number;
  year: number;
  txs: Transaction[];
  cellSize: number;
  todayDay?: number | null;
  selectedDay?: number;
  onSelectDay?: (d: number) => void;
};

function MonthGrid({
  month,
  year,
  txs,
  cellSize,
  todayDay = null,
  selectedDay,
  onSelectDay,
}: GridProps) {
  // Spend-only heat: income, transfers and invest are excluded so a day's
  // intensity matches the spend figure shown in the hero (expense + lent).
  const totals: Record<number, number> = {};
  for (const t of txs) {
    if (t.type === 'credit' || t.category === 'transfer') continue;
    if ((t.kind ?? 'expense') === 'invest') continue;
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

  return (
    <>
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
            const isSelected = selectedDay != null && slot.day === selectedDay;
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
                onPress={() => onSelectDay?.(slot.day)}
              />
            );
          })}
        </View>
      ))}
    </>
  );
}

function NavArrow({
  dir,
  onPress,
  disabled,
}: {
  dir: 'prev' | 'next';
  onPress: () => void;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => !disabled && setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={8}
      style={{
        width: 30,
        height: 30,
        borderWidth: 1,
        borderColor: C.border2,
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
      }}>
      <Icon
        name={dir === 'prev' ? 'chevron-l' : 'chevron-r'}
        size={15}
        color={disabled ? C.text4 : C.text2}
      />
    </Pressable>
  );
}

type PickerProps = {
  visible: boolean;
  month: number;
  year: number;
  onClose: () => void;
  onSelect: (month: number, year: number) => void;
};

function MonthPicker({ visible, month, year, onClose, onSelect }: PickerProps) {
  const [viewYear, setViewYear] = useState(year);

  // Reset the browsed year each time the picker opens.
  const openedRef = useRef(visible);
  if (visible && !openedRef.current) setViewYear(year);
  openedRef.current = visible;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.border2,
            borderRadius: 4,
            padding: 16,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}>
            <NavArrow dir="prev" onPress={() => setViewYear((y) => y - 1)} />
            <T mono weight="600" style={{ fontSize: 15, letterSpacing: 1 }}>
              {viewYear}
            </T>
            <NavArrow
              dir="next"
              onPress={() => setViewYear((y) => y + 1)}
              disabled={viewYear >= new Date().getFullYear()}
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {MONTHS.map((label, i) => {
              const isCurrent = i + 1 === month && viewYear === year;
              const disabled = isFutureMonth(i + 1, viewYear);
              return (
                <MonthCell
                  key={label}
                  label={label}
                  active={isCurrent}
                  disabled={disabled}
                  onPress={() => onSelect(i + 1, viewYear)}
                />
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MonthCell({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <View style={{ width: '25%', padding: 4 }}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={() => !disabled && setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          height: 40,
          borderWidth: 1,
          borderColor: active ? C.accent : C.border2,
          backgroundColor: active ? C.accent : pressed ? C.surface2 : 'transparent',
          borderRadius: 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.25 : 1,
        }}>
        <T
          mono
          weight={active ? '700' : '400'}
          style={{ fontSize: 11, color: active ? '#0A0A0A' : C.text2 }}>
          {label}
        </T>
      </Pressable>
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
