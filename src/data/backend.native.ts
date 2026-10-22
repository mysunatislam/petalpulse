import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { createTableSQL, fromRow, SCHEMA_VERSION, TABLES, TableName, toRow } from './schema';
import type { StorageBackend } from './storage';

const DB_NAME = 'petal-pulse.db';
const KEY_NAME = 'pp_db_key_v1';

/** Encryption key is generated on-device and kept in the OS keystore. */
async function getOrCreateKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(KEY_NAME);
  if (!key) {
    const bytes = Crypto.getRandomBytes(32);
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(KEY_NAME, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  return key;
}

export class SQLiteBackend implements StorageBackend {
  encrypted = true;
  private db: SQLite.SQLiteDatabase | null = null;

  async init() {
    if (this.db) return;
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const key = await getOrCreateKey();
    // SQLCipher (enabled via the expo-sqlite config plugin) encrypts the file.
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    for (const t of Object.values(TABLES)) await db.execAsync(createTableSQL(t));
    await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', 'schema_version', JSON.stringify(SCHEMA_VERSION));
    this.db = db;
  }

  private get d() {
    if (!this.db) throw new Error('Database not initialised');
    return this.db;
  }

  async all<T>(table: TableName): Promise<T[]> {
    const rows = await this.d.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${TABLES[table].name}`);
    return rows.map((r) => fromRow<T>(TABLES[table], r));
  }

  async get<T>(table: TableName, key: string): Promise<T | null> {
    const t = TABLES[table];
    const row = await this.d.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${t.name} WHERE "${t.key}" = ?`, key);
    return row ? fromRow<T>(t, row) : null;
  }

  async put(table: TableName, obj: object) {
    const t = TABLES[table];
    const row = toRow(t, obj as Record<string, unknown>);
    const cols = Object.keys(row);
    await this.d.runAsync(
      `INSERT OR REPLACE INTO ${t.name} (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      cols.map((c) => row[c]),
    );
  }

  async putMany(table: TableName, objs: object[]) {
    await this.d.withTransactionAsync(async () => {
      for (const o of objs) await this.put(table, o);
    });
  }

  async remove(table: TableName, key: string) {
    const t = TABLES[table];
    await this.d.runAsync(`DELETE FROM ${t.name} WHERE "${t.key}" = ?`, key);
  }

  async wipe() {
    // Permanently delete: close, remove the file, and destroy the key.
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
    await SQLite.deleteDatabaseAsync(DB_NAME);
    await SecureStore.deleteItemAsync(KEY_NAME);
  }
}

export function createBackend(): StorageBackend {
  return new SQLiteBackend();
}
