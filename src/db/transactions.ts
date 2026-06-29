import type { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from './index';

export type TxSource = 'sms' | 'manual';
export type TxType = 'debit' | 'credit';
export type TxKind = 'expense' | 'income' | 'invest' | 'lent';

export type Transaction = {
  id: string;
  amount: number; // paise
  type: TxType;
  kind: TxKind;
  merchant: string;
  category: string;
  date: string; // ISO
  source: TxSource;
  bank?: string | null;
  account_id?: string | null;
  note?: string | null;
  raw_sms?: string | null;
  sms_hash?: string | null;
};

function genId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export async function insertTransaction(
  tx: Omit<Transaction, 'id'> & { id?: string }
): Promise<Transaction | null> {
  const db = await getDb();
  const id = tx.id ?? genId();
  try {
    await db.runAsync(
      `INSERT INTO transactions (id, amount, type, kind, merchant, category, date, source, bank, account_id, note, raw_sms, sms_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tx.amount,
        tx.type ?? 'debit',
        tx.kind ?? 'expense',
        tx.merchant,
        tx.category,
        tx.date,
        tx.source,
        tx.bank ?? null,
        tx.account_id ?? null,
        tx.note ?? null,
        tx.raw_sms ?? null,
        tx.sms_hash ?? null,
      ]
    );
    return { ...tx, id };
  } catch (e: any) {
    if (!String(e?.message).includes('UNIQUE')) {
      console.warn('[db] insertTransaction failed:', e?.message, tx.sms_hash);
    }
    return null;
  }
}

export async function updateTransaction(
  id: string,
  patch: Partial<Omit<Transaction, 'id'>>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    values.push((v ?? null) as SQLiteBindValue);
  }
  if (!fields.length) return;
  values.push(id);
  await db.runAsync(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
}

export async function listTransactions(
  opts: {
    from?: string;
    to?: string;
    category?: string;
    source?: TxSource;
    bank?: string;
    account_id?: string;
    search?: string;
    limit?: number;
  } = {}
): Promise<Transaction[]> {
  const db = await getDb();
  const where: string[] = [];
  const values: SQLiteBindValue[] = [];
  if (opts.from) {
    where.push('date >= ?');
    values.push(opts.from);
  }
  if (opts.to) {
    where.push('date <= ?');
    values.push(opts.to);
  }
  if (opts.category) {
    where.push('category = ?');
    values.push(opts.category);
  }
  if (opts.source) {
    where.push('source = ?');
    values.push(opts.source);
  }
  if (opts.bank) {
    where.push('bank = ?');
    values.push(opts.bank);
  }
  if (opts.account_id) {
    where.push('account_id = ?');
    values.push(opts.account_id);
  }
  if (opts.search) {
    where.push('LOWER(merchant) LIKE ?');
    values.push('%' + opts.search.toLowerCase() + '%');
  }
  const sql = `SELECT * FROM transactions${
    where.length ? ' WHERE ' + where.join(' AND ') : ''
  } ORDER BY date DESC${opts.limit ? ' LIMIT ' + opts.limit : ''}`;
  return (await db.getAllAsync(sql, values)) as Transaction[];
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const db = await getDb();
  const row = (await db.getFirstAsync(`SELECT * FROM transactions WHERE id = ?`, [
    id,
  ])) as Transaction | null;
  return row;
}

export async function sumByCategory(
  from: string,
  to: string
): Promise<{ category: string; total: number }[]> {
  const db = await getDb();
  return (await db.getAllAsync(
    `SELECT category, SUM(amount) as total FROM transactions
     WHERE date >= ? AND date <= ? AND category != 'transfer'
     GROUP BY category ORDER BY total DESC`,
    [from, to]
  )) as { category: string; total: number }[];
}

export async function topMerchants(
  from: string,
  to: string,
  limit = 5
): Promise<{ merchant: string; total: number; count: number }[]> {
  const db = await getDb();
  return (await db.getAllAsync(
    `SELECT merchant, SUM(amount) as total, COUNT(*) as count FROM transactions
     WHERE date >= ? AND date <= ? AND category != 'transfer'
     GROUP BY merchant ORDER BY total DESC LIMIT ?`,
    [from, to, limit]
  )) as { merchant: string; total: number; count: number }[];
}

export async function sumByDay(
  from: string,
  to: string
): Promise<{ day: string; total: number }[]> {
  const db = await getDb();
  return (await db.getAllAsync(
    `SELECT substr(date, 1, 10) as day, SUM(amount) as total FROM transactions
     WHERE date >= ? AND date <= ? AND category != 'transfer'
     GROUP BY day ORDER BY day ASC`,
    [from, to]
  )) as { day: string; total: number }[];
}

export async function sumByKind(
  from?: string,
  to?: string,
  account_id?: string
): Promise<{ kind: string; total: number }[]> {
  const db = await getDb();
  const where: string[] = [`category != 'transfer'`];
  const values: SQLiteBindValue[] = [];
  if (from) {
    where.push('date >= ?');
    values.push(from);
  }
  if (to) {
    where.push('date <= ?');
    values.push(to);
  }
  if (account_id) {
    where.push('account_id = ?');
    values.push(account_id);
  }
  return (await db.getAllAsync(
    `SELECT kind, SUM(amount) as total FROM transactions
     WHERE ${where.join(' AND ')}
     GROUP BY kind`,
    values
  )) as { kind: string; total: number }[];
}

export async function sumByCategoryKind(
  kind: string,
  from?: string,
  to?: string,
  account_id?: string
): Promise<{ category: string; total: number }[]> {
  const db = await getDb();
  const where: string[] = [`category != 'transfer'`, 'kind = ?'];
  const values: SQLiteBindValue[] = [kind];
  if (from) {
    where.push('date >= ?');
    values.push(from);
  }
  if (to) {
    where.push('date <= ?');
    values.push(to);
  }
  if (account_id) {
    where.push('account_id = ?');
    values.push(account_id);
  }
  return (await db.getAllAsync(
    `SELECT category, SUM(amount) as total FROM transactions
     WHERE ${where.join(' AND ')}
     GROUP BY category ORDER BY total DESC`,
    values
  )) as { category: string; total: number }[];
}

export async function getDistinctBanks(): Promise<string[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    `SELECT DISTINCT bank FROM transactions WHERE bank IS NOT NULL`
  )) as { bank: string }[];
  return rows.map((r) => r.bank);
}
