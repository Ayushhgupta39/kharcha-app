import { useMemo, useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth } from 'date-fns';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { TxRow } from '../components/TxRow';
import { LabeledRule } from '../components/LabeledRule';
import { HeatmapMonth } from '../components/Heatmap';
import { C } from '../lib/tokens';
import { formatAmount, formatAmountCompact } from '../lib/format';
import { accountBalance, sumKinds } from '../lib/portfolio';
import { useTransactions } from '../store/transactions';
import { usePending } from '../store/pending';
import { useBudgets } from '../store/budgets';
import { useCategories } from '../store/categories';
import { useAccounts } from '../store/accounts';
import type { Account } from '../db/accounts';

type Props = {
  onOpenTx: (id: string) => void;
  onOpenPending: () => void;
  onGoTxns: () => void;
  onGoPortfolio: () => void;
  onOpenAccount: (a: Account) => void;
  onOpenSettings: () => void;
};

export function HomeScreen({
  onOpenTx,
  onOpenPending,
  onGoTxns,
  onGoPortfolio,
  onOpenAccount,
  onOpenSettings,
}: Props) {
  const insets = useSafeAreaInsets();
  const txs = useTransactions((s) => s.transactions);
  const pendingCount = usePending((s) => s.count);
  const budgets = useBudgets((s) => s.budgets);
  const customs = useCategories((s) => s.customs);
  const accounts = useAccounts((s) => s.accounts);

  // Show favorited accounts on Home; if none are starred, fall back to the
  // first two added so the strip isn't empty once any account exists.
  const homeAccounts = useMemo(() => {
    const favs = accounts.filter((a) => a.favorite);
    return favs.length ? favs : accounts.slice(0, 2);
  }, [accounts]);

  const now = useMemo(() => new Date(), []);
  const todayDay = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // The month shown in the heatmap and its detail box. Defaults to the current
  // month; the rest of the screen (hero, budget, summary) stays pinned to now.
  const [viewMonth, setViewMonth] = useState<number>(month);
  const [viewYear, setViewYear] = useState<number>(year);
  const isCurrentMonth = viewMonth === month && viewYear === year;

  const [selectedDay, setSelectedDay] = useState<number>(todayDay);

  const onChangeMonth = (m: number, y: number) => {
    setViewMonth(m);
    setViewYear(y);
    // Land on today when returning to the current month, else day 1.
    if (m === month && y === year) {
      setSelectedDay(todayDay);
    } else {
      setSelectedDay(1);
    }
  };

  const {
    todayTotal,
    monthExpense,
    monthInvest,
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

    // Spend = expense + lent only; invest is a debit too but reported apart
    // (mirrors Insights). `sumKinds` drops transfers and classifies by kind.
    const spendOf = (list: typeof txs) => {
      const k = sumKinds(list);
      return k.expense + k.lent;
    };

    const inMonth = txs.filter((t) => t.date >= monthStart && t.date <= monthEnd);
    const monthKinds = sumKinds(inMonth);
    const monthExpense = monthKinds.expense + monthKinds.lent;
    const monthInvest = monthKinds.invest;
    const monthIncome = monthKinds.income;
    const todayTotal = spendOf(inMonth.filter((t) => t.date >= todayStart && t.date <= todayEndIso));
    const yesterdayTotal = spendOf(inMonth.filter((t) => t.date >= yStart && t.date <= yEnd));
    const monthAvg = monthExpense / todayDay;
    const selectedDayTxs = txs.filter((t) => {
      const d = new Date(t.date);
      return (
        d.getFullYear() === viewYear &&
        d.getMonth() + 1 === viewMonth &&
        d.getDate() === selectedDay
      );
    });
    const selectedDayDebit = spendOf(selectedDayTxs);
    const selectedDayCredit = selectedDayTxs
      .filter((t) => t.type === 'credit')
      .reduce((s, t) => s + t.amount, 0);
    return {
      todayTotal,
      monthExpense,
      monthInvest,
      monthIncome,
      selectedDayTxs,
      selectedDayDebit,
      selectedDayCredit,
      yesterdayTotal,
      monthAvg,
    };
  }, [txs, selectedDay, now, todayDay, viewMonth, viewYear]);

  const overallBudget = budgets.find((b) => b.kind === 'overall');
  const budgetAmount = overallBudget?.amount ?? 0;
  const budgetPct = budgetAmount ? Math.min(100, (monthExpense / budgetAmount) * 100) : 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - todayDay);
  const dailyBurn = budgetAmount ? Math.max(0, (budgetAmount - monthExpense) / daysLeft) : 0;

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={onOpenPending} style={styles.pendingBtn}>
            <Icon name="bell" size={14} color={C.text2} />
            {pendingCount > 0 ? (
              <>
                <T mono weight="600" color={C.accent} style={{ fontSize: 10 }}>
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
          <Pressable onPress={onOpenSettings} style={styles.gearBtn}>
            <Icon name="settings" size={15} color={C.text2} />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <View style={styles.heroMeta}>
          <Tag>
            {isCurrentMonth && selectedDay === todayDay
              ? `TODAY · ${format(now, 'd MMM').toUpperCase()}`
              : format(new Date(viewYear, viewMonth - 1, selectedDay), 'd MMM').toUpperCase()}
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
          {isCurrentMonth && selectedDay === todayDay && yesterdayTotal > 0 ? (
            <View style={[styles.deltaPill, { borderColor: deltaColor }]}>
              <T mono weight="600" color={deltaColor} style={{ fontSize: 10 }}>
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
            <Tag>{format(now, 'MMMM').toUpperCase()} BUDGET</Tag>
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
          invest={monthInvest}
        />
      </View>

      {homeAccounts.length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <View style={styles.acctHeader}>
            <Tag>ACCOUNTS</Tag>
            <Pressable onPress={onGoPortfolio} hitSlop={8}>
              <T mono color={C.text2} style={{ fontSize: 10, letterSpacing: 1.2 }}>
                SHOW ALL →
              </T>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {homeAccounts.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                balance={accountBalance(a, txs)}
                onPress={() => onOpenAccount(a)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: 28 }}>
        <View style={styles.heatHeader}>
          <Tag>{format(new Date(viewYear, viewMonth - 1, 1), 'MMMM').toUpperCase()} · HEAT</Tag>
          <T mono color={C.text3} style={{ fontSize: 10 }}>
            TAP A DAY
          </T>
        </View>
        <HeatmapMonth
          month={viewMonth}
          year={viewYear}
          todayDay={isCurrentMonth ? todayDay : null}
          txs={txs}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onChangeMonth={onChangeMonth}
        />

        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <View style={styles.selBox}>
            <View style={[styles.selHeader, { marginBottom: 0 }]}>
              <T mono weight="600" style={{ fontSize: 11, letterSpacing: 1 }}>
                {format(new Date(viewYear, viewMonth - 1, selectedDay), 'MMM').toUpperCase()}{' '}
                {String(selectedDay).padStart(2, '0')}
                {isCurrentMonth && selectedDay === todayDay ? (
                  <T mono weight="600" color={C.accent} style={{ fontSize: 11, marginLeft: 8 }}>
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
        label={
          isCurrentMonth && selectedDay === todayDay
            ? 'TODAY'
            : format(new Date(viewYear, viewMonth - 1, selectedDay), 'd MMM').toUpperCase()
        }
        right={
          <Pressable onPress={onGoTxns}>
            <T mono color={C.text2} style={{ fontSize: 10, letterSpacing: 1.2 }}>
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
          selectedDayTxs
            .slice(0, 4)
            .map((t) => (
              <TxRow key={t.id} tx={t} onPress={() => onOpenTx(t.id)} customs={customs} />
            ))
        )}
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function AccountCard({
  account,
  balance,
  onPress,
}: {
  account: Account;
  balance: number;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const negative = balance < 0;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{ ...acctStyles.card, backgroundColor: pressed ? C.surface2 : C.surface }}>
      <View style={acctStyles.glyph}>
        <Icon name={account.type === 'card' ? 'card' : 'bank'} size={16} color={C.text2} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T weight="500" style={{ fontSize: 13 }} numberOfLines={1}>
            {account.name}
          </T>
          {account.favorite ? <Icon name="star" size={11} color={C.accent} filled /> : null}
        </View>
        <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1, marginTop: 3 }}>
          {account.type === 'card' ? 'CARD' : 'BANK'}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T mono weight="600" style={{ fontSize: 15, color: negative ? C.danger : C.text }}>
          {negative ? '−' : ''}
          {formatAmountCompact(Math.abs(balance))}
        </T>
        <T mono color={C.text4} style={{ fontSize: 9, marginTop: 2, letterSpacing: 1 }}>
          BALANCE
        </T>
      </View>
    </Pressable>
  );
}

const acctStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    padding: 14,
  },
  glyph: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
});

