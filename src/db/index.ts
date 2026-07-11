import * as SQLite from 'expo-sqlite';

const DB_NAME = 'kharcha.db';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await migrate(_db);
  return _db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  // Idempotent column additions — ignore if already exists
  try {
    await db.execAsync(`ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'debit'`);
  } catch {
    /* column already exists */
  }
  try {
    await db.execAsync(`ALTER TABLE transactions ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense'`);
  } catch {
    /* column already exists */
  }
  try {
    await db.execAsync(`ALTER TABLE transactions ADD COLUMN account_id TEXT`);
  } catch {
    /* column already exists */
  }
  try {
    await db.execAsync(
      `ALTER TABLE accounts ADD COLUMN opening_balance INTEGER NOT NULL DEFAULT 0`
    );
  } catch {
    /* column already exists (or table not created yet — CREATE below covers it) */
  }
  try {
    await db.execAsync(`ALTER TABLE accounts ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0`);
  } catch {
    /* column already exists */
  }
  try {
    // The instant the opening_balance was last set. Only txns dated after this
    // move the live balance; older ones are already baked into the number.
    await db.execAsync(`ALTER TABLE accounts ADD COLUMN balance_as_of TEXT`);
  } catch {
    /* column already exists */
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS transactions (
      id            TEXT PRIMARY KEY,
      amount        INTEGER NOT NULL,
      type          TEXT NOT NULL DEFAULT 'debit',
      merchant      TEXT NOT NULL,
      category      TEXT NOT NULL,
      date          TEXT NOT NULL,
      source        TEXT NOT NULL,
      bank          TEXT,
      note          TEXT,
      raw_sms       TEXT,
      sms_hash      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant);
    CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_sms_hash ON transactions(sms_hash) WHERE sms_hash IS NOT NULL;

    CREATE TABLE IF NOT EXISTS pending_sms (
      id            TEXT PRIMARY KEY,
      amount        INTEGER NOT NULL,
      merchant      TEXT NOT NULL,
      category      TEXT NOT NULL,
      date          TEXT NOT NULL,
      bank          TEXT,
      raw_sms       TEXT NOT NULL,
      sms_hash      TEXT UNIQUE,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_sms(status);

    CREATE TABLE IF NOT EXISTS custom_categories (
      key           TEXT PRIMARY KEY,
      label         TEXT NOT NULL,
      glyph         TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id            TEXT PRIMARY KEY,
      kind          TEXT NOT NULL,
      category      TEXT,
      amount        INTEGER NOT NULL,
      period_start  TEXT,
      period_end    TEXT,
      alert_pct     INTEGER NOT NULL DEFAULT 85,
      label         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merchant_map (
      merchant_key  TEXT PRIMARY KEY,
      category      TEXT NOT NULL,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      type             TEXT NOT NULL DEFAULT 'bank',
      account_no       TEXT,
      notes            TEXT,
      opening_balance  INTEGER NOT NULL DEFAULT 0,
      favorite         INTEGER NOT NULL DEFAULT 0,
      balance_as_of    TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Backfill kind for rows that predate the column (idempotent).
  try {
    await db.execAsync(
      `UPDATE transactions SET kind = 'income' WHERE type = 'credit' AND kind = 'expense'`
    );
  } catch {
    /* no-op */
  }
}

export async function resetDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM transactions;
    DELETE FROM pending_sms;
    DELETE FROM custom_categories;
    DELETE FROM budgets;
    DELETE FROM merchant_map;
    DELETE FROM settings;
    DELETE FROM accounts;
  `);
}
