import { create } from 'zustand';
import { createBackend } from '../data/backend';
import type { StorageBackend } from '../data/storage';
import {
  ChatMessage,
  DayLog,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  EMPTY_DAY_LOG,
  Favorite,
  InsightFeedback,
  MoodEntry,
  PainEpisode,
  PeriodDay,
  Profile,
  Settings,
  WearableDay,
  WearableMetric,
} from '../data/types';
import { keepMetrics, mergeWearableDays } from '../engines/wearables';
import { generateDemo } from '../data/demo';
import { forgetToken } from '../lib/aiToken';
import { deleteContribution } from '../lib/research';
import { todayISO, ISODate, setDateLanguage } from '../lib/dates';

let factory: () => StorageBackend = createBackend;
let backend: StorageBackend | null = null;
/** Swap the storage backend (used by tests). */
export function setBackendFactory(f: () => StorageBackend) {
  factory = f;
  backend = null;
}
function db(): StorageBackend {
  if (!backend) backend = factory();
  return backend;
}

export interface AppState {
  ready: boolean;
  unlocked: boolean;
  encrypted: boolean;
  profile: Profile;
  settings: Settings;
  periodDays: PeriodDay[];
  dayLogs: DayLog[];
  moods: MoodEntry[];
  pain: PainEpisode[];
  chat: ChatMessage[];
  insightFeedback: InsightFeedback[];
  favorites: Favorite[];
  wearables: WearableDay[];

  load(): Promise<void>;
  setUnlocked(v: boolean): void;
  updateProfile(p: Partial<Profile>): Promise<void>;
  updateSettings(s: Partial<Settings>): Promise<void>;
  setPeriodDay(date: ISODate, flow: PeriodDay['flow'] | null): Promise<void>;
  saveDayLog(log: Partial<DayLog> & { date: ISODate }): Promise<void>;
  addMood(m: MoodEntry): Promise<void>;
  updateMood(m: MoodEntry): Promise<void>;
  deleteMood(id: string): Promise<void>;
  addPain(p: PainEpisode): Promise<void>;
  updatePain(p: PainEpisode): Promise<void>;
  deletePain(id: string): Promise<void>;
  addChat(m: ChatMessage): Promise<void>;
  clearChat(): Promise<void>;
  setInsightFeedback(id: string, status: InsightFeedback['status'] | null): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  /** Adds or replaces daily wearable summaries and records the sync time. */
  saveWearables(days: WearableDay[], syncedAt?: string): Promise<void>;
  /** Drops what was summarised for metrics no longer shared (all of it when given none). */
  pruneWearables(metrics: WearableMetric[]): Promise<void>;
  loadDemo(): Promise<void>;
  exitDemo(): Promise<void>;
  exportAll(): Record<string, unknown>;
  deleteEverything(): Promise<void>;
}

