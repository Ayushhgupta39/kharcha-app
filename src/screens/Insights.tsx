import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tag } from '../components/Text';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { RangeChips } from '../components/RangeChips';
import { LabeledRule } from '../components/LabeledRule';
import type { Bucket } from '../components/MiniBars';
import { C, F } from '../lib/tokens';
import { formatAmount, formatAmountCompact } from '../lib/format';
import { getCategory } from '../lib/categories';
import { sumKinds } from '../lib/portfolio';
import { useTransactions } from '../store/transactions';
import { useCategories } from '../store/categories';
import { useBudgets } from '../store/budgets';
import { format, parseISO, subDays, startOfMonth, endOfMonth } from 'date-fns';
import type { Transaction } from '../db/transactions';

type RangeKey = 'W' | '15D' | 'M' | 'Y' | 'A' | 'C';

type Window = {
  start: string;
  end: string;
  label: string;
  buckets: Bucket[];
  bucketFmt: string;
};

// Returns 'YYYY-MM-DD' in local time for a given Date or ISO string.
function localDateKey(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function txMatchesLocalDate(t: Transaction, iso: string): boolean {
  return localDateKey(t.date) === iso;
}

function txInLocalDateRange(t: Transaction, startIso: string, endIso: string): boolean {
  const k = localDateKey(t.date);
  return k >= startIso && k <= endIso;
}

function buildLast15Days(txs: Transaction[]): Window {
  const now = new Date();
  const buckets: Bucket[] = [];
  for (let i = 14; i >= 0; i--) {
    const d = subDays(now, i);
    const iso = localDateKey(d);
    const total = txs.filter((t) => txMatchesLocalDate(t, iso)).reduce((s, t) => s + t.amount, 0);
    buckets.push({ label: format(d, 'dd'), total, dateIso: iso });
  }
  return {
    start: buckets[0].dateIso!,
    end: buckets[buckets.length - 1].dateIso!,
    label: 'LAST 15 DAYS',
    buckets,
    bucketFmt: 'DAY',
  };
}

function buildWeekly(txs: Transaction[]): Window {
  const now = new Date();
  const buckets: Bucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(now, i);
    const iso = localDateKey(d);
    const total = txs.filter((t) => txMatchesLocalDate(t, iso)).reduce((s, t) => s + t.amount, 0);
    buckets.push({ label: format(d, 'EEE').toUpperCase().slice(0, 2), total, dateIso: iso });
  }
  return {
    start: buckets[0].dateIso!,
    end: buckets[buckets.length - 1].dateIso!,
    label: 'THIS WEEK',
    buckets,
    bucketFmt: 'DAY',
  };
}

function buildMonthly(txs: Transaction[]): Window {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const days = end.getDate();
  const buckets: Bucket[] = [];
  for (let d = 1; d <= days; d++) {
    const iso = localDateKey(new Date(start.getFullYear(), start.getMonth(), d));
    const total = txs.filter((t) => txMatchesLocalDate(t, iso)).reduce((s, t) => s + t.amount, 0);
    buckets.push({ label: d % 5 === 0 || d === 1 ? String(d) : '', total, dateIso: iso });
  }
  return {
    start: localDateKey(start),
    end: localDateKey(end),
    label: format(now, 'MMMM yyyy').toUpperCase(),
    buckets,
    bucketFmt: 'DAY',
  };
}

function buildYearly(txs: Transaction[]): Window {
  const now = new Date();
  const year = now.getFullYear();
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const buckets: Bucket[] = months.map((m, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const total = txs
      .filter((t) => localDateKey(t.date).startsWith(`${year}-${mm}`))
      .reduce((s, t) => s + t.amount, 0);
    return { label: m, total };
  });
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    label: String(year),
    buckets,
    bucketFmt: 'MONTH',
  };
}

function buildCustom(txs: Transaction[], s: string, e: string): Window {
  const start = parseISO(s);
  const end = parseISO(e);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const buckets: Bucket[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = localDateKey(d);
    const total = txs.filter((t) => txMatchesLocalDate(t, iso)).reduce((s, t) => s + t.amount, 0);
    buckets.push({
      label: days <= 14 ? format(d, 'dd') : d.getDate() === 1 || i === 0 ? String(d.getDate()) : '',
      total,
      dateIso: iso,
    });
  }
  return { start: s, end: e, label: 'CUSTOM RANGE', buckets, bucketFmt: 'DAY' };
}