function MonthSummary({
  month,
  income,
  expense,
  invest,
}: {
  month: string;
  income: number;
  expense: number;
  invest: number;
}) {
  // Saved = income minus everything that left the account (spend + invest).
  const net = income - expense - invest;
  const isPositive = net >= 0;
  return (
    <View style={summaryStyles.wrap}>
      <View style={summaryStyles.row}>
        <View style={summaryStyles.col}>
          <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
            {month} INCOME
          </T>
          <T
            mono
            weight="600"
            style={{ fontSize: 16, color: '#34C759' }}
            adjustsFontSizeToFit
            numberOfLines={1}>
            +{formatAmountCompact(income)}
          </T>
        </View>
        <View style={summaryStyles.divider} />
        <View style={summaryStyles.col}>
          <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
            {month} SPENT
          </T>
          <T
            mono
            weight="600"
            style={{ fontSize: 16, color: C.text }}
            adjustsFontSizeToFit
            numberOfLines={1}>
            {formatAmountCompact(expense)}
          </T>
        </View>
        <View style={summaryStyles.divider} />
        <View style={[summaryStyles.col, { alignItems: 'flex-end' }]}>
          <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
            {isPositive ? 'SAVED' : 'OVERSPENT'}
          </T>
          <T
            mono
            weight="600"
            style={{ fontSize: 16, color: isPositive ? '#34C759' : C.danger }}
            adjustsFontSizeToFit
            numberOfLines={1}>
            {formatAmountCompact(Math.abs(net))}
          </T>
        </View>
      </View>
      {invest > 0 ? (
        <>
          <View style={summaryStyles.hDivider} />
          <View style={summaryStyles.investRow}>
            <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1 }}>
              {month} INVESTED
            </T>
            <T mono weight="600" style={{ fontSize: 13, color: C.accent }}>
              {formatAmountCompact(invest)}
            </T>
          </View>
        </>
      ) : null}
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
  hDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  investRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  gearBtn: {
    borderWidth: 1,
    borderColor: C.border2,
    padding: 7,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  acctHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
