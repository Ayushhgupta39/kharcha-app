import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tag } from '../components/Text';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { RangeChips } from '../components/RangeChips';
import { MiniBars, type Bucket } from '../components/MiniBars';
import { LabeledRule } from '../components/LabeledRule';
import { C, F } from '../lib/tokens';
import { formatAmount } from '../lib/format';
import { getCategory } from '../lib/categories';
import { useTransactions } from '../store/transactions';
import { useCategories } from '../store/categories';
import { format, parseISO, subDays, startOfMonth, endOfMonth } from 'date-fns';
import type { Transaction } from '../db/transactions';

type RangeKey = 'D' | 'W' | 'M' | 'Y' | 'C';

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

function buildDaily(txs: Transaction[], n: number): Window {
  const now = new Date();
  const buckets: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = subDays(now, i);
    const iso = localDateKey(d);
    const total = txs
      .filter((t) => txMatchesLocalDate(t, iso))
      .reduce((s, t) => s + t.amount, 0);
    buckets.push({ label: format(d, 'dd'), total, dateIso: iso });
  }
  return {
    start: buckets[0].dateIso!,
    end: buckets[buckets.length - 1].dateIso!,
    label: `LAST ${n} DAYS`,
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
    const total = txs
      .filter((t) => txMatchesLocalDate(t, iso))
      .reduce((s, t) => s + t.amount, 0);
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
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
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
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  );
  const buckets: Bucket[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = localDateKey(d);
    const total = txs
      .filter((t) => txMatchesLocalDate(t, iso))
      .reduce((s, t) => s + t.amount, 0);
    buckets.push({
      label: days <= 14 ? format(d, 'dd') : d.getDate() === 1 || i === 0 ? String(d.getDate()) : '',
      total,
      dateIso: iso,
    });
  }
  return { start: s, end: e, label: 'CUSTOM RANGE', buckets, bucketFmt: 'DAY' };
}

function topMerchants(txs: Transaction[]) {
  const map: Record<string, { name: string; total: number; count: number }> = {};
  for (const t of txs) {
    if (!map[t.merchant])
      map[t.merchant] = { name: t.merchant, total: 0, count: 0 };
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

  // Insights is expenses-only: exclude credits and transfers
  const txs = useMemo(
    () => allTxs.filter((t) => t.type !== 'credit' && t.category !== 'transfer'),
    [allTxs]
  );

  const [range, setRange] = useState<RangeKey>('M');
  const [{ start: cStart, end: cEnd }, setCustom] = useState(defaultCustomRange);
  const [selBar, setSelBar] = useState<number | null>(null);

  const window = useMemo<Window>(() => {
    if (range === 'D') return buildDaily(txs, 7);
    if (range === 'W') return buildDaily(txs, 14);
    if (range === 'M') return buildMonthly(txs);
    if (range === 'Y') return buildYearly(txs);
    return buildCustom(txs, cStart, cEnd);
  }, [txs, range, cStart, cEnd]);

  const { start, end, label, buckets, bucketFmt } = window;
  const total = buckets.reduce((s, b) => s + b.total, 0);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const activeBuckets = buckets.filter((b) => b.total > 0).length;
  const avg = activeBuckets > 0 ? total / activeBuckets : 0;

  const filtered = useMemo(
    () => txs.filter((t) => txInLocalDateRange(t, start, end)),
    [txs, start, end]
  );

  const { catSorted, catTotals, catSum } = useMemo(() => {
    const ct: Record<string, number> = {};
    for (const t of filtered) ct[t.category] = (ct[t.category] ?? 0) + t.amount;
    const sorted = Object.keys(ct).sort((a, b) => ct[b] - ct[a]);
    const sum = Object.values(ct).reduce((s, v) => s + v, 0) || 1;
    return { catSorted: sorted, catTotals: ct, catSum: sum };
  }, [filtered]);

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
          <T
            mono
            color={C.text3}
            style={{ fontSize: 10, letterSpacing: 1.2 }}>
            {label}
          </T>
        </View>
        <T
          mono
          color={C.text3}
          style={{ fontSize: 11, marginTop: 10, letterSpacing: 0.5 }}>
          AVG {formatAmount(Math.round(avg))}/{bucketFmt} · {filtered.length} TXNS
        </T>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <RangeChips
          value={range}
          onChange={(v) => {
            setRange(v as RangeKey);
            setSelBar(null);
          }}
          options={['D', 'W', 'M', 'Y', 'C']}
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

      <View style={{ marginTop: 22 }}>
        <View
          style={{
            paddingHorizontal: 20,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}>
          <Tag>DISTRIBUTION</Tag>
          {selBar !== null && buckets[selBar] ? (
            <T mono style={{ fontSize: 10 }}>
              {buckets[selBar].label}
              {buckets[selBar].dateIso
                ? ' · ' + format(parseISO(buckets[selBar].dateIso!), 'd MMM').toUpperCase()
                : ''}{' '}
              <T mono color={C.accent} style={{ fontSize: 10 }}>
                {formatAmount(buckets[selBar].total)}
              </T>
            </T>
          ) : null}
        </View>
        <MiniBars
          days={buckets}
          selectedIdx={selBar}
          onSelect={setSelBar}
          height={140}
        />
        <View
          style={{
            paddingHorizontal: 20,
            marginTop: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}>
          <T mono color={C.text4} style={{ fontSize: 10 }}>
            PEAK {formatAmount(max)}
          </T>
          <T mono color={C.text4} style={{ fontSize: 10 }}>
            {activeBuckets}/{buckets.length} ACTIVE
          </T>
        </View>
      </View>

      <LabeledRule
        label="BY CATEGORY"
        right={
          <T mono color={C.text3} style={{ fontSize: 10 }}>
            {catSorted.length}
          </T>
        }
      />
      <View style={{ paddingHorizontal: 20 }}>
        {catSorted.map((c, i) => {
          const amt = catTotals[c];
          const pct = (amt / catSum) * 100;
          const cat = getCategory(c, customs);
          const catTxs = filtered.filter((t) => t.category === c);
          const txCount = catTxs.length;
          const isLast = i === catSorted.length - 1;
          return (
            <Pressable
              key={c}
              onPress={() => onOpenCategory(c, catTxs)}
              style={{
                paddingBottom: 14,
                marginBottom: 14,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: C.border,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                }}>
                <CategoryGlyph category={c} size={28} customs={customs} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={{ fontSize: 13, color: C.text }}>{cat.label}</T>
                  <T mono color={C.text3} style={{ fontSize: 10, marginTop: 2 }}>
                    {txCount} TXNS · {pct.toFixed(1)}%
                  </T>
                </View>
                <T mono style={{ fontSize: 14, color: C.text }}>
                  {formatAmount(amt)}
                </T>
              </View>
              <View
                style={{
                  height: 2,
                  backgroundColor: C.border,
                  borderRadius: 1,
                  overflow: 'hidden',
                }}>
                <View
                  style={{
                    height: '100%',
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: i === 0 ? C.accent : C.text2,
                  }}
                />
              </View>
            </Pressable>
          );
        })}
        {catSorted.length === 0 ? (
          <T
            mono
            color={C.text3}
            style={{
              fontSize: 11,
              letterSpacing: 1,
              paddingVertical: 20,
              textAlign: 'center',
            }}>
            NO DATA IN RANGE
          </T>
        ) : null}
      </View>

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
      <T
        mono
        color={C.text3}
        style={{ fontSize: 9, letterSpacing: 1.2, marginBottom: 2 }}>
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
});