function buildAllTime(txs: Transaction[]): Window {
  if (txs.length === 0) {
    const k = localDateKey(new Date());
    return { start: k, end: k, label: 'ALL TIME', buckets: [], bucketFmt: 'MON' };
  }
  let min = txs[0].date;
  let max = txs[0].date;
  for (const t of txs) {
    if (t.date < min) min = t.date;
    if (t.date > max) max = t.date;
  }
  const startD = parseISO(min);
  const endD = parseISO(max);
  const buckets: Bucket[] = [];
  const cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
  while (cur <= endD) {
    const prefix = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
    const total = txs
      .filter((t) => localDateKey(t.date).startsWith(prefix))
      .reduce((s, t) => s + t.amount, 0);
    buckets.push({ label: format(cur, 'MMM').toUpperCase().slice(0, 1), total, dateIso: prefix });
    cur.setMonth(cur.getMonth() + 1);
  }
  return {
    start: localDateKey(startD),
    end: localDateKey(endD),
    label: 'ALL TIME',
    buckets,
    bucketFmt: 'MON',
  };
}

function topMerchants(txs: Transaction[]) {
  const map: Record<string, { name: string; total: number; count: number }> = {};
  for (const t of txs) {
    if (!map[t.merchant]) map[t.merchant] = { name: t.merchant, total: 0, count: 0 };
    map[t.merchant].total += t.amount;
    map[t.merchant].count += 1;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function defaultCustomRange() {
  const now = new Date();
  const startD = startOfMonth(now);
  return {
    start: format(startD, 'yyyy-MM-dd'),
    end: format(now, 'yyyy-MM-dd'),
  };
}

type Props = {
  onOpenCategory: (category: string, txs: import('../db/transactions').Transaction[]) => void;
  onOpenMerchant: (merchant: string, txs: import('../db/transactions').Transaction[]) => void;
};

export function InsightsScreen({ onOpenCategory, onOpenMerchant }: Props) {
  const insets = useSafeAreaInsets();
  const allTxs = useTransactions((s) => s.transactions);
  const customs = useCategories((s) => s.customs);
  const budgets = useBudgets((s) => s.budgets);

  // The bars/totals are spend-only: expense + lent count as spend; income,
  // invest and transfers are excluded (invest is reported separately).
  const txs = useMemo(
    () =>
      allTxs.filter((t) => {
        if (t.category === 'transfer') return false;
        const k = t.kind ?? (t.type === 'credit' ? 'income' : 'expense');
        return k === 'expense' || k === 'lent';
      }),
    [allTxs]
  );

  const [range, setRange] = useState<RangeKey>('M');
  const [{ start: cStart, end: cEnd }, setCustom] = useState(defaultCustomRange);

  const window = useMemo<Window>(() => {
    if (range === '15D') return buildLast15Days(txs);
    if (range === 'W') return buildWeekly(txs);
    if (range === 'M') return buildMonthly(txs);
    if (range === 'Y') return buildYearly(txs);
    if (range === 'A') return buildAllTime(txs);
    return buildCustom(txs, cStart, cEnd);
  }, [txs, range, cStart, cEnd]);

  const { start, end, label, buckets, bucketFmt } = window;
  const total = buckets.reduce((s, b) => s + b.total, 0);
  const activeBuckets = buckets.filter((b) => b.total > 0).length;
  const avg = activeBuckets > 0 ? total / activeBuckets : 0;

  const filtered = useMemo(
    () => txs.filter((t) => txInLocalDateRange(t, start, end)),
    [txs, start, end]
  );

  // Income breakdown for the same window — all txns, classified by kind.
  const kindTotals = useMemo(
    () => sumKinds(allTxs.filter((t) => txInLocalDateRange(t, start, end))),
    [allTxs, start, end]
  );

  const { catSorted, catTotals, catSum } = useMemo(() => {
    const ct: Record<string, number> = {};
    for (const t of filtered) ct[t.category] = (ct[t.category] ?? 0) + t.amount;
    const sorted = Object.keys(ct).sort((a, b) => ct[b] - ct[a]);
    const sum = Object.values(ct).reduce((s, v) => s + v, 0) || 1;
    return { catSorted: sorted, catTotals: ct, catSum: sum };
  }, [filtered]);

  // Per-category budgets vs spend in the current window.
  const categoryBudgets = useMemo(
    () =>
      budgets
        .filter((b) => b.kind === 'category' && b.category)
        .map((b) => ({
          ...b,
          spent: catTotals[b.category as string] ?? 0,
        })),
    [budgets, catTotals]
  );

  const topM = useMemo(() => topMerchants(filtered), [filtered]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: 24,
      }}
      showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 }}>
        <Tag style={{ marginBottom: 4 }}>INSIGHTS</Tag>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <T mono color={C.text3} style={{ fontSize: 26, marginRight: 2 }}>
              ₹
            </T>
            <T
              mono
              style={{
                fontSize: 44,
                lineHeight: 44,
                letterSpacing: -1.3,
                color: C.text,
              }}>
              {Math.round(total / 100).toLocaleString('en-IN')}
            </T>
          </View>
          <T mono color={C.text3} style={{ fontSize: 10, letterSpacing: 1.2 }}>
            {label}
          </T>
        </View>
        <T mono color={C.text3} style={{ fontSize: 11, marginTop: 10, letterSpacing: 0.5 }}>
          AVG {formatAmount(Math.round(avg))}/{bucketFmt} · {filtered.length} TXNS
        </T>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <RangeChips
          value={range}
          onChange={(v) => {
            setRange(v as RangeKey);
          }}
          options={['W', '15D', 'M', 'Y', 'A', 'C']}
        />
        {range === 'C' ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <DateInput
              label="FROM"
              value={cStart}
              onChange={(v) => setCustom((s) => ({ ...s, start: v }))}
            />
            <DateInput
              label="TO"
              value={cEnd}
              onChange={(v) => setCustom((s) => ({ ...s, end: v }))}
            />
          </View>
        ) : null}
      </View>

      {/* Income → invest / spend / saved */}
      {kindTotals.income > 0 || kindTotals.invest > 0 ? (
        <>
          <LabeledRule label="INCOME FLOW" />
          <View style={{ paddingHorizontal: 20 }}>
            <View style={styles.flowWrap}>
              <FlowRow
                label="INCOME"
                value={'+' + formatAmountCompact(kindTotals.income)}
                color="#34C759"
              />
              <FlowRow
                label="SPENT"
                value={formatAmountCompact(kindTotals.expense)}
                color={C.text}
              />
              {kindTotals.invest > 0 ? (
                <FlowRow
                  label="INVESTED"
                  value={formatAmountCompact(kindTotals.invest)}
                  color={C.accent}
                />
              ) : null}
              {kindTotals.lent > 0 ? (
                <FlowRow
                  label="LENT"
                  value={formatAmountCompact(kindTotals.lent)}
                  color={C.text2}
                />
              ) : null}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
              <FlowRow
                label={kindTotals.saved >= 0 ? 'SAVED' : 'OVERSPENT'}
                value={formatAmountCompact(Math.abs(kindTotals.saved))}
                color={kindTotals.saved >= 0 ? '#34C759' : C.danger}
                bold
              />
            </View>
          </View>
        </>
      ) : null}

      {/* Per-category budgets */}
      {categoryBudgets.length > 0 ? (
        <>
          <LabeledRule label="CATEGORY BUDGETS" />
          <View style={{ paddingHorizontal: 20 }}>
            {categoryBudgets.map((b) => {
              const cat = getCategory(b.category as string, customs);
              const pct = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0;
              const over = b.spent > b.amount;
              const left = b.amount - b.spent;
              return (
                <View key={b.id} style={{ marginBottom: 14 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 6,
                    }}>
                    <T style={{ fontSize: 13 }}>{cat.label}</T>
                    <T mono style={{ fontSize: 11, color: C.text2 }}>
                      <T mono style={{ fontSize: 11, color: over ? C.danger : C.text }}>
                        {formatAmount(b.spent)}
                      </T>
                      <T mono style={{ fontSize: 11, color: C.text4 }}>
                        {' / ' + formatAmount(b.amount)}
                      </T>
                    </T>
                  </View>
                  <View
                    style={{
                      height: 5,
                      backgroundColor: C.surface,
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: over ? C.danger : pct > b.alert_pct ? C.danger : C.accent,
                      }}
                    />
                  </View>
                  <T
                    mono
                    color={over ? C.danger : C.text3}
                    style={{ fontSize: 9, marginTop: 4, letterSpacing: 0.5 }}>
                    {over ? `${formatAmount(-left)} OVER` : `${formatAmount(left)} LEFT`}
                  </T>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <LabeledRule
        label="BY CATEGORY"
        right={
          <T mono color={C.text3} style={{ fontSize: 10 }}>
            {catSorted.length}
          </T>
        }
      />

      {catSorted.length === 0 ? (
        <T
          mono
          color={C.text3}
          style={{ fontSize: 11, letterSpacing: 1, paddingVertical: 20, textAlign: 'center' }}>
          NO DATA IN RANGE
        </T>
      ) : (
        <CategoryBars
          catSorted={catSorted}
          catTotals={catTotals}
          catSum={catSum}
          filtered={filtered}
          customs={customs}
          onOpenCategory={onOpenCategory}
        />
      )}

      <LabeledRule
        label="BY MERCHANT"
        right={
          <T mono color={C.text3} style={{ fontSize: 10 }}>
            {topM.length}
          </T>
        }
      />
      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        {topM.map((m, i) => {
          const merchantTxs = filtered.filter((t) => t.merchant === m.name);
          return (
            <Pressable
              key={m.name}
              onPress={() => onOpenMerchant(m.name, merchantTxs)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 10,
                borderBottomWidth: i === topM.length - 1 ? 0 : 1,
                borderBottomColor: C.border,
              }}>
              <T mono color={C.text4} style={{ fontSize: 10, width: 18 }}>
                {String(i + 1).padStart(2, '0')}
              </T>
              <T style={{ flex: 1, fontSize: 13, color: C.text }} numberOfLines={1}>
                {m.name}
              </T>
              <T mono color={C.text3} style={{ fontSize: 10 }}>
                {m.count}×
              </T>
              <T
                mono
                style={{
                  fontSize: 13,
                  minWidth: 70,
                  textAlign: 'right',
                  color: C.text,
                }}>
                {formatAmount(m.total)}
              </T>
            </Pressable>
          );
        })}
        {topM.length === 0 ? (
          <T
            mono
            color={C.text3}
            style={{
              fontSize: 11,
              letterSpacing: 1,
              paddingVertical: 20,
              textAlign: 'center',
            }}>
            NO MERCHANTS IN RANGE
          </T>
        ) : null}
      </View>
    </ScrollView>
  );
}

function FlowRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
      }}>
      <T mono color={C.text3} style={{ fontSize: 10, letterSpacing: 1 }}>
        {label}
      </T>
      <T mono weight={bold ? '700' : '500'} style={{ fontSize: bold ? 16 : 14, color }}>
        {value}
      </T>
    </View>
  );
}

