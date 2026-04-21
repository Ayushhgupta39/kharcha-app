import { getDb } from './index';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = (await db.getFirstAsync(
    `SELECT value FROM settings WHERE key = ?`,
    [key]
  )) as { value: string } | null;
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    [key, value]
  );
}
