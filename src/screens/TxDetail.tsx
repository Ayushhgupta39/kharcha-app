import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { Pencil } from 'lucide-react-native';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { Button, Hair } from '../components/Button';
import { C, F } from '../lib/tokens';
import { formatAmount, formatTime } from '../lib/format';
import { getCategory } from '../lib/categories';
import { useCategories } from '../store/categories';
import { useTransactions } from '../store/transactions';
import { useAccounts } from '../store/accounts';
import type { Transaction, TxKind } from '../db/transactions';

type Props = {
  tx: Transaction;
  onBack: () => void;
};

export function TxDetailScreen({ tx, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const cats = useCategories((s) => s.all);
  const customs = useCategories((s) => s.customs);
  const accounts = useAccounts((s) => s.accounts);

  const origDate = parseISO(tx.date);
  const today = new Date();

  const [editing, setEditing] = useState(false);

  // Edit state — always kept in sync with tx when not editing
  const [amountStr, setAmountStr] = useState(String(Math.round(tx.amount / 100)));
  const [merchant, setMerchant] = useState(tx.merchant);
  const [category, setCategory] = useState(tx.category);
  const [txType, setTxType] = useState<'debit' | 'credit'>(tx.type ?? 'debit');
  const [kind, setKind] = useState<TxKind>(
    tx.kind ?? (tx.type === 'credit' ? 'income' : 'expense')
  );
  const [accountId, setAccountId] = useState<string | null>(tx.account_id ?? null);
  const [note, setNote] = useState(tx.note ?? '');
  const [date, setDate] = useState<Date>(origDate);
  const [showCat, setShowCat] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calYear, setCalYear] = useState(origDate.getFullYear());
  const [calMonth, setCalMonth] = useState(origDate.getMonth());

  const amountNum = Number(amountStr);
  const valid = amountNum > 0 && merchant.trim().length > 0;

  const enterEdit = () => setEditing(true);

  const cancelEdit = () => {
    setAmountStr(String(Math.round(tx.amount / 100)));
    setMerchant(tx.merchant);
    setCategory(tx.category);
    setTxType(tx.type ?? 'debit');
    setKind(tx.kind ?? (tx.type === 'credit' ? 'income' : 'expense'));
    setAccountId(tx.account_id ?? null);
    setNote(tx.note ?? '');
    setDate(origDate);
    setShowCat(false);
    setShowDatePicker(false);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!valid) return;
    const newDate = new Date(date);
    newDate.setHours(origDate.getHours(), origDate.getMinutes(), origDate.getSeconds());
    const special = kind === 'invest' || kind === 'lent';
    const finalCategory = special ? kind : category;
    await useTransactions.getState().update(
      tx.id,
      {
        amount: Math.round(amountNum * 100),
        merchant: merchant.trim(),
        category: finalCategory,
        type: txType,
        kind,
        account_id: accountId,
        note,
        date: newDate.toISOString(),
      },
      { rememberMerchantCategory: !special && category !== tx.category }
    );
    setEditing(false);
    onBack();
  };

  const handleDelete = async () => {
    await useTransactions.getState().remove(tx.id);
    onBack();
  };

  const catInfo = getCategory(category, customs);
  const dateLine = format(date, 'EEEE, dd MMMM yyyy').toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable
          onPress={editing ? cancelEdit : onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="arrow-l" size={18} color={C.text} />
          <T mono style={{ fontSize: 11, letterSpacing: 1.2 }}>
            {editing ? 'CANCEL' : 'BACK'}
          </T>
        </Pressable>
        <T mono color={C.text3} style={{ fontSize: 10, letterSpacing: 1.3 }}>
          TXN · {tx.id.slice(0, 8).toUpperCase()}
        </T>
        {editing ? (
          <Pressable onPress={handleDelete}>
            <Icon name="trash" size={16} color={C.danger} />
          </Pressable>
        ) : (
          <Pressable onPress={enterEdit} style={styles.editBtn}>
            <Pencil size={13} color={C.accent} strokeWidth={1.8} />
            <T mono weight="600" color={C.accent} style={{ fontSize: 10, letterSpacing: 1.2 }}>
              EDIT
            </T>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 }}>
          {editing ? (
            <View style={styles.typeToggle}>
              {(['debit', 'credit'] as const).map((t) => {
                const active = txType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      setTxType(t);
                      setKind(t === 'credit' ? 'income' : kind === 'income' ? 'expense' : kind);
                    }}
                    style={[
                      styles.typeBtn,
                      {
                        backgroundColor: active
                          ? t === 'credit'
                            ? '#34C759'
                            : C.danger
                          : C.surface,
                        borderColor: active ? (t === 'credit' ? '#34C759' : C.danger) : C.border2,
                      },
                    ]}>
                    <T
                      mono
                      weight="600"
                      style={{
                        fontSize: 10,
                        letterSpacing: 1.2,
                        color: active ? '#0A0A0A' : C.text3,
                      }}>
                      {t === 'debit' ? 'DEBIT' : 'CREDIT'}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Tag style={{ marginBottom: 10 }}>
              {tx.kind === 'invest'
                ? 'INVESTED'
                : tx.kind === 'lent'
                  ? 'LENT'
                  : tx.type === 'credit'
                    ? 'CREDITED'
                    : tx.category === 'transfer'
                      ? 'TRANSFER'
                      : 'DEBITED'}
            </Tag>
          )}

          {editing && txType === 'debit' ? (
            <View style={styles.typeToggle}>
              {[
                { k: 'expense' as TxKind, label: 'SPEND' },
                { k: 'invest' as TxKind, label: 'INVEST' },
                { k: 'lent' as TxKind, label: 'LENT' },
              ].map(({ k, label }) => {
                const active = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => {
                      setKind(k);
                      if (k === 'expense' && (category === 'invest' || category === 'lent'))
                        setCategory('other');
                    }}
                    style={[
                      styles.typeBtn,
                      {
                        backgroundColor: active ? C.accentGlow : C.surface,
                        borderColor: active ? C.accent : C.border2,
                      },
                    ]}>
                    <T
                      mono
                      weight="600"
                      style={{
                        fontSize: 10,
                        letterSpacing: 1,
                        color: active ? C.accent : C.text3,
                      }}>
                      {label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Amount */}
          <View style={styles.amountRow}>
            <T mono color={C.text3} style={{ fontSize: 36, marginRight: 4 }}>
              ₹
            </T>
            {editing ? (
              <TextInput
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="decimal-pad"
                selectionColor={C.accent}
                autoFocus
                style={[styles.amountInput, !valid && { color: C.danger }]}
              />
            ) : (
              <T
                mono
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  flexShrink: 1,
                  fontSize: 56,
                  lineHeight: 54,
                  letterSpacing: -1.6,
                  color: C.text,
                }}>
                {Math.round(tx.amount / 100).toLocaleString('en-IN')}
              </T>
            )}
          </View>

          {/* Merchant */}
          {editing ? (
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              selectionColor={C.accent}
              style={styles.merchantInput}
            />
          ) : (
            <T style={{ fontSize: 16, color: C.text, marginTop: 14 }}>{tx.merchant}</T>
          )}

          {/* Date */}
          {editing ? (
            <>
              <Pressable onPress={() => setShowDatePicker((v) => !v)} style={styles.dateTrigger}>
                <T mono color={C.text3} style={{ fontSize: 11, letterSpacing: 0.3 }}>
                  {dateLine}
                </T>
                <Icon name={showDatePicker ? 'chevron-u' : 'chevron-d'} size={12} color={C.text4} />
              </Pressable>
              {showDatePicker && (
                <View style={{ marginTop: 12 }}>
                  <InlineDatePicker
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
                      } else setCalMonth((m) => m - 1);
                    }}
                    onNextMonth={() => {
                      const nextM = calMonth === 11 ? 0 : calMonth + 1;
                      const nextY = calMonth === 11 ? calYear + 1 : calYear;
                      if (
                        nextY > today.getFullYear() ||
                        (nextY === today.getFullYear() && nextM > today.getMonth())
                      )
                        return;
                      setCalMonth(nextM);
                      setCalYear(nextY);
                    }}
                  />
                </View>
              )}
            </>
          ) : (
            <T mono color={C.text3} style={{ fontSize: 11, marginTop: 4, letterSpacing: 0.3 }}>
              {format(origDate, 'EEEE, dd MMMM yyyy').toUpperCase()} · {formatTime(tx.date)}
            </T>
          )}
        </View>

        <Hair />

        {/* Category */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
          <View style={styles.catHeader}>
            <Tag>CATEGORY</Tag>
            {editing && (
              <Pressable
                onPress={() => setShowCat((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <T mono color={C.accent} style={{ fontSize: 10, letterSpacing: 1.3 }}>
                  {showCat ? 'DONE' : 'CHANGE'}
                </T>
                <Icon name={showCat ? 'chevron-d' : 'chevron-r'} size={12} color={C.accent} />
              </Pressable>
            )}
          </View>
          <View style={styles.catBox}>
            <CategoryGlyph category={category} size={42} active customs={customs} />
            <View>
              <T weight="500" style={{ fontSize: 14 }}>
                {catInfo.label}
              </T>
              {tx.source === 'sms' && !showCat ? (
                <T mono color={C.text3} style={{ fontSize: 10, marginTop: 2 }}>
                  AUTO-DETECTED
                </T>
              ) : null}
            </View>
          </View>
          {editing && showCat ? (
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
                        backgroundColor: active ? C.accentGlow : C.surface,
                        borderColor: active ? C.accent : C.border2,
                      },
                    ]}>
                    <CategoryGlyph category={c.key} size={24} active={active} customs={customs} />
                    <T style={{ fontSize: 12 }}>{c.label}</T>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <Hair />

        {/* Account */}
        {editing && accounts.length > 0 ? (
          <>
            <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
              <Tag style={{ marginBottom: 12 }}>ACCOUNT</Tag>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Pressable
                  onPress={() => setAccountId(null)}
                  style={[
                    styles.acctChip,
                    {
                      borderColor: accountId === null ? C.accent : C.border2,
                      backgroundColor: accountId === null ? C.accentGlow : C.surface,
                    },
                  ]}>
                  <T style={{ fontSize: 12, color: accountId === null ? C.accent : C.text2 }}>
                    None
                  </T>
                </Pressable>
                {accounts.map((a) => {
                  const active = accountId === a.id;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => setAccountId(a.id)}
                      style={[
                        styles.acctChip,
                        {
                          borderColor: active ? C.accent : C.border2,
                          backgroundColor: active ? C.accentGlow : C.surface,
                        },
                      ]}>
                      <Icon
                        name={a.type === 'card' ? 'card' : 'bank'}
                        size={13}
                        color={active ? C.accent : C.text3}
                      />
                      <T
                        style={{ fontSize: 12, color: active ? C.accent : C.text2 }}
                        numberOfLines={1}>
                        {a.name}
                      </T>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Hair />
          </>
        ) : null}

        {/* Source */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 18 }}>
          <Tag style={{ marginBottom: 12 }}>SOURCE</Tag>
          {tx.source === 'sms' ? (
            <View style={styles.smsBox}>
              <View style={styles.smsHeader}>
                <Icon name="sms" size={14} color={C.accent} />
                <T mono color={C.text2} style={{ fontSize: 10, letterSpacing: 1.3 }}>
                  SMS {tx.bank ? '· ' + tx.bank : ''}
                </T>
                <View style={{ flex: 1 }} />
                <T mono color={C.text4} style={{ fontSize: 10 }}>
                  {formatTime(tx.date)}
                </T>
              </View>
              <View style={{ padding: 14 }}>
                <T mono color={C.text2} style={{ fontSize: 12, lineHeight: 18 }}>
                  {tx.raw_sms || 'Original SMS content not available.'}
                </T>
              </View>
            </View>
          ) : (
            <View style={styles.manualBox}>
              <Icon name="edit" size={14} color={C.text2} />
              <T mono color={C.text2} style={{ fontSize: 11, letterSpacing: 1.2 }}>
                MANUAL ENTRY
              </T>
            </View>
          )}
        </View>

        {/* Note */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Tag style={{ marginBottom: 12 }}>NOTE</Tag>
          {editing ? (
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note…"
              placeholderTextColor={C.text3}
              multiline
              style={styles.noteInput}
              selectionColor={C.accent}
            />
          ) : (
            <T color={note ? C.text2 : C.text4} style={{ fontSize: 13 }}>
              {note || 'No note'}
            </T>
          )}
        </View>

        {/* Details */}
        <View style={{ paddingHorizontal: 20 }}>
          <Tag style={{ marginBottom: 10 }}>DETAILS</Tag>
          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 2 }}>
            {(
              [
                ['AMOUNT', formatAmount(tx.amount)],
                ['DATE', format(parseISO(tx.date), 'd MMM yyyy')],
                ['TIME', formatTime(tx.date)],
                ['ACCOUNT', accounts.find((a) => a.id === tx.account_id)?.name ?? 'Unlinked'],
                ['SOURCE', tx.source === 'sms' ? (tx.bank ?? 'SMS') : 'MANUAL'],
              ] as [string, string][]
            ).map(([k, v], i) => (
              <View
                key={k}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: C.border,
                }}>
                <T mono color={C.text3} style={{ fontSize: 11, letterSpacing: 1 }}>
                  {k}
                </T>
                <T mono color={C.text} style={{ fontSize: 12 }}>
                  {v}
                </T>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {editing && (
        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button label="CANCEL" variant="ghost" onPress={cancelEdit} style={{ flex: 1 }} />
          <Button
            label="SAVE CHANGES"
            onPress={handleSave}
            disabled={!valid}
            style={{ flex: 2, opacity: valid ? 1 : 0.35 }}
          />
        </View>
      )}
    </View>
  );
}

type DatePickerProps = {
  year: number;
  month: number;
  selected: Date;
  maxDate: Date;
  onSelect: (d: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function InlineDatePicker({
  year,
  month,
  selected,
  maxDate,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: DatePickerProps) {
  const firstOfMonth = startOfMonth(new Date(year, month, 1));
  const startDow = getDay(firstOfMonth);
  const daysInM = getDaysInMonth(firstOfMonth);

  const atMaxMonth =
    year > maxDate.getFullYear() || (year === maxDate.getFullYear() && month >= maxDate.getMonth());

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
        <Pressable onPress={onNextMonth} style={[styles.calNavBtn, atMaxMonth && { opacity: 0.2 }]}>
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
            if (day === null) return <View key={ci} style={styles.calCell} />;
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: C.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  amountInput: {
    fontFamily: F.mono,
    fontSize: 56,
    letterSpacing: -1.6,
    color: C.text,
    padding: 0,
    flex: 1,
  },
  merchantInput: {
    fontFamily: F.inter,
    fontSize: 16,
    color: C.text,
    padding: 0,
    marginTop: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border2,
    paddingBottom: 6,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  catBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border2,
    backgroundColor: C.surface,
    borderRadius: 2,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
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
  smsBox: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 2,
  },
  smsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  manualBox: {
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noteInput: {
    width: '100%',
    minHeight: 72,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    color: C.text,
    padding: 12,
    fontSize: 13,
    fontFamily: F.inter,
    textAlignVertical: 'top',
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  acctChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 2,
    maxWidth: '100%',
  },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 2,
  },
  saveBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.bg,
  },
  calWrap: {
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
  calNavBtn: { padding: 4 },
  calDowRow: { flexDirection: 'row', marginBottom: 4 },
  calDow: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    color: C.text4,
    letterSpacing: 1,
    paddingVertical: 2,
  },
  calRow: { flexDirection: 'row', marginBottom: 3 },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginHorizontal: 1.5,
  },
  calDayNum: { fontSize: 11 },
});
