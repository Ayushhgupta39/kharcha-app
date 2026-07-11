import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { C, F } from '../lib/tokens';
import { formatAmountCompact } from '../lib/format';
import { sumKinds, inRange, accountBalance, type KindTotals } from '../lib/portfolio';
import { useTransactions } from '../store/transactions';
import { useAccounts } from '../store/accounts';
import { useSettings } from '../store/settings';
import type { Account, AccountType } from '../db/accounts';

type Props = {
  onOpenAccount: (a: Account) => void;
  onOpenSettings: () => void;
};

export function PortfolioScreen({ onOpenAccount, onOpenSettings }: Props) {
  const insets = useSafeAreaInsets();
  const txs = useTransactions((s) => s.transactions);
  const accounts = useAccounts((s) => s.accounts);
  const addAccount = useAccounts((s) => s.add);
  const setFav = useAccounts((s) => s.setFav);
  const defaultAccountId = useSettings((s) => s.defaultAccountId);
  const setDefaultAccountId = useSettings((s) => s.setDefaultAccountId);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [notes, setNotes] = useState('');

  const now = useMemo(() => new Date(), []);
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  // Period toggle for the per-account analytics ('month' | 'all').
  const [period, setPeriod] = useState<'month' | 'all'>('month');

  // Transactions in the active period, reused by every breakdown below.
  const periodTxs = useMemo(
    () => (period === 'month' ? txs.filter((t) => inRange(t, monthStart, monthEnd)) : txs),
    [period, txs, monthStart, monthEnd]
  );

  // Combined totals across all accounts for the active period (grand total).
  const combined = useMemo(() => sumKinds(periodTxs), [periodTxs]);

  // Per-account totals for the active period, keyed by account_id.
  const perAccount = useMemo(() => {
    const map: Record<string, KindTotals> = {};
    for (const a of accounts) {
      map[a.id] = sumKinds(periodTxs.filter((t) => t.account_id === a.id));
    }
    return map;
  }, [accounts, periodTxs]);

  // This-month totals per account for the compact SPENT tag on each list row.
  const monthPerAccount = useMemo(() => {
    const map: Record<string, KindTotals> = {};
    for (const a of accounts) {
      map[a.id] = sumKinds(
        txs.filter((t) => t.account_id === a.id && inRange(t, monthStart, monthEnd))
      );
    }
    return map;
  }, [accounts, txs, monthStart, monthEnd]);

  // Live balance per account (opening + linked txns), keyed by account_id.
  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of accounts) map[a.id] = accountBalance(a, txs);
    return map;
  }, [accounts, txs]);

  const resetForm = () => {
    setName('');
    setType('bank');
    setBalance('');
    setAccountNo('');
    setNotes('');
  };

  // Parse a rupee string ("12,500.50") into integer paise.
  const parsePaise = (s: string): number | null => {
    const cleaned = s.replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    const rupees = Number(cleaned);
    if (!Number.isFinite(rupees)) return null;
    return Math.round(rupees * 100);
  };

  const saveAccount = async () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Name required', 'Give the account a name (e.g. HDFC Savings).');
      return;
    }
    const paise = parsePaise(balance);
    if (paise === null) {
      Alert.alert(
        'Balance required',
        'Enter the current balance in this account so it can be kept up to date.'
      );
      return;
    }
    const wasFirst = accounts.length === 0;
    const acc = await addAccount({
      name: n,
      type,
      account_no: accountNo.trim() || null,
      notes: notes.trim() || null,
      opening_balance: paise,
      favorite: false,
    });
    setAddOpen(false);
    resetForm();
    if (wasFirst) {
      Alert.alert(
        'Set as default?',
        `Make "${acc.name}" the default account for new transactions? Auto-added SMS and manual entries will be linked to it. You can change this anytime.`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Set default',
            onPress: () => setDefaultAccountId(acc.id),
          },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Tag>PORTFOLIO</Tag>
        <Pressable onPress={onOpenSettings} style={styles.gearBtn}>
          <Icon name="settings" size={15} color={C.text2} />
        </Pressable>
      </View>

      {/* Accounts */}
      <View style={[styles.accHeader, { paddingTop: 8 }]}>
        <Tag>ACCOUNTS</Tag>
        <Pressable
          onPress={() => setAddOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="plus" size={14} color={C.accent} strokeWidth={2} />
          <T mono color={C.accent} style={{ fontSize: 10, letterSpacing: 1.2 }}>
            ADD
          </T>
        </Pressable>
      </View>

      {accounts.length === 0 ? (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={styles.emptyBox}>
            <T color={C.text2} style={{ fontSize: 13, lineHeight: 19, marginBottom: 6 }}>
              No accounts yet.
            </T>
            <T mono color={C.text3} style={{ fontSize: 11, lineHeight: 16 }}>
              Add a bank account or card to track spend, income and savings per account.
            </T>
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              totals={monthPerAccount[a.id]}
              balance={balances[a.id]}
              isDefault={a.id === defaultAccountId}
              onPress={() => onOpenAccount(a)}
              onToggleFav={() => setFav(a.id, !a.favorite)}
            />
          ))}
        </View>
      )}

      {/* Per-account analytics */}
      {accounts.length > 0 ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 28 }}>
          <View style={styles.breakHeader}>
            <Tag>BREAKDOWN</Tag>
            <View style={styles.periodToggle}>
              {(
                [
                  ['month', format(now, 'MMM').toUpperCase()],
                  ['all', 'ALL TIME'],
                ] as const
              ).map(([key, label]) => {
                const active = period === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setPeriod(key)}
                    style={{
                      ...styles.periodChip,
                      backgroundColor: active ? C.accentGlowFaint : 'transparent',
                      borderColor: active ? C.accent : C.border2,
                    }}>
                    <T
                      mono
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
          </View>

          <View style={{ gap: 12 }}>
            {accounts.map((a) => (
              <AccountStatCard
                key={a.id}
                account={a}
                totals={perAccount[a.id]}
                balance={balances[a.id]}
                onPress={() => onOpenAccount(a)}
              />
            ))}
          </View>

          {accounts.length > 1 ? (
            <>
              <T
                mono
                style={{
                  fontSize: 11,
                  color: C.text3,
                  letterSpacing: 1,
                  marginTop: 24,
                  marginBottom: 10,
                }}>
                ALL ACCOUNTS
              </T>
              <SummaryGrid totals={combined} />
            </>
          ) : null}
        </View>
      ) : null}

      <Sheet
        visible={addOpen}
        title="ADD ACCOUNT"
        onClose={() => {
          setAddOpen(false);
          resetForm();
        }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16 }}
          keyboardShouldPersistTaps="handled">
          <View>
            <Tag style={{ marginBottom: 8 }}>TYPE</Tag>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['bank', 'card'] as AccountType[]).map((t) => {
                const active = type === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[
                      styles.typeChip,
                      active && { borderColor: C.accent, backgroundColor: C.accentGlowFaint },
                    ]}>
                    <Icon
                      name={t === 'bank' ? 'bank' : 'card'}
                      size={16}
                      color={active ? C.accent : C.text2}
                    />
                    <T
                      mono
                      style={{
                        fontSize: 12,
                        color: active ? C.accent : C.text2,
                        letterSpacing: 1,
                      }}>
                      {t === 'bank' ? 'BANK' : 'CARD'}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Tag style={{ marginBottom: 6 }}>NAME</Tag>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={type === 'bank' ? 'e.g. HDFC Savings' : 'e.g. Amazon Pay ICICI'}
              placeholderTextColor={C.text4}
              style={styles.input}
              selectionColor={C.accent}
              autoFocus
            />
          </View>
          <View>
            <Tag style={{ marginBottom: 6 }}>CURRENT BALANCE</Tag>
            <View style={styles.balanceRow}>
              <T mono color={C.text3} style={{ fontSize: 16 }}>
                ₹
              </T>
              <TextInput
                value={balance}
                onChangeText={setBalance}
                placeholder="0"
                placeholderTextColor={C.text4}
                keyboardType="decimal-pad"
                style={styles.balanceInput}
                selectionColor={C.accent}
              />
            </View>
            <T mono color={C.text4} style={{ fontSize: 10, marginTop: 6, letterSpacing: 0.3 }}>
              WE KEEP THIS UPDATED FROM LINKED TRANSACTIONS
            </T>
          </View>
          <View>
            <Tag style={{ marginBottom: 6 }}>ACCOUNT / CARD NO. (OPTIONAL)</Tag>
            <TextInput
              value={accountNo}
              onChangeText={setAccountNo}
              placeholder="last 4 digits or full"
              placeholderTextColor={C.text4}
              style={styles.input}
              selectionColor={C.accent}
            />
          </View>
          <View>
            <Tag style={{ marginBottom: 6 }}>NOTES (OPTIONAL)</Tag>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="anything to remember"
              placeholderTextColor={C.text4}
              style={styles.input}
              selectionColor={C.accent}
            />
          </View>
          <Button
            label="ADD ACCOUNT"
            onPress={saveAccount}
            disabled={!name.trim() || !balance.trim()}
            style={{ marginTop: 4, opacity: name.trim() && balance.trim() ? 1 : 0.35 }}
          />
        </ScrollView>
      </Sheet>
    </ScrollView>
  );
}

