/**
 * Database schema. Declared once and used to (a) create SQLite tables and
 * (b) map rows to typed objects, so both storage backends stay in sync.
 */
export type ColumnType = 'text' | 'integer' | 'real' | 'json' | 'bool';

export interface TableDef {
  name: string;
  key: string;
  columns: Record<string, ColumnType>;
  indexes?: string[];
}

export const SCHEMA_VERSION = 1;

export const TABLES = {
  kv: {
    name: 'kv',
    key: 'key',
    columns: { key: 'text', value: 'json' },
  },
  period_days: {
    name: 'period_days',
    key: 'date',
    columns: { date: 'text', flow: 'text' },
  },
  day_logs: {
    name: 'day_logs',
    key: 'date',
    columns: {
      date: 'text',
      symptoms: 'json',
      energy: 'integer',
      sleepHours: 'real',
      activity: 'text',
      need: 'text',
      bbt: 'real',
      lhTest: 'text',
      mucus: 'text',
      notes: 'text',
    },
  },
  mood_entries: {
    name: 'mood_entries',
    key: 'id',
    columns: {
      id: 'text',
      date: 'text',
      createdAt: 'text',
      mood: 'text',
      intensity: 'integer',
      tags: 'json',
      text: 'text',
      confirmedThemes: 'json',
    },
    indexes: ['date'],
  },
  pain_episodes: {
    name: 'pain_episodes',
    key: 'id',
    columns: {
      id: 'text',
      date: 'text',
      createdAt: 'text',
      regions: 'json',
      intensity: 'integer',
      qualities: 'json',
      onset: 'text',
      pattern: 'text',
      impact: 'text',
      otherSymptoms: 'json',
      heavyBleeding: 'bool',
      tried: 'json',
      helped: 'json',
      notes: 'text',
    },
    indexes: ['date'],
  },
  chat_messages: {
    name: 'chat_messages',
    key: 'id',
    columns: { id: 'text', createdAt: 'text', role: 'text', text: 'text', safety: 'text', suggestions: 'json' },
    indexes: ['createdAt'],
  },
  insight_feedback: {
    name: 'insight_feedback',
    key: 'id',
    columns: { id: 'text', status: 'text', updatedAt: 'text' },
  },
  favorites: {
    name: 'favorites',
    key: 'id',
    columns: { id: 'text', createdAt: 'text' },
  },
} satisfies Record<string, TableDef>;

export type TableName = keyof typeof TABLES;

const SQL_TYPE: Record<ColumnType, string> = { text: 'TEXT', integer: 'INTEGER', real: 'REAL', json: 'TEXT', bool: 'INTEGER' };

export function createTableSQL(t: TableDef): string {
  const cols = Object.entries(t.columns)
    .map(([c, type]) => `"${c}" ${SQL_TYPE[type]}${c === t.key ? ' PRIMARY KEY NOT NULL' : ''}`)
    .join(', ');
  const idx = (t.indexes ?? []).map((c) => `CREATE INDEX IF NOT EXISTS idx_${t.name}_${c} ON ${t.name}("${c}");`).join('\n');
  return `CREATE TABLE IF NOT EXISTS ${t.name} (${cols});\n${idx}`;
}

export function toRow(t: TableDef, obj: Record<string, unknown>): Record<string, string | number | null> {
  const row: Record<string, string | number | null> = {};
  for (const [c, type] of Object.entries(t.columns)) {
    const v = obj[c];
    if (v === undefined || v === null) row[c] = null;
    else if (type === 'json') row[c] = JSON.stringify(v);
    else if (type === 'bool') row[c] = v ? 1 : 0;
    else row[c] = v as string | number;
  }
  return row;
}

export function fromRow<T>(t: TableDef, row: Record<string, unknown>): T {
  const obj: Record<string, unknown> = {};
  for (const [c, type] of Object.entries(t.columns)) {
    const v = row[c];
    if (v === null || v === undefined) obj[c] = type === 'json' ? null : type === 'bool' ? false : null;
    else if (type === 'json') {
      try {
        obj[c] = JSON.parse(String(v));
      } catch {
        obj[c] = null;
      }
    } else if (type === 'bool') obj[c] = Boolean(v);
    else obj[c] = v;
  }
  return obj as T;
}
