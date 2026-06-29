import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { TxRow } from '../components/TxRow';
import { C, F } from '../lib/tokens';
import { formatAmount } from '../lib/format';
import { useTransactions } from '../store/transactions';
import { useCategories } from '../store/categories';

type Source = 'all' | 'sms' | 'manual';

type Props = {
  onOpenTx: (id: string) => void;
};

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayHeader(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'TODAY';
  if (isYesterday(d)) return 'YESTERDAY';
  return format(d, 'EEE, d MMM').toUpperCase();
}

type ListItem =
  | { kind: 'header'; key: string; label: string; debit: number; credit: number }
  | { kind: 'row'; key: string; tx: import('../db/transactions').Transaction };

export function LedgerScreen({ onOpenTx }: Props) {
  const insets = useSafeAreaInsets();
  const txs = useTransactions((s) => s.transactions);
  const customs = useCategories((s) => s.customs);
  const cats = useCategories((s) => s.all);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [source, setSource] = useState<Source>('all');

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (filterCat && t.category !== filterCat) return false;
      if (source !== 'all' && t.source !== source) return false;
      if (search && !t.merchant.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [txs, search, filterCat, source]);

  const totalDebit = filtered.filter((t) => t.type !== 'credit').reduce((s, t) => s + t.amount, 0);
  const totalCredit = filtered.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);

  const items: ListItem[] = useMemo(() => {
    const grouped: Record<string, typeof filtered> = {};
    for (const t of filtered) {
      const k = localDateKey(t.date);
      (grouped[k] ??= []).push(t);
    }
    const days = Object.keys(grouped).sort().reverse();
    const out: ListItem[] = [];
    for (const d of days) {
      const dayTxs = grouped[d];
      const dayDebit = dayTxs.filter((t) => t.type !== 'credit').reduce((s, t) => s + t.amount, 0);
      const dayCredit = dayTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
      out.push({
        kind: 'header',
        key: 'h-' + d,
        label: dayHeader(dayTxs[0].date),
        debit: dayDebit,
        credit: dayCredit,
      });
      for (const t of dayTxs) out.push({ kind: 'row', key: t.id, tx: t });
    }
    return out;
  }, [filtered]);

  // Category chip counts
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of txs) m[t.category] = (m[t.category] ?? 0) + 1;
    return m;
  }, [txs]);
  const topCats = useMemo(() => {
    const INCOME_CATS = new Set([
      'salary',
      'freelance',
      'refund',
      'investment',
      'rental',
      'income_other',
    ]);
    return Object.keys(catCounts).sort((a, b) => {
      const aIncome = INCOME_CATS.has(a);
      const bIncome = INCOME_CATS.has(b);
      const aOther = a === 'other' || a === 'income_other';
      const bOther = b === 'other' || b === 'income_other';
      if (aIncome !== bIncome) return aIncome ? -1 : 1;
      if (aOther !== bOther) return aOther ? 1 : -1;
      return catCounts[b] - catCounts[a];
    });
  }, [catCounts]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 14,
          }}>
          <View>
            <Tag style={{ marginBottom: 4 }}>LEDGER</Tag>
            <T mono style={{ fontSize: 26, letterSpacing: -0.6 }}>
              {formatAmount(totalDebit)}
            </T>
            {totalCredit > 0 ? (
              <T mono style={{ fontSize: 13, color: '#34C759', marginTop: 2 }}>
                +{formatAmount(totalCredit)}
              </T>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T mono color={C.text3} style={{ fontSize: 10, marginBottom: 2 }}>
              SHOWING
            </T>
            <T mono color={C.text2} style={{ fontSize: 14 }}>
              {filtered.length}{' '}
              <T mono color={C.text4} style={{ fontSize: 14 }}>
                / {txs.length}
              </T>
            </T>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Icon name="search" size={14} color={C.text3} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search merchant…"
            placeholderTextColor={C.text3}
            style={styles.searchInput}
            selectionColor={C.accent}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Icon name="x" size={14} color={C.text3} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.toggleRow}>
        {(
          [
            ['all', 'ALL'],
            ['sms', 'SMS'],
            ['manual', 'MANUAL'],
          ] as [Source, string][]
        ).map(([k, l], i) => {
          const active = source === k;
          return (
            <Pressable
              key={k}
              onPress={() => setSource(k)}
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: active ? C.surface : 'transparent',
                  borderLeftWidth: i === 0 ? 0 : 1,
                  borderLeftColor: C.border,
                  borderBottomColor: active ? C.accent : 'transparent',
                },
              ]}>
              <T
                mono
                weight="500"
                color={active ? C.text : C.text3}
                style={{ fontSize: 11, letterSpacing: 1 }}>
                {l}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={{ borderBottomWidth: 1, borderBottomColor: C.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            gap: 6,
          }}>
          <Pressable
            onPress={() => setFilterCat(null)}
            style={[
              styles.chip,
              {
                backgroundColor: filterCat === null ? C.text : 'transparent',
                borderColor: filterCat === null ? C.text : C.border2,
              },
            ]}>
            <T
              mono
              weight="500"
              color={filterCat === null ? '#0A0A0A' : C.text2}
              style={{ fontSize: 10, letterSpacing: 1 }}>
              ALL
            </T>
          </Pressable>
          {topCats.map((c) => {
            const active = filterCat === c;
            const cat = cats.find((x) => x.key === c);
            const rawLabel = cat?.label.split(' ')[0].toUpperCase() ?? c.toUpperCase();
            const label = rawLabel === 'INCOME' ? 'CREDIT' : rawLabel;
            return (
              <Pressable
                key={c}
                onPress={() => setFilterCat(active ? null : c)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? C.accent : 'transparent',
                    borderColor: active ? C.accent : C.border2,
                  },
                ]}>
                <T
                  mono
                  weight="500"
                  color={active ? '#0A0A0A' : C.text2}
                  style={{ fontSize: 10, letterSpacing: 1 }}>
                  {label}
                </T>
                <T mono color={active ? '#0A0A0A' : C.text2} style={{ fontSize: 10, opacity: 0.6 }}>
                  {catCounts[c]}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <View style={styles.dayHeader}>
                <Tag>{item.label}</Tag>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <T mono color={C.text2} style={{ fontSize: 11 }}>
                    {formatAmount(item.debit)}
                  </T>
                  {item.credit > 0 ? (
                    <T mono style={{ fontSize: 10, color: '#34C759' }}>
                      +{formatAmount(item.credit)}
                    </T>
                  ) : null}
                </View>
              </View>
            );
          }
          return <TxRow tx={item.tx} onPress={() => onOpenTx(item.tx.id)} customs={customs} />;
        }}
        ListEmptyComponent={
          <View style={{ padding: 40 }}>
            <T mono color={C.text3} style={{ fontSize: 11, textAlign: 'center', letterSpacing: 1 }}>
              NO MATCHES
            </T>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: C.border2,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 2,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontFamily: F.inter,
    fontSize: 13,
    padding: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.bg,
  },
});