function SummaryGrid({ totals }: { totals: KindTotals }) {
  const savedPositive = totals.saved >= 0;
  return (
    <View style={styles.summaryWrap}>
      <View style={styles.summaryRow}>
        <Cell label="INCOME" value={'+' + formatAmountCompact(totals.income)} color="#34C759" />
        <View style={styles.vDivider} />
        <Cell label="SPENT" value={formatAmountCompact(totals.expense)} color={C.text} />
        <View style={styles.vDivider} />
        <Cell
          label={savedPositive ? 'SAVED' : 'OVER'}
          value={formatAmountCompact(Math.abs(totals.saved))}
          color={savedPositive ? '#34C759' : C.danger}
          alignEnd
        />
      </View>
      <View style={styles.hDivider} />
      <View style={styles.summaryRow}>
        <Cell label="INVEST" value={formatAmountCompact(totals.invest)} color={C.accent} />
        <View style={styles.vDivider} />
        <Cell label="LENT" value={formatAmountCompact(totals.lent)} color={C.text2} />
        <View style={styles.vDivider} />
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// One account's own income/spent/saved (+ invest/lent when present) for the
// active period, headed by the account name and its live balance. Tappable.
function AccountStatCard({
  account,
  totals,
  balance,
  onPress,
}: {
  account: Account;
  totals?: KindTotals;
  balance: number;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const t = totals ?? { income: 0, expense: 0, invest: 0, lent: 0, saved: 0 };
  const savedPositive = t.saved >= 0;
  const negBal = balance < 0;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{ ...styles.statCard, backgroundColor: pressed ? C.surface2 : C.surface }}>
      <View style={styles.statHead}>
        <Icon name={account.type === 'card' ? 'card' : 'bank'} size={15} color={C.text2} />
        <T weight="500" style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
          {account.name}
        </T>
        <View style={{ alignItems: 'flex-end' }}>
          <T mono weight="600" style={{ fontSize: 13, color: negBal ? C.danger : C.text }}>
            {negBal ? '−' : ''}
            {formatAmountCompact(Math.abs(balance))}
          </T>
          <T mono color={C.text4} style={{ fontSize: 8, letterSpacing: 1, marginTop: 1 }}>
            BALANCE
          </T>
        </View>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.summaryRow}>
        <Cell label="INCOME" value={'+' + formatAmountCompact(t.income)} color="#34C759" />
        <View style={styles.vDivider} />
        <Cell label="SPENT" value={formatAmountCompact(t.expense)} color={C.text} />
        <View style={styles.vDivider} />
        <Cell
          label={savedPositive ? 'SAVED' : 'OVER'}
          value={formatAmountCompact(Math.abs(t.saved))}
          color={savedPositive ? '#34C759' : C.danger}
          alignEnd
        />
      </View>
      <View style={styles.statDivider} />
      <View style={styles.summaryRow}>
        <Cell label="INVEST" value={formatAmountCompact(t.invest)} color={C.accent} />
        <View style={styles.vDivider} />
        <Cell label="LENT" value={formatAmountCompact(t.lent)} color={C.text2} />
        <View style={styles.vDivider} />
        <View style={{ flex: 1 }} />
      </View>
    </Pressable>
  );
}

