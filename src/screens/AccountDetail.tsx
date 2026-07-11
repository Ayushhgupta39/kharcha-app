import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { T, Tag } from '../components/Text';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { TxRow } from '../components/TxRow';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { C, F } from '../lib/tokens';
import { formatAmount, formatAmountCompact, paiseToRupees } from '../lib/format';
import { getCategory } from '../lib/categories';
import { sumKinds, accountBalance } from '../lib/portfolio';
import { useTransactions } from '../store/transactions';
import { useAccounts } from '../store/accounts';
import { useCategories } from '../store/categories';
import { useSettings } from '../store/settings';
import type { Account, AccountType } from '../db/accounts';

type Props = {
  account: Account;
  onBack: () => void;
  onOpenTx: (id: string) => void;
};

export function AccountDetailScreen({ account: accountProp, onBack, onOpenTx }: Props) {
  const insets = useSafeAreaInsets();
  const allTxs = useTransactions((s) => s.transactions);
  const customs = useCategories((s) => s.customs);
  const accounts = useAccounts((s) => s.accounts);
  const removeAccount = useAccounts((s) => s.remove);
  const updateAccount = useAccounts((s) => s.update);
  const setFav = useAccounts((s) => s.setFav);
  const refreshTxs = useTransactions((s) => s.refresh);
  const defaultAccountId = useSettings((s) => s.defaultAccountId);
  const setDefaultAccountId = useSettings((s) => s.setDefaultAccountId);

  // Prefer the live store row so favorite/balance stay current after edits.
  const account = useMemo(
    () => accounts.find((a) => a.id === accountProp.id) ?? accountProp,
    [accounts, accountProp]
  );
  const isDefault = account.id === defaultAccountId;

  const txs = useMemo(
    () => allTxs.filter((t) => t.account_id === account.id),
    [allTxs, account.id]
  );

  const totals = useMemo(() => sumKinds(txs), [txs]);
  const balance = useMemo(() => accountBalance(account, allTxs), [account, allTxs]);

  // Edit sheet — name, type, account no, notes, and optionally re-set balance.
  const [editOpen, setEditOpen] = useState(false);
  const [eName, setEName] = useState('');
  const [eType, setEType] = useState<AccountType>('bank');
  const [eBalance, setEBalance] = useState('');
  const [eBalanceTouched, setEBalanceTouched] = useState(false);
  const [eAccountNo, setEAccountNo] = useState('');
  const [eNotes, setENotes] = useState('');

  const openEdit = () => {
    setEName(account.name);
    setEType(account.type);
    setEBalance(String(paiseToRupees(balance)));
    setEBalanceTouched(false);
    setEAccountNo(account.account_no ?? '');
    setENotes(account.notes ?? '');
    setEditOpen(true);
  };

  const parsePaise = (s: string): number | null => {
    const cleaned = s.replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    const rupees = Number(cleaned);
    if (!Number.isFinite(rupees)) return null;
    return Math.round(rupees * 100);
  };

  const saveEdit = async () => {
    const n = eName.trim();
    if (!n) {
      Alert.alert('Name required', 'Give the account a name (e.g. HDFC Savings).');
      return;
    }
    // Only re-anchor the balance if the user actually edited the field.
    let opening_balance: number | undefined;
    if (eBalanceTouched) {
      const paise = parsePaise(eBalance);
      if (paise === null) {
        Alert.alert('Balance required', 'Enter a valid current balance.');
        return;
      }
      opening_balance = paise;
    }
    await updateAccount(account.id, {
      name: n,
      type: eType,
      account_no: eAccountNo.trim() || null,
      notes: eNotes.trim() || null,
      opening_balance,
    });
    setEditOpen(false);
  };

  // Expense + lent by category (the spend the user controls per account).
  const catBreakdown = useMemo(() => {
    const ct: Record<string, number> = {};
    for (const t of txs) {
      if (t.category === 'transfer') continue;
      const k = t.kind ?? (t.type === 'credit' ? 'income' : 'expense');
      if (k === 'income') continue;
      ct[t.category] = (ct[t.category] ?? 0) + t.amount;
    }
    const sorted = Object.keys(ct).sort((a, b) => ct[b] - ct[a]);
    const max = sorted.length ? ct[sorted[0]] : 1;
    return { sorted, ct, max };
  }, [txs]);

  const confirmDelete = () => {
    Alert.alert(
      `Remove "${account.name}"?`,
      'The account is removed. Its transactions are kept but unlinked.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (isDefault) await setDefaultAccountId(null);
            await removeAccount(account.id);
            await refreshTxs();
            onBack();
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingBottom: 14,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="arrow-l" size={18} color={C.text} />
          <T mono style={{ fontSize: 11, letterSpacing: 1.2 }}>
            BACK
          </T>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Pressable onPress={() => setFav(account.id, !account.favorite)} hitSlop={8}>
            <Icon
              name="star"
              size={17}
              color={account.favorite ? C.accent : C.text3}
              filled={account.favorite}
            />
          </Pressable>
          <Pressable onPress={openEdit} hitSlop={8}>
            <Icon name="edit" size={16} color={C.text} />
          </Pressable>
          <Pressable onPress={confirmDelete} hitSlop={8}>
            <Icon name="trash" size={16} color={C.danger} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={txs}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TxRow tx={item} onPress={() => onOpenTx(item.id)} customs={customs} />
        )}
        ListHeaderComponent={
          <View>
            {/* Account hero */}
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderBottomWidth: 1,
                borderBottomColor: C.border,
              }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderWidth: 1,
                  borderColor: C.border2,
                  borderRadius: 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: C.surface,
                }}>
                <Icon name={account.type === 'card' ? 'card' : 'bank'} size={22} color={C.text} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Tag>{account.type === 'card' ? 'CARD' : 'BANK'}</Tag>
                  {isDefault ? (
                    <T mono color={C.accent} style={{ fontSize: 9, letterSpacing: 1 }}>
                      · DEFAULT
                    </T>
                  ) : null}
                </View>
                <T
                  mono
                  style={{ fontSize: 22, letterSpacing: -0.4, marginTop: 4 }}
                  numberOfLines={1}>
                  {account.name}
                </T>
                {account.account_no ? (
                  <T mono color={C.text3} style={{ fontSize: 11, marginTop: 2 }}>
                    {account.account_no}
                  </T>
                ) : null}
              </View>
            </View>

            {/* Live balance */}
            <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
              <Tag style={{ marginBottom: 6 }}>BALANCE</Tag>
              <T
                mono
                weight="600"
                style={{
                  fontSize: 40,
                  letterSpacing: -1,
                  color: balance < 0 ? C.danger : C.text,
                }}
                adjustsFontSizeToFit
                numberOfLines={1}>
                {balance < 0 ? '−' : ''}
                {formatAmount(Math.abs(balance))}
              </T>
              <T mono color={C.text4} style={{ fontSize: 10, marginTop: 4, letterSpacing: 0.5 }}>
                {formatAmount(account.opening_balance)} AS OF{' '}
                {account.balance_as_of
                  ? format(new Date(account.balance_as_of), 'd MMM · h:mm a').toUpperCase()
                  : 'START'}
              </T>
            </View>

            {!isDefault ? (
              <Pressable
                onPress={() => setDefaultAccountId(account.id)}
                style={{
                  marginHorizontal: 20,
                  marginTop: 14,
                  borderWidth: 1,
                  borderColor: C.border2,
                  borderRadius: 2,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}>
                <Icon name="check" size={14} color={C.accent} />
                <T mono color={C.accent} style={{ fontSize: 11, letterSpacing: 1 }}>
                  SET AS DEFAULT
                </T>
              </Pressable>
            ) : null}

            {/* All-time totals for this account */}
            <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
              <Tag style={{ marginBottom: 10 }}>ALL TIME</Tag>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: C.border,
                  backgroundColor: C.surface,
                  borderRadius: 2,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <StatCell
                  label="INCOME"
                  value={'+' + formatAmountCompact(totals.income)}
                  color="#34C759"
                />
                <Divider />
                <StatCell
                  label="SPENT"
                  value={formatAmountCompact(totals.expense + totals.lent)}
                  color={C.text}
                />
                <Divider />
                <StatCell
                  label="INVEST"
                  value={formatAmountCompact(totals.invest)}
                  color={C.accent}
                  alignEnd
                />
              </View>
            </View>

            {/* By category */}
            <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
              <Tag style={{ marginBottom: 12 }}>BY CATEGORY</Tag>
              {catBreakdown.sorted.length === 0 ? (
                <T mono color={C.text3} style={{ fontSize: 11, paddingVertical: 8 }}>
                  NO SPEND YET
                </T>
              ) : (
                catBreakdown.sorted.map((key, i) => {
                  const amt = catBreakdown.ct[key];
                  const cat = getCategory(key, customs);
                  const pct = Math.max(4, (amt / catBreakdown.max) * 100);
                  const top = i === 0;
                  return (
                    <View key={key} style={{ marginBottom: 12 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 6,
                        }}>
                        <CategoryGlyph category={key} size={24} active={top} customs={customs} />
                        <T style={{ fontSize: 13, flex: 1 }}>{cat.label}</T>
                        <T mono style={{ fontSize: 13, color: top ? C.accent : C.text }}>
                          {formatAmount(amt)}
                        </T>
                      </View>
                      <View
                        style={{
                          height: 4,
                          backgroundColor: C.surface,
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}>
                        <View
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: top ? C.accent : C.border2,
                          }}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
              <Tag>TRANSACTIONS · {txs.length}</Tag>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ padding: 40 }}>
            <T mono color={C.text3} style={{ fontSize: 11, textAlign: 'center', letterSpacing: 1 }}>
              NO TRANSACTIONS LINKED
            </T>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />

      <Sheet visible={editOpen} title="EDIT ACCOUNT" onClose={() => setEditOpen(false)}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16 }}
          keyboardShouldPersistTaps="handled">
          <View>
            <Tag style={{ marginBottom: 8 }}>TYPE</Tag>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['bank', 'card'] as AccountType[]).map((t) => {
                const active = eType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setEType(t)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      borderWidth: 1,
                      borderColor: active ? C.accent : C.border2,
                      backgroundColor: active ? C.accentGlowFaint : C.surface,
                      borderRadius: 2,
                      paddingVertical: 12,
                    }}>
                    <Icon
                      name={t === 'bank' ? 'bank' : 'card'}
                      size={16}
                      color={active ? C.accent : C.text2}
                    />
                    <T
                      mono
                      style={{ fontSize: 12, color: active ? C.accent : C.text2, letterSpacing: 1 }}>
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
              value={eName}
              onChangeText={setEName}
              placeholder="e.g. HDFC Savings"
              placeholderTextColor={C.text4}
              style={editStyles.input}
              selectionColor={C.accent}
            />
          </View>
          <View>
            <Tag style={{ marginBottom: 6 }}>CURRENT BALANCE</Tag>
            <View style={editStyles.balanceRow}>
              <T mono color={C.text3} style={{ fontSize: 16 }}>
                ₹
              </T>
              <TextInput
                value={eBalance}
                onChangeText={(v) => {
                  setEBalance(v);
                  setEBalanceTouched(true);
                }}
                placeholder="0"
                placeholderTextColor={C.text4}
                keyboardType="decimal-pad"
                style={editStyles.balanceInput}
                selectionColor={C.accent}
              />
            </View>
            <T mono color={C.text4} style={{ fontSize: 10, marginTop: 6, letterSpacing: 0.3 }}>
              EDITING RESETS THE BALANCE TO NOW · OLDER TXNS WON&apos;T CHANGE IT
            </T>
          </View>
          <View>
            <Tag style={{ marginBottom: 6 }}>ACCOUNT / CARD NO. (OPTIONAL)</Tag>
            <TextInput
              value={eAccountNo}
              onChangeText={setEAccountNo}
              placeholder="last 4 digits or full"
              placeholderTextColor={C.text4}
              style={editStyles.input}
              selectionColor={C.accent}
            />
          </View>
          <View>
            <Tag style={{ marginBottom: 6 }}>NOTES (OPTIONAL)</Tag>
            <TextInput
              value={eNotes}
              onChangeText={setENotes}
              placeholder="anything to remember"
              placeholderTextColor={C.text4}
              style={editStyles.input}
              selectionColor={C.accent}
            />
          </View>
          <Button
            label="SAVE CHANGES"
            onPress={saveEdit}
            disabled={!eName.trim()}
            style={{ marginTop: 4, opacity: eName.trim() ? 1 : 0.35 }}
          />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const editStyles = {
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
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
};

function StatCell({
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
    <View style={[{ flex: 1 }, alignEnd && { alignItems: 'flex-end' }]}>
      <T mono color={C.text3} style={{ fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </T>
      <T mono weight="600" style={{ fontSize: 15, color }} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, height: 32, backgroundColor: C.border, marginHorizontal: 12 }} />;
}
