/**
 * Storage backend contract. Native uses encrypted SQLite (storage.native.ts),
 * web preview uses an in-browser fallback (storage.web.ts), tests use memory.
 */
import type { TableName } from './schema';

export interface StorageBackend {
  init(): Promise<void>;
  all<T>(table: TableName): Promise<T[]>;
  get<T>(table: TableName, key: string): Promise<T | null>;
  put(table: TableName, obj: object): Promise<void>;
  putMany(table: TableName, objs: object[]): Promise<void>;
  remove(table: TableName, key: string): Promise<void>;
  wipe(): Promise<void>;
  /** True when data is encrypted at rest on this platform. */
  encrypted: boolean;
}

/** Memory backend — used by tests and as the base of the web fallback. */
export class MemoryBackend implements StorageBackend {
  encrypted = false;
  protected tables = new Map<string, Map<string, object>>();
  constructor(private keys: Record<string, string>) {}
  async init() {}
  protected t(name: string) {
    let m = this.tables.get(name);
    if (!m) {
      m = new Map();
      this.tables.set(name, m);
    }
    return m;
  }
  async all<T>(table: TableName): Promise<T[]> {
    return [...this.t(table).values()].map((v) => structuredCloneSafe(v)) as T[];
  }
  async get<T>(table: TableName, key: string): Promise<T | null> {
    const v = this.t(table).get(key);
    return v ? (structuredCloneSafe(v) as T) : null;
  }
  async put(table: TableName, obj: object) {
    const k = (obj as Record<string, string>)[this.keys[table]];
    this.t(table).set(k, structuredCloneSafe(obj));
    this.persist();
  }
  async putMany(table: TableName, objs: object[]) {
    for (const o of objs) {
      const k = (o as Record<string, string>)[this.keys[table]];
      this.t(table).set(k, structuredCloneSafe(o));
    }
    this.persist();
  }
  async remove(table: TableName, key: string) {
    this.t(table).delete(key);
    this.persist();
  }
  async wipe() {
    this.tables.clear();
    this.persist();
  }
  protected persist() {}
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
