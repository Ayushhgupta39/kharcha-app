import type { Transaction } from '../db/transactions';
import type { Account } from '../db/accounts';

export type KindTotals = {
  income: number;
  expense: number;
  invest: number;
  lent: number;
  saved: number; // income − expense − lent − invest
};

// Classify a transaction's contribution by its `kind`, ignoring transfers.
// Falls back to `type` for any legacy row that somehow lacks `kind`.
function kindOf(t: Transaction): Transaction['kind'] {
  if (t.kind) return t.kind;
  return t.type === 'credit' ? 'income' : 'expense';
}

export function sumKinds(txs: Transaction[]): KindTotals {
  let income = 0;
  let expense = 0;
  let invest = 0;
  let lent = 0;
  for (const t of txs) {
    if (t.category === 'transfer') continue;
    switch (kindOf(t)) {
      case 'income':
        income += t.amount;
        break;
      case 'invest':
        invest += t.amount;
        break;
      case 'lent':
        lent += t.amount;
        break;
      default:
        expense += t.amount;
    }
  }
  return { income, expense, invest, lent, saved: income - expense - lent - invest };
}

export function inRange(t: Transaction, fromIso: string, toIso: string): boolean {
  return t.date >= fromIso && t.date <= toIso;
}

// Live balance = the balance the user entered (as of `balance_as_of`), plus the
// net of transactions linked to the account and dated *after* that instant.
// Txns older than the anchor are already reflected in the entered figure, so
// assigning them must not move the balance. Income adds; expense, invest and
// lent (all real outflows) subtract. Recomputed from txns so it never drifts.
export function accountBalance(account: Account, allTxs: Transaction[]): number {
  const anchor = account.balance_as_of;
  const linked = allTxs.filter(
    (t) => t.account_id === account.id && (!anchor || t.date > anchor)
  );
  const { income, expense, invest, lent } = sumKinds(linked);
  return account.opening_balance + income - expense - invest - lent;
}