type CategoryBarsProps = {
  catSorted: string[];
  catTotals: Record<string, number>;
  catSum: number;
  filtered: Transaction[];
  customs: import('../lib/categories').Category[];
  onOpenCategory: (category: string, txs: Transaction[]) => void;
};

const BAR_HEIGHT = 160;

function CategoryBars({
  catSorted,
  catTotals,
  catSum,
  filtered,
  customs,
  onOpenCategory,
}: CategoryBarsProps) {
  const maxAmt = catTotals[catSorted[0]] ?? 1;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 6 }}>
      {catSorted.map((c, i) => {
        const amt = catTotals[c];
        const pct = (amt / catSum) * 100;
        const barH = Math.max(4, (amt / maxAmt) * BAR_HEIGHT);
        const cat = getCategory(c, customs);
        const catTxs = filtered.filter((t) => t.category === c);
        const isTop = i === 0;
        return (
          <Pressable key={c} onPress={() => onOpenCategory(c, catTxs)} style={styles.barCol}>
            {/* amount label above bar */}
            <T
              mono
              style={{
                fontSize: 9,
                color: isTop ? C.accent : C.text3,
                textAlign: 'center',
                marginBottom: 4,
                letterSpacing: 0.3,
              }}
              numberOfLines={1}>
              {formatAmount(amt)}
            </T>
            {/* bar */}
            <View style={[styles.barTrack, { height: BAR_HEIGHT }]}>
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: barH,
                  backgroundColor: isTop ? C.accent : C.text4,
                  borderRadius: 2,
                }}
              />
            </View>
            {/* name */}
            <T
              mono
              style={{
                fontSize: 9,
                textAlign: 'center',
                marginTop: 6,
                color: isTop ? C.text : C.text3,
                letterSpacing: 0.3,
              }}
              numberOfLines={2}>
              {cat.label.toUpperCase()}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.dateBox}>
      <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1.2, marginBottom: 2 }}>
        {label}
      </T>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={C.text4}
        style={styles.dateInput}
        selectionColor={C.accent}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dateBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    backgroundColor: C.surface,
  },
  dateInput: {
    color: C.text,
    fontFamily: F.mono,
    fontSize: 11,
    padding: 0,
  },
  barCol: {
    width: 52,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    position: 'relative',
  },
  flowWrap: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
