import { useApp, setBackendFactory } from '../src/store/app';
import { MemoryBackend } from '../src/data/storage';
import { TABLES, createTableSQL, toRow, fromRow } from '../src/data/schema';
import { applyConsentChange, describeSharing, validatePin, isMinor } from '../src/engines/privacy';
import { buildContext } from '../src/engines/conversation';
import { DEFAULT_SETTINGS } from '../src/data/types';
import { inQuietHours, COPY } from '../src/lib/notifications';

const KEYS = Object.fromEntries(Object.entries(TABLES).map(([k, t]) => [k, t.key]));
let mem: MemoryBackend;

beforeEach(async () => {
  mem = new MemoryBackend(KEYS);
  setBackendFactory(() => mem);
  await useApp.getState().load();
});

describe('consent', () => {
  test('cloud AI is off by default, and on-device is explained', () => {
    expect(DEFAULT_SETTINGS.aiCloudConsent).toBe(false);
    expect(describeSharing(DEFAULT_SETTINGS)[0]).toMatch(/Nothing leaves your device/);
  });
  test('turning off Petal also revokes cloud consent', () => {
    const s = applyConsentChange({ ...DEFAULT_SETTINGS, aiCloudConsent: true }, 'aiEnabled', false);
    expect(s.aiCloudConsent).toBe(false);
  });
  test('context only contains what was consented to', () => {
    const data = { name: 'A', status: null, moods: [{ date: '2026-01-01', mood: 'sad' as const, tags: [] }], pain: [{ date: '2026-01-01', intensity: 5, regions: ['head'] }], sleep: [7], insights: [] };
    const none = buildContext({ aiUseCycleContext: false, aiUseMoodPainContext: false, language: 'en' }, data);
    expect(none.recentMoods).toBeUndefined();
    expect(none.recentPain).toBeUndefined();
    expect(none.cycle).toBeUndefined();
    const some = buildContext({ aiUseCycleContext: false, aiUseMoodPainContext: true, language: 'en' }, data);
    expect(some.recentMoods).toHaveLength(1);
  });
  test('disabling memory clears stored conversation', async () => {
    await useApp.getState().addChat({ id: 'c1', createdAt: '1', role: 'user', text: 'hello' });
    expect(await mem.all('chat_messages')).toHaveLength(1);
    await useApp.getState().updateSettings({ aiMemory: false });
    expect(useApp.getState().chat).toHaveLength(0);
    expect(await mem.all('chat_messages')).toHaveLength(0);
    await useApp.getState().addChat({ id: 'c2', createdAt: '2', role: 'user', text: 'not stored' });
    expect(await mem.all('chat_messages')).toHaveLength(0);
  });
  test('minors are identified for extra protections', () => {
    expect(isMinor('under_16')).toBe(true);
    expect(isMinor('18_24')).toBe(false);
  });
});

describe('data lifecycle', () => {
  test('records persist and reload', async () => {
    await useApp.getState().setPeriodDay('2026-05-01', 'heavy');
    await useApp.getState().saveDayLog({ date: '2026-05-01', energy: 2 });
    await useApp.getState().load();
    expect(useApp.getState().periodDays).toEqual([{ date: '2026-05-01', flow: 'heavy' }]);
    expect(useApp.getState().dayLogs[0].energy).toBe(2);
  });
  test('removing a bleeding day deletes it', async () => {
    await useApp.getState().setPeriodDay('2026-05-01', 'heavy');
    await useApp.getState().setPeriodDay('2026-05-01', null);
    expect(await mem.all('period_days')).toHaveLength(0);
  });
  test('export contains everything and no endpoint secrets', async () => {
    await useApp.getState().updateSettings({ aiEndpoint: 'https://secret.example' });
    await useApp.getState().setPeriodDay('2026-05-01', 'light');
    const ex = useApp.getState().exportAll() as { periodDays: unknown[]; settings: { aiEndpoint?: string } };
    expect(ex.periodDays).toHaveLength(1);
    expect(ex.settings.aiEndpoint).toBeUndefined();
  });
  test('delete everything wipes all tables and resets state', async () => {
    await useApp.getState().loadDemo();
    expect(useApp.getState().profile.isDemo).toBe(true);
    expect((await mem.all('mood_entries')).length).toBeGreaterThan(10);
    await useApp.getState().deleteEverything();
    for (const t of Object.keys(TABLES)) expect(await mem.all(t as keyof typeof TABLES)).toHaveLength(0);
    const s = useApp.getState();
    expect(s.periodDays).toHaveLength(0);
    expect(s.moods).toHaveLength(0);
    expect(s.profile.onboardedAt).toBeNull();
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('schema', () => {
  test('creates every table with a primary key', () => {
    for (const t of Object.values(TABLES)) expect(createTableSQL(t)).toMatch(new RegExp(`"${t.key}" TEXT PRIMARY KEY NOT NULL`));
  });
  test('row mapping round-trips json and booleans', () => {
    const t = TABLES.pain_episodes;
    const obj = { id: 'p', date: '2026-01-01', createdAt: 'x', regions: ['head'], intensity: 3, qualities: [], onset: null, pattern: null, impact: null, otherSymptoms: [], heavyBleeding: true, tried: [], helped: [], notes: '' };
    expect(fromRow(t, toRow(t, obj))).toEqual(obj);
  });
});

describe('security & notifications', () => {
  test('PIN rules reject weak PINs', () => {
    expect(validatePin('1234')).not.toBeNull();
    expect(validatePin('0000')).not.toBeNull();
    expect(validatePin('12a4')).not.toBeNull();
    expect(validatePin('2580')).toBeNull();
  });
  test('quiet hours across midnight', () => {
    expect(inQuietHours('23:30', '22:00', '08:00')).toBe(true);
    expect(inQuietHours('07:59', '22:00', '08:00')).toBe(true);
    expect(inQuietHours('12:00', '22:00', '08:00')).toBe(false);
  });
  test('discreet notifications never mention periods, pain or mood', () => {
    for (const c of [COPY.checkin.discreet, COPY.headsUp.discreet]) expect(`${c.title} ${c.body}`).not.toMatch(/period|pain|mood|cycle|cramp/i);
  });
});
