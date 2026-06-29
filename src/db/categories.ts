import type { Category } from '../lib/categories';
import { getDb } from './index';

export async function listCustomCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    `SELECT key, label, glyph FROM custom_categories ORDER BY created_at ASC`
  )) as { key: string; label: string; glyph: string }[];
  return rows.map((r) => ({ ...r, builtin: false }));
}

export async function insertCustomCategory(c: {
  key: string;
  label: string;
  glyph: string;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO custom_categories (key, label, glyph) VALUES (?, ?, ?)`,
    [c.key, c.label, c.glyph]
  );
}

export async function reassignCategory(from: string, to: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE transactions SET category = ? WHERE category = ?`, [to, from]);
}

export async function deleteCustomCategory(key: string): Promise<void> {
  const db = await getDb();
  await reassignCategory(key, 'other');
  await db.runAsync(`DELETE FROM custom_categories WHERE key = ?`, [key]);
}
