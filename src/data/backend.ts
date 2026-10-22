/**
 * Web preview backend. The production target is Android (backend.native.ts,
 * encrypted SQLite). On web we keep data in this browser's localStorage so
 * the demo can be previewed; it is NOT encrypted and is labelled as such.
 */
import { TABLES } from './schema';
import { MemoryBackend, StorageBackend } from './storage';

const LS_KEY = 'petal-pulse-web-preview';

const KEYS = Object.fromEntries(Object.entries(TABLES).map(([k, t]) => [k, t.key]));

class WebBackend extends MemoryBackend {
  async init() {
    try {
      const raw = globalThis.localStorage?.getItem(LS_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Record<string, Record<string, object>>;
        for (const [t, rows] of Object.entries(data)) this.tables.set(t, new Map(Object.entries(rows)));
      }
    } catch {
      // storage unavailable — run in memory
    }
  }
  protected persist() {
    try {
      const out: Record<string, Record<string, object>> = {};
      for (const [t, m] of this.tables) out[t] = Object.fromEntries(m);
      globalThis.localStorage?.setItem(LS_KEY, JSON.stringify(out));
    } catch {
      // ignore
    }
  }
  async wipe() {
    this.tables.clear();
    try {
      globalThis.localStorage?.removeItem(LS_KEY);
    } catch {
      // ignore
    }
  }
}

export function createBackend(): StorageBackend {
  return new WebBackend(KEYS);
}
