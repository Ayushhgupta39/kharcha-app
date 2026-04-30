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
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS transactions (
      id            TEXT PRIMARY KEY,
      amount        INTEGER NOT NULL,
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
  `);
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
  `);
}