const sortByDate = <T extends { date: string }>(a: T[]) => [...a].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  unlocked: false,
  encrypted: false,
  profile: DEFAULT_PROFILE,
  settings: DEFAULT_SETTINGS,
  periodDays: [],
  dayLogs: [],
  moods: [],
  pain: [],
  chat: [],
  insightFeedback: [],
  favorites: [],
  wearables: [],

  async load() {
    const b = db();
    await b.init();
    const [profileKV, settingsKV, periodDays, dayLogs, moods, pain, chat, insightFeedback, favorites, wearables] = await Promise.all([
      b.get<{ key: string; value: Profile }>('kv', 'profile'),
      b.get<{ key: string; value: Settings }>('kv', 'settings'),
      b.all<PeriodDay>('period_days'),
      b.all<DayLog>('day_logs'),
      b.all<MoodEntry>('mood_entries'),
      b.all<PainEpisode>('pain_episodes'),
      b.all<ChatMessage>('chat_messages'),
      b.all<InsightFeedback>('insight_feedback'),
      b.all<Favorite>('favorites'),
      b.all<WearableDay>('wearable_days'),
    ]);
    const settings = { ...DEFAULT_SETTINGS, ...(settingsKV?.value ?? {}) };
    set({
      ready: true,
      encrypted: b.encrypted,
      unlocked: settings.appLock === 'off',
      profile: { ...DEFAULT_PROFILE, ...(profileKV?.value ?? {}) },
      settings,
      periodDays: sortByDate(periodDays),
      dayLogs: sortByDate(dayLogs),
      moods: sortByDate(moods),
      pain: sortByDate(pain),
      chat: [...chat].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      insightFeedback,
      favorites,
      wearables: sortByDate(wearables),
    });
  },

  setUnlocked(v) {
    set({ unlocked: v });
  },

  async updateProfile(p) {
    const profile = { ...get().profile, ...p };
    set({ profile });
    await db().put('kv', { key: 'profile', value: profile });
  },

  async updateSettings(s) {
    const settings = { ...get().settings, ...s };
    set({ settings });
    await db().put('kv', { key: 'settings', value: settings });
    if (s.aiMemory === false) await get().clearChat();
  },

  async setPeriodDay(date, flow) {
    if (flow === null) {
      set({ periodDays: get().periodDays.filter((d) => d.date !== date) });
      await db().remove('period_days', date);
      return;
    }
    const rec = { date, flow };
    set({ periodDays: sortByDate([...get().periodDays.filter((d) => d.date !== date), rec]) });
    await db().put('period_days', rec);
  },

  async saveDayLog(partial) {
    const existing = get().dayLogs.find((d) => d.date === partial.date) ?? EMPTY_DAY_LOG(partial.date);
    const log = { ...existing, ...partial };
    set({ dayLogs: sortByDate([...get().dayLogs.filter((d) => d.date !== log.date), log]) });
    await db().put('day_logs', log);
  },

  async addMood(m) {
    set({ moods: sortByDate([...get().moods, m]) });
    await db().put('mood_entries', m);
  },
  async updateMood(m) {
    set({ moods: sortByDate(get().moods.map((x) => (x.id === m.id ? m : x))) });
    await db().put('mood_entries', m);
  },
  async deleteMood(id) {
    set({ moods: get().moods.filter((m) => m.id !== id) });
    await db().remove('mood_entries', id);
  },

  async addPain(p) {
    set({ pain: sortByDate([...get().pain, p]) });
    await db().put('pain_episodes', p);
  },
  async updatePain(p) {
    set({ pain: sortByDate(get().pain.map((x) => (x.id === p.id ? p : x))) });
    await db().put('pain_episodes', p);
  },
  async deletePain(id) {
    set({ pain: get().pain.filter((p) => p.id !== id) });
    await db().remove('pain_episodes', id);
  },

  async addChat(m) {
    set({ chat: [...get().chat, m] });
    if (get().settings.aiMemory) await db().put('chat_messages', m);
  },
  async clearChat() {
    const ids = get().chat.map((c) => c.id);
    set({ chat: [] });
    for (const id of ids) await db().remove('chat_messages', id);
  },

  async setInsightFeedback(id, status) {
    if (status === null) {
      set({ insightFeedback: get().insightFeedback.filter((f) => f.id !== id) });
      await db().remove('insight_feedback', id);
      return;
    }
    const f = { id, status, updatedAt: new Date().toISOString() };
    set({ insightFeedback: [...get().insightFeedback.filter((x) => x.id !== id), f] });
    await db().put('insight_feedback', f);
  },

  async toggleFavorite(id) {
    const has = get().favorites.some((f) => f.id === id);
    if (has) {
      set({ favorites: get().favorites.filter((f) => f.id !== id) });
      await db().remove('favorites', id);
    } else {
      const f = { id, createdAt: new Date().toISOString() };
      set({ favorites: [...get().favorites, f] });
      await db().put('favorites', f);
    }
  },

  async saveWearables(days, syncedAt) {
    set({ wearables: mergeWearableDays(get().wearables, days) });
    if (days.length) await db().putMany('wearable_days', days);
    if (syncedAt) await get().updateSettings({ wearables: { ...get().settings.wearables, lastSync: syncedAt } });
  },

  async pruneWearables(metrics) {
    const before = get().wearables;
    const kept = keepMetrics(before, metrics);
    const keptDates = new Set(kept.map((d) => d.date));
    set({ wearables: kept });
    for (const d of before) if (!keptDates.has(d.date)) await db().remove('wearable_days', d.date);
    if (kept.length) await db().putMany('wearable_days', kept);
  },

  async loadDemo() {
    const settings = get().settings;
    await get().deleteEverything();
    const demo = generateDemo(todayISO());
    const b = db();
    await b.init();
    await b.putMany('period_days', demo.periodDays);
    await b.putMany('day_logs', demo.dayLogs);
    await b.putMany('mood_entries', demo.moods);
    await b.putMany('pain_episodes', demo.pain);
    await b.putMany('wearable_days', demo.wearables);
    await b.put('kv', { key: 'profile', value: demo.profile });
    const keep = {
      ...settings,
      appLock: 'off' as const,
      careMode: 'everyday' as const,
      // The demo shows a connected watch; research stays off because demo data must never be contributed.
      wearables: { enabled: true, metrics: ['sleep', 'steps', 'restingHr', 'temperature'] as WearableMetric[], lastSync: new Date().toISOString() },
      research: { consentVersion: null, consentedAt: null, receipts: [] },
    };
    await b.put('kv', { key: 'settings', value: keep });
    await get().load();
  },

  async exitDemo() {
    const { settings } = get();
    await get().deleteEverything();
    await get().updateSettings({
      language: settings.language,
      theme: settings.theme,
      reduceMotion: settings.reduceMotion,
      textScale: settings.textScale,
      highContrast: settings.highContrast,
      largeTargets: settings.largeTargets,
    });
  },

  exportAll() {
    const s = get();
    return {
      exportedAt: new Date().toISOString(),
      app: 'Petal & Pulse',
      format: 'petal-pulse-export/v1',
      isDemoData: s.profile.isDemo,
      profile: s.profile,
      // Research delete keys are left out: they only matter on this phone.
      settings: { ...s.settings, aiEndpoint: undefined, research: { ...s.settings.research, receipts: undefined } },
      periodDays: s.periodDays,
      dayLogs: s.dayLogs,
      moods: s.moods,
      pain: s.pain,
      chat: s.chat,
      favorites: s.favorites,
      wearables: s.wearables,
    };
  },

  async deleteEverything() {
    const endpoint = get().settings.aiEndpoint;
    // Ask research to delete what was sent while the delete keys still exist (best effort).
    for (const r of get().settings.research?.receipts ?? []) await deleteContribution(r).catch(() => false);
    await db().wipe();
    if (endpoint) await forgetToken(endpoint);
    backend = factory(); // fresh backend (and on native a fresh encryption key)
    set({
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      periodDays: [],
      dayLogs: [],
      moods: [],
      pain: [],
      chat: [],
      insightFeedback: [],
      favorites: [],
      wearables: [],
      unlocked: true,
    });
    await db().init();
  },
}));

// Dates and numbers follow the chosen language.
useApp.subscribe((s) => setDateLanguage(s.settings.language));
