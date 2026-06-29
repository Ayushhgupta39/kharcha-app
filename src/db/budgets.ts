import { getDb } from './index';

export type BudgetKind = 'overall' | 'category' | 'custom';

export type Budget = {
  id: string;
  kind: BudgetKind;
  category?: string | null;
  amount: number; // paise
  period_start?: string | null;
  period_end?: string | null;
  alert_pct: number;
  label?: string | null;
};

export async function listBudgets(): Promise<Budget[]> {
  const db = await getDb();
  return (await db.getAllAsync(
    `SELECT * FROM budgets ORDER BY kind ASC, created_at ASC`
  )) as Budget[];
}

export async function upsertBudget(b: Omit<Budget, 'id'> & { id?: string }): Promise<Budget> {
  const db = await getDb();
  const id = b.id ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  await db.runAsync(
    `INSERT OR REPLACE INTO budgets
     (id, kind, category, amount, period_start, period_end, alert_pct, label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      b.kind,
      b.category ?? null,
      b.amount,
      b.period_start ?? null,
      b.period_end ?? null,
      b.alert_pct,
      b.label ?? null,
    ]
  );
  return { ...b, id };
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM budgets WHERE id = ?`, [id]);
}
