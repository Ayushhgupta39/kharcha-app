import { getDb } from './index';

function norm(m: string): string {
  return m.trim().toUpperCase().replace(/\s+/g, ' ');
}

export async function getMerchantCategory(
  merchant: string
): Promise<string | null> {
  const db = await getDb();
  const row = (await db.getFirstAsync(
    `SELECT category FROM merchant_map WHERE merchant_key = ?`,
    [norm(merchant)]
  )) as { category: string } | null;
  return row?.category ?? null;
}

export async function setMerchantCategory(
  merchant: string,
  category: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO merchant_map (merchant_key, category, updated_at)
     VALUES (?, ?, datetime('now'))`,
    [norm(merchant), category]
  );
}