function Cell({
  label,
  value,
  color,
  alignEnd,
}: {
  label: string;
  value: string;
  color: string;
  alignEnd?: boolean;
}) {
  return (
    <View style={[styles.cell, alignEnd && { alignItems: 'flex-end' }]}>
      <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </T>
      <T mono weight="600" style={{ fontSize: 15, color }} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

function AccountRow({
  account,
  totals,
  balance,
  isDefault,
  onPress,
  onToggleFav,
}: {
  account: Account;
  totals?: KindTotals;
  balance: number;
  isDefault: boolean;
  onPress: () => void;
  onToggleFav: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const t = totals ?? { income: 0, expense: 0, invest: 0, lent: 0, saved: 0 };
  const negative = balance < 0;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        ...styles.accRow,
        backgroundColor: pressed ? C.surface2 : C.surface,
      }}>
      <View style={styles.accGlyph}>
        <Icon name={account.type === 'card' ? 'card' : 'bank'} size={18} color={C.text2} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T weight="500" style={{ fontSize: 14 }} numberOfLines={1}>
            {account.name}
          </T>
          {isDefault ? (
            <View style={styles.defaultBadge}>
              <T mono color={C.accent} style={{ fontSize: 8, letterSpacing: 1 }}>
                DEFAULT
              </T>
            </View>
          ) : null}
        </View>
        <T mono color={C.text3} style={{ fontSize: 10, letterSpacing: 0.5, marginTop: 3 }}>
          {account.type === 'card' ? 'CARD' : 'BANK'}
          {t.expense > 0 ? ` · ${formatAmountCompact(t.expense)} SPENT` : ''}
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
      <Pressable onPress={onToggleFav} hitSlop={10} style={styles.starBtn}>
        <Icon
          name="star"
          size={15}
          color={account.favorite ? C.accent : C.text4}
          filled={account.favorite}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gearBtn: {
    borderWidth: 1,
    borderColor: C.border2,
    padding: 7,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryWrap: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 2,
    padding: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  periodToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  periodChip: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    padding: 14,
  },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },
  cell: { flex: 1 },
  vDivider: {
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
  accHeader: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    padding: 16,
    backgroundColor: C.surface,
  },
  accRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    padding: 14,
  },
  accGlyph: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  defaultBadge: {
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  starBtn: {
    padding: 4,
    marginLeft: 2,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    paddingVertical: 12,
    backgroundColor: C.surface,
  },
  input: {
    color: C.text,
    fontFamily: F.mono,
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    backgroundColor: C.surface,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border2,
    borderRadius: 2,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
  },
  balanceInput: {
    flex: 1,
    color: C.text,
    fontFamily: F.mono,
    fontSize: 18,
    paddingVertical: 12,
  },
});
