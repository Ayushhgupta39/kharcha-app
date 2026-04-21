import type { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from './index';

export type PendingSms = {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  date: string;
  bank?: string | null;
  raw_sms: string;
  sms_hash?: string | null;
  status: 'pending' | 'confirmed' | 'ignored';
};

export async function insertPending(
  p: Omit<PendingSms, 'id' | 'status'> & { id?: string }
): Promise<PendingSms | null> {
  const db = await getDb();
  const id =
    p.id ??
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  try {
    await db.runAsync(
      `INSERT INTO pending_sms (id, amount, merchant, category, date, bank, raw_sms, sms_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        p.amount,
        p.merchant,
        p.category,
        p.date,
        p.bank ?? null,
        p.raw_sms,
        p.sms_hash ?? null,
      ]
    );
    return { ...p, id, status: 'pending' };
  } catch {
    // sms_hash unique constraint — already seen
    return null;
  }
}

export async function listPending(): Promise<PendingSms[]> {
  const db = await getDb();
  return (await db.getAllAsync(
    `SELECT * FROM pending_sms WHERE status = 'pending' ORDER BY date DESC`
  )) as PendingSms[];
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  const row = (await db.getFirstAsync(
    `SELECT COUNT(*) as n FROM pending_sms WHERE status = 'pending'`
  )) as { n: number } | null;
  return row?.n ?? 0;
}

export async function markConfirmed(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE pending_sms SET status = 'confirmed' WHERE id = ?`,
    [id]
  );
}

export async function markIgnored(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE pending_sms SET status = 'ignored' WHERE id = ?`,
    [id]
  );
}

export async function updatePending(
  id: string,
  patch: Partial<Omit<PendingSms, 'id' | 'status'>>
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
  await db.runAsync(
    `UPDATE pending_sms SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}
