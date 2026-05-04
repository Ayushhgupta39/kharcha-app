import { useMemo, useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { TxRow } from '../components/TxRow';
import { LabeledRule } from '../components/LabeledRule';
import { HeatmapMonth } from '../components/Heatmap';
import { C } from '../lib/tokens';
import { formatAmount, formatAmountCompact } from '../lib/format';
import { useTransactions } from '../store/transactions';
import { usePending } from '../store/pending';
import { useBudgets } from '../store/budgets';
import { useCategories } from '../store/categories';

type Props = {
  onOpenTx: (id: string) => void;
  onOpenPending: () => void;
  onGoTxns: () => void;
};

export function HomeScreen({ onOpenTx, onOpenPending, onGoTxns }: Props) {
  const insets = useSafeAreaInsets();
  const txs = useTransactions((s) => s.transactions);
  const pendingCount = usePending((s) => s.count);
  const budgets = useBudgets((s) => s.budgets);
  const customs = useCategories((s) => s.customs);

  const now = useMemo(() => new Date(), []);
  const todayDay = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [selectedDay, setSelectedDay] = useState<number>(todayDay);

  const {
    todayTotal,
    monthExpense,
    monthIncome,
    selectedDayTxs,
    selectedDayDebit,
    selectedDayCredit,
    yesterdayTotal,
    monthAvg,
  } = useMemo(() => {
    const todayStart = startOfDay(now).toISOString();
    const todayEndIso = endOfDay(now).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yStart = startOfDay(yest).toISOString();
    const yEnd = endOfDay(yest).toISOString();

    const inMonth = txs.filter(
      (t) => t.date >= monthStart && t.date <= monthEnd
    );
    const inMonthDebits = inMonth.filter((t) => t.type !== 'credit' && t.category !== 'transfer');
    const inMonthCredits = inMonth.filter((t) => t.type === 'credit');
    const todayDebits = inMonthDebits.filter((t) => t.date >= todayStart && t.date <= todayEndIso);
    const yesterdayDebits = inMonthDebits.filter((t) => t.date >= yStart && t.date <= yEnd);
    const monthExpense = inMonthDebits.reduce((s, t) => s + t.amount, 0);
    const monthIncome = inMonthCredits.reduce((s, t) => s + t.amount, 0);
    const todayTotal = todayDebits.reduce((s, t) => s + t.amount, 0);
    const yesterdayTotal = yesterdayDebits.reduce((s, t) => s + t.amount, 0);
    const monthAvg = monthExpense / todayDay;
    const selectedDayTxs = inMonth.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === selectedDay;
    });
    const selectedDayDebit = selectedDayTxs.filter((t) => t.type !== 'credit' && t.category !== 'transfer').reduce((s, t) => s + t.amount, 0);
    const selectedDayCredit = selectedDayTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    return {
      todayTotal,
      monthExpense,
      monthIncome,
      selectedDayTxs,
      selectedDayDebit,
      selectedDayCredit,
      yesterdayTotal,
      monthAvg,
    };
  }, [txs, selectedDay, now, month, year, todayDay]);

  const overallBudget = budgets.find((b) => b.kind === 'overall');
  const budgetAmount = overallBudget?.amount ?? 0;
  const budgetPct = budgetAmount
    ? Math.min(100, (monthExpense / budgetAmount) * 100)
    : 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - todayDay);
  const dailyBurn = budgetAmount
    ? Math.max(0, (budgetAmount - monthExpense) / daysLeft)
    : 0;

  const deltaDiff = todayTotal - yesterdayTotal;
  const deltaColor = deltaDiff <= 0 ? C.accent : C.danger;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.logoSquare}>
            <T mono weight="700" style={{ color: '#0A0A0A', fontSize: 13 }}>
              K
            </T>
          </View>
          <T mono weight="600" style={{ fontSize: 11, letterSpacing: 1.3 }}>
            KHARCHA
          </T>
        </View>
        <Pressable onPress={onOpenPending} style={styles.pendingBtn}>
          <Icon name="bell" size={14} color={C.text2} />
          {pendingCount > 0 ? (
            <>
              <T
                mono
                weight="600"
                color={C.accent}
                style={{ fontSize: 10 }}>
                {pendingCount} PENDING
              </T>
              <View style={styles.pulseDot} />
            </>
          ) : (
            <T mono color={C.text3} style={{ fontSize: 10 }}>
              ALL CLEAR
            </T>
          )}
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <View style={styles.heroMeta}>
          <Tag>
            {selectedDay === todayDay
              ? `TODAY · ${format(now, 'd MMM').toUpperCase()}`
              : format(new Date(year, month - 1, selectedDay), 'd MMM').toUpperCase()}
          </Tag>
          <T mono color={C.text3} style={{ fontSize: 10 }}>
            {selectedDayTxs.length} TXNS
          </T>
        </View>
        <T
          mono
          style={{
            fontSize: 64,
            lineHeight: 64,
            letterSpacing: -1.8,
            color: C.text,
          }}
          adjustsFontSizeToFit
          numberOfLines={1}>
          {formatAmountCompact(selectedDayDebit)}
        </T>
        <View style={styles.heroFoot}>
          {selectedDay === todayDay && yesterdayTotal > 0 ? (
            <View
              style={[
                styles.deltaPill,
                { borderColor: deltaColor },
              ]}>
              <T
                mono
                weight="600"
                color={deltaColor}
                style={{ fontSize: 10 }}>
                {deltaDiff > 0 ? '+' : deltaDiff < 0 ? '−' : ''}
                {formatAmountCompact(Math.abs(deltaDiff))} VS YESTERDAY
              </T>
            </View>
          ) : null}
          <T mono color={C.text3} style={{ fontSize: 10 }}>
            AVG {formatAmount(Math.round(monthAvg))}/DAY
          </T>
        </View>
      </View>

      {budgetAmount > 0 ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <View style={styles.budgetMeta}>
            <Tag>
              {format(now, 'MMMM').toUpperCase()} BUDGET
            </Tag>
            <T mono style={{ fontSize: 11, color: C.text2 }}>
              <T mono color={C.text} style={{ fontSize: 11 }}>
                {formatAmountCompact(monthExpense)}
              </T>
              <T mono color={C.text4} style={{ fontSize: 11 }}>
                {' / '}
                {formatAmountCompact(budgetAmount)}
              </T>
            </T>
          </View>
          <View style={styles.budgetBar}>
            <View
              style={{
                height: '100%',
                width: `${budgetPct}%`,
                backgroundColor: budgetPct > 85 ? C.danger : C.accent,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: -4,
                bottom: -4,
                left: `${(todayDay / daysInMonth) * 100}%`,
                width: 1,
                backgroundColor: C.text2,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 6,
            }}>
            <T mono color={C.text3} style={{ fontSize: 10 }}>
              {Math.round(budgetPct)}% USED
            </T>
            <T mono color={C.text3} style={{ fontSize: 10 }}>
              {formatAmount(Math.round(dailyBurn))}/DAY LEFT · {daysLeft}D
            </T>
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <View style={styles.noBudget}>
            <T color={C.text2} style={{ fontSize: 12 }}>
              No budget set
            </T>
            <T mono color={C.text3} style={{ fontSize: 10 }}>
              SETTINGS → BUDGET
            </T>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <MonthSummary
          month={format(now, 'MMMM').toUpperCase()}
          income={monthIncome}
          expense={monthExpense}
        />
      </View>

      <View style={{ marginTop: 28 }}>
        <View style={styles.heatHeader}>
          <Tag>
            {format(now, 'MMMM').toUpperCase()} · HEAT
          </Tag>
          <T mono color={C.text3} style={{ fontSize: 10 }}>
            TAP A DAY
          </T>
        </View>
        <HeatmapMonth
          month={month}
          year={year}
          todayDay={todayDay}
          txs={txs}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />

        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <View style={styles.selBox}>
            <View style={[styles.selHeader, { marginBottom: 0 }]}>
              <T
                mono
                weight="600"
                style={{ fontSize: 11, letterSpacing: 1 }}>
                {format(new Date(year, month - 1, selectedDay), 'MMM').toUpperCase()}{' '}
                {String(selectedDay).padStart(2, '0')}
                {selectedDay === todayDay ? (
                  <T
                    mono
                    weight="600"
                    color={C.accent}
                    style={{ fontSize: 11, marginLeft: 8 }}>
                    {'  '}TODAY
                  </T>
                ) : null}
              </T>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <T mono style={{ fontSize: 18, color: C.text }}>
                  {formatAmount(selectedDayDebit)}
                </T>
                {selectedDayCredit > 0 ? (
                  <>
                    <T mono style={{ fontSize: 11, color: '#34C759' }}>
                      +{formatAmount(selectedDayCredit)} IN
                    </T>
                    {selectedDayCredit > selectedDayDebit ? (
                      <T mono style={{ fontSize: 10, color: '#34C759', letterSpacing: 0.5 }}>
                        +{formatAmount(selectedDayCredit - selectedDayDebit)} SAVED
                      </T>
                    ) : (
                      <T mono style={{ fontSize: 10, color: C.text3, letterSpacing: 0.5 }}>
                        {formatAmount(selectedDayDebit - selectedDayCredit)} NET
                      </T>
                    )}
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </View>

      <LabeledRule
        label={selectedDay === todayDay ? 'TODAY' : format(new Date(year, month - 1, selectedDay), 'd MMM').toUpperCase()}
        right={
          <Pressable onPress={onGoTxns}>
            <T
              mono
              color={C.text2}
              style={{ fontSize: 10, letterSpacing: 1.2 }}>
              ALL →
            </T>
          </Pressable>
        }
      />
      <View>
        {selectedDayTxs.length === 0 && txs.length === 0 ? (
          <View style={{ padding: 24 }}>
            <T mono color={C.text3} style={{ fontSize: 11, textAlign: 'center' }}>
              NOTHING YET · TAP + TO ADD AN EXPENSE
            </T>
          </View>
        ) : selectedDayTxs.length === 0 ? (
          <View style={{ padding: 24 }}>
            <T mono color={C.text3} style={{ fontSize: 11, textAlign: 'center' }}>
              NO TRANSACTIONS THIS DAY
            </T>
          </View>
        ) : (
          selectedDayTxs.slice(0, 4).map((t) => (
            <TxRow
              key={t.id}
              tx={t}
              onPress={() => onOpenTx(t.id)}
              customs={customs}
            />
          ))
        )}
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function MonthSummary({ month, income, expense }: { month: string; income: number; expense: number }) {
  const net = income - expense;
  const isPositive = net >= 0;
  return (
    <View style={summaryStyles.wrap}>
      <View style={summaryStyles.row}>
        <View style={summaryStyles.col}>
          <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
            {month} INCOME
          </T>
          <T mono weight="600" style={{ fontSize: 16, color: '#34C759' }} adjustsFontSizeToFit numberOfLines={1}>
            +{formatAmountCompact(income)}
          </T>
        </View>
        <View style={summaryStyles.divider} />
        <View style={summaryStyles.col}>
          <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
            {month} SPENT
          </T>
          <T mono weight="600" style={{ fontSize: 16, color: C.text }} adjustsFontSizeToFit numberOfLines={1}>
            {formatAmountCompact(expense)}
          </T>
        </View>
        <View style={summaryStyles.divider} />
        <View style={[summaryStyles.col, { alignItems: 'flex-end' }]}>
          <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
            {isPositive ? 'SAVED' : 'OVERSPENT'}
          </T>
          <T mono weight="600" style={{ fontSize: 16, color: isPositive ? '#34C759' : C.danger }} adjustsFontSizeToFit numberOfLines={1}>
            {formatAmountCompact(Math.abs(net))}
          </T>
        </View>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 2,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  col: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: C.border,
    marginHorizontal: 12,
  },
});

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoSquare: {
    width: 22,
    height: 22,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  pendingBtn: {
    borderWidth: 1,
    borderColor: C.border2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 2,
  },
  pulseDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 6,
    height: 6,
    backgroundColor: C.accent,
    borderRadius: 3,
  },
  heroMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  deltaPill: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  budgetMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  budgetBar: {
    height: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 1,
    overflow: 'visible',
    position: 'relative',
  },
  noBudget: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    borderRadius: 2,
  },
  heatHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selBox: {
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    backgroundColor: C.surface,
    borderRadius: 2,
  },
  selHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
});
