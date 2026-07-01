import { getDb } from './index';

export type AccountType = 'bank' | 'card';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  account_no?: string | null;
  notes?: string | null;
  opening_balance: number; // paise — balance at the time the account was added
  favorite: boolean;
};

// SQLite stores `favorite` as 0/1; normalise rows to the typed shape.
function mapRow(r: any): Account {
  return { ...r, favorite: !!r.favorite };
}

function genId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export async function listAccounts(): Promise<Account[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(`SELECT * FROM accounts ORDER BY created_at ASC`)) as any[];
  return rows.map(mapRow);
}

export async function upsertAccount(a: Omit<Account, 'id'> & { id?: string }): Promise<Account> {
  const db = await getDb();
  const id = a.id ?? genId();
  await db.runAsync(
    `INSERT OR REPLACE INTO accounts (id, name, type, account_no, notes, opening_balance, favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      a.name,
      a.type,
      a.account_no ?? null,
      a.notes ?? null,
      a.opening_balance ?? 0,
      a.favorite ? 1 : 0,
    ]
  );
  return { ...a, id };
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE accounts SET favorite = ? WHERE id = ?`, [favorite ? 1 : 0, id]);
}

// Resolve which account an auto-added transaction should link to:
// the default account if set; otherwise best-effort match the SMS bank text to
// a single account (link only when exactly one account name matches).
export function resolveAccountId(
  accounts: Account[],
  defaultAccountId: string | null,
  bank?: string | null
): string | null {
  if (defaultAccountId) {
    const def = accounts.find((a) => a.id === defaultAccountId);
    if (def) return def.id;
  }
  if (!bank) return null;
  const needle = bank.toLowerCase();
  const matches = accounts.filter((a) => {
    const name = a.name.toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });
  return matches.length === 1 ? matches[0].id : null;
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDb();
  // Unlink transactions before removing the account; never cascade-delete.
  await db.runAsync(`UPDATE transactions SET account_id = NULL WHERE account_id = ?`, [id]);
  await db.runAsync(`DELETE FROM accounts WHERE id = ?`, [id]);
}
