import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { Button } from '../components/Button';
import { C, F } from '../lib/tokens';
import { useCategories } from '../store/categories';
import { useTransactions } from '../store/transactions';
import { BUILTIN_INCOME_CATEGORIES } from '../lib/categories';

const GLYPH_OPTIONS = ['◉', '◎', '◇', '◈', '▽', '▷', '◁', '△', '⬡', '⬢', '✦', '✧', '⊕', '⊗', '⊘'];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ManualSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const allCats = useCategories((s) => s.all);
  const customs = useCategories((s) => s.customs);
  const addCategory = useCategories((s) => s.add);
  const add = useTransactions((s) => s.add);

  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatGlyph, setNewCatGlyph] = useState(GLYPH_OPTIONS[0]);

  const today = new Date();

  const [txType, setTxType] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<string>('food');

  const [note, setNote] = useState('');

  const incomeCatKeys = new Set(BUILTIN_INCOME_CATEGORIES.map((c) => c.key));
  const cats = txType === 'credit'
    ? [...BUILTIN_INCOME_CATEGORIES, ...customs]
    : allCats.filter((c) => !incomeCatKeys.has(c.key));
  const [date, setDate] = useState<Date>(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-based

  const amountNum = Number(amount);
  const valid = amount && amountNum > 0 && merchant.trim().length > 0;

  const reset = () => {
    setTxType('debit');
    setAmount('');
    setMerchant('');
    setCategory('food');
    setNote('');
    setDate(today);
    setShowDatePicker(false);
    setNewCatOpen(false);
    setNewCatLabel('');
    setNewCatGlyph(GLYPH_OPTIONS[0]);
  };

  const saveNewCategory = async () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key) {
      Alert.alert('Invalid name', 'Use letters or numbers.');
      return;
    }
    if (allCats.some((c) => c.key === key)) {
      Alert.alert('Already exists', `A category named "${label}" already exists.`);
      return;
    }
    await addCategory({ key, label, glyph: newCatGlyph });
    setCategory(key);
    setNewCatOpen(false);
    setNewCatLabel('');
    setNewCatGlyph(GLYPH_OPTIONS[0]);
  };

  const save = async () => {
    if (!valid) return;
    // Preserve current time but use selected date
    const d = new Date(date);
    d.setHours(today.getHours(), today.getMinutes(), today.getSeconds());
    await add({
      amount: Math.round(amountNum * 100),
      type: txType,
      merchant: merchant.trim(),
      category,
      date: d.toISOString(),
      source: 'manual',
      note: note.trim() || null,
      bank: null,
      raw_sms: null,
    });
    reset();
    onClose();
  };

  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const dateLabel = isToday
    ? 'TODAY'
    : format(date, 'd MMM yyyy').toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          style={{ height: 60 + insets.top }}
          onPress={onClose}
        />
        <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <T mono weight="600" style={{ fontSize: 11, letterSpacing: 1.4 }}>
              NEW ENTRY
            </T>
            <Pressable onPress={onClose}>
              <Icon name="x" size={18} color={C.text2} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: 20,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.typeToggle}>
              {(['debit', 'credit'] as const).map((t) => {
                const active = txType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      setTxType(t);
                      setCategory(t === 'credit' ? 'salary' : 'food');
                    }}
                    style={[
                      styles.typeBtn,
                      {
                        backgroundColor: active
                          ? t === 'credit' ? 'rgba(52,199,89,0.12)' : C.surface2
                          : 'transparent',
                        borderColor: active
                          ? t === 'credit' ? '#34C759' : C.border2
                          : C.border,
                      },
                    ]}>
                    <T
                      mono
                      weight="600"
                      style={{
                        fontSize: 11,
                        letterSpacing: 1,
                        color: active
                          ? t === 'credit' ? '#34C759' : C.text
                          : C.text3,
                      }}>
                      {t === 'debit' ? '− EXPENSE' : '+ INCOME'}
                    </T>
                  </Pressable>
                );
              })}
            </View>

            <Tag style={{ marginBottom: 10, marginTop: 22 }}>AMOUNT</Tag>
            <View style={styles.amountRow}>
              <T
                mono
                color={amount ? C.text3 : C.text4}
                style={{ fontSize: 32 }}>
                ₹
              </T>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={C.text4}
                keyboardType="decimal-pad"
                autoFocus
                selectionColor={C.accent}
                style={[
                  styles.amountInput,
                  { color: amount ? C.text : C.text4 },
                ]}
              />
            </View>

            <Tag style={{ marginBottom: 10, marginTop: 22 }}>{txType === 'credit' ? 'SOURCE' : 'MERCHANT'}</Tag>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder={txType === 'credit' ? 'Where did you earn?' : 'Where did you spend?'}
              placeholderTextColor={C.text3}
              style={styles.textInput}
              selectionColor={C.accent}
            />

            <Tag style={{ marginBottom: 10, marginTop: 22 }}>DATE</Tag>
            <Pressable
              onPress={() => setShowDatePicker((v) => !v)}
              style={[
                styles.dateRow,
                showDatePicker && { borderColor: C.accent },
              ]}>
              <Icon name="calendar" size={14} color={C.text3} />
              <T mono style={{ fontSize: 13, flex: 1 }}>
                {dateLabel}
              </T>
              <Icon
                name={showDatePicker ? 'chevron-u' : 'chevron-d'}
                size={13}
                color={C.text3}
              />
            </Pressable>

            {showDatePicker && (
              <CalendarPicker
                year={calYear}
                month={calMonth}
                selected={date}
                maxDate={today}
                onSelect={(d) => {
                  setDate(d);
                  setShowDatePicker(false);
                }}
                onPrevMonth={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear((y) => y - 1);
                  } else {
                    setCalMonth((m) => m - 1);
                  }
                }}
                onNextMonth={() => {
                  const nextM = calMonth === 11 ? 0 : calMonth + 1;
                  const nextY = calMonth === 11 ? calYear + 1 : calYear;
                  // Don't go beyond current month
                  if (
                    nextY > today.getFullYear() ||
                    (nextY === today.getFullYear() &&
                      nextM > today.getMonth())
                  )
                    return;
                  setCalMonth(nextM);
                  setCalYear(nextY);
                }}
              />
            )}

            <Tag style={{ marginBottom: 10, marginTop: 22 }}>CATEGORY</Tag>
            <View style={styles.catGrid}>
              {cats.map((c) => {
                const active = category === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[
                      styles.catCell,
                      {
                        borderColor: active ? C.accent : C.border2,
                        backgroundColor: active ? C.accentGlow : C.surface,
                      },
                    ]}>
                    <CategoryGlyph
                      category={c.key}
                      size={22}
                      active={active}
                      customs={customs}
                    />
                    <T style={{ fontSize: 12 }}>{c.label.split(' ')[0]}</T>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setNewCatOpen((v) => !v)}
                style={[
                  styles.catCell,
                  {
                    borderColor: newCatOpen ? C.accent : C.border2,
                    borderStyle: 'dashed',
                    backgroundColor: C.surface,
                  },
                ]}>
                <T mono color={newCatOpen ? C.accent : C.text3} style={{ fontSize: 18 }}>+</T>
                <T style={{ fontSize: 12, color: newCatOpen ? C.accent : C.text3 }}>New</T>
              </Pressable>
            </View>

            {newCatOpen && (
              <View style={styles.newCatPanel}>
                <Tag style={{ marginBottom: 8 }}>GLYPH</Tag>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {GLYPH_OPTIONS.map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => setNewCatGlyph(g)}
                      style={[
                        styles.glyphCell,
                        { borderColor: newCatGlyph === g ? C.accent : C.border2,
                          backgroundColor: newCatGlyph === g ? C.accentGlow : C.surface },
                      ]}>
                      <T mono style={{ fontSize: 16, color: newCatGlyph === g ? C.accent : C.text2 }}>{g}</T>
                    </Pressable>
                  ))}
                </View>
                <Tag style={{ marginBottom: 8 }}>NAME</Tag>
                <TextInput
                  value={newCatLabel}
                  onChangeText={setNewCatLabel}
                  placeholder="e.g. Travel"
                  placeholderTextColor={C.text3}
                  style={[styles.textInput, { marginBottom: 12 }]}
                  selectionColor={C.accent}
                  autoFocus
                />
                <Button
                  label="ADD CATEGORY"
                  onPress={saveNewCategory}
                  disabled={!newCatLabel.trim()}
                  style={{ opacity: newCatLabel.trim() ? 1 : 0.35 }}
                />
              </View>
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 22,
                marginBottom: 10,
              }}>
              <Tag>NOTE</Tag>
              <Tag color={C.text4}>(OPTIONAL)</Tag>
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Dinner with team"
              placeholderTextColor={C.text3}
              style={styles.textInput}
              selectionColor={C.accent}
            />
          </ScrollView>

          <View style={styles.actionBar}>
            <Button
              label="CANCEL"
              variant="ghost"
              onPress={() => {
                reset();
                onClose();
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="SAVE ENTRY"
              onPress={save}
              disabled={!valid}
              style={{ flex: 2, opacity: valid ? 1 : 0.35 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type CalendarPickerProps = {
  year: number;
  month: number; // 0-based
  selected: Date;
  maxDate: Date;
  onSelect: (d: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function CalendarPicker({
  year,
  month,
  selected,
  maxDate,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: CalendarPickerProps) {
  const firstOfMonth = startOfMonth(new Date(year, month, 1));
  const startDow = getDay(firstOfMonth); // 0=Sun
  const daysInM = getDaysInMonth(firstOfMonth);

  const atMaxMonth =
    year > maxDate.getFullYear() ||
    (year === maxDate.getFullYear() && month >= maxDate.getMonth());

  const slots: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) slots.push(null);
  for (let d = 1; d <= daysInM; d++) slots.push(d);
  while (slots.length % 7 !== 0) slots.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) rows.push(slots.slice(i, i + 7));

  return (
    <View style={styles.calWrap}>
      <View style={styles.calNav}>
        <Pressable onPress={onPrevMonth} style={styles.calNavBtn}>
          <Icon name="chevron-l" size={14} color={C.text2} />
        </Pressable>
        <T mono weight="600" style={{ fontSize: 11, letterSpacing: 1.3 }}>
          {format(new Date(year, month, 1), 'MMM yyyy').toUpperCase()}
        </T>
        <Pressable
          onPress={onNextMonth}
          style={[styles.calNavBtn, atMaxMonth && { opacity: 0.2 }]}>
          <Icon name="chevron-r" size={14} color={C.text2} />
        </Pressable>
      </View>

      <View style={styles.calDowRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <T key={i} mono style={styles.calDow}>
            {d}
          </T>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={styles.calRow}>
          {row.map((day, ci) => {
            if (day === null) {
              return <View key={ci} style={styles.calCell} />;
            }
            const cellDate = new Date(year, month, day);
            const isFuture = cellDate > maxDate;
            const isSel =
              selected.getDate() === day &&
              selected.getMonth() === month &&
              selected.getFullYear() === year;
            const isToday =
              maxDate.getDate() === day &&
              maxDate.getMonth() === month &&
              maxDate.getFullYear() === year;

            return (
              <Pressable
                key={ci}
                onPress={() => !isFuture && onSelect(cellDate)}
                style={[
                  styles.calCell,
                  isSel && { backgroundColor: C.accent },
                  !isSel && isToday && { borderColor: C.accent },
                  isFuture && { opacity: 0.2 },
                ]}>
                <T
                  mono
                  weight={isSel || isToday ? '700' : '400'}
                  style={[
                    styles.calDayNum,
                    { color: isSel ? '#0A0A0A' : isToday ? C.accent : C.text2 },
                  ]}>
                  {day}
                </T>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    flex: 1,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border2,
    paddingBottom: 12,
  },
  amountInput: {
    flex: 1,
    fontFamily: F.mono,
    fontSize: 40,
    letterSpacing: -1,
    padding: 0,
  },
  textInput: {
    width: '100%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontFamily: F.inter,
    fontSize: 13,
    borderRadius: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 2,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catCell: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  newCatPanel: {
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    backgroundColor: C.surface,
  },
  glyphCell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 2,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  calWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border2,
    backgroundColor: C.surface,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  calNavBtn: {
    padding: 4,
  },
  calDowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calDow: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    color: C.text4,
    letterSpacing: 1,
    paddingVertical: 2,
  },
  calRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginHorizontal: 1.5,
  },
  calDayNum: {
    fontSize: 11,
  },
});
