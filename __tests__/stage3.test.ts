import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { generateDemo } from '../src/data/demo';
import { detectPeriods } from '../src/engines/cycle';
import { generateInsights } from '../src/engines/insights';
import {
  EMPTY_RAW,
  keepMetrics,
  mergeWearableDays,
  recentSummary,
  restingHrAcrossCycle,
  summarizeHealth,
  syncWindow,
  wearableInsights,
} from '../src/engines/wearables';
import { backtest, detectTempShift, estimateFor, labCycles, predictionLab, temperatureSeries, TempPoint } from '../src/engines/prediction';
import { buildContribution, describeContribution, giveResearchConsent, hasResearchConsent, researchEligible, withdrawResearchConsent } from '../src/engines/research';
import { RESEARCH_SYMPTOMS, validateContribution, type Contribution } from '../src/engines/researchSchema';
import { createResearchStore, parseSubmission } from '../server/src/research';
import { sendContribution, deleteContribution } from '../src/lib/research';
import { ARTICLES, contentHash } from '../src/content/library';
import { reviewStatus } from '../src/content/reviews';
import { MIGRATIONS, migrationsFrom, SCHEMA_VERSION, TABLES } from '../src/data/schema';
import { MemoryBackend } from '../src/data/storage';
import { setBackendFactory, useApp } from '../src/store/app';
import { DEFAULT_SETTINGS, EMPTY_DAY_LOG, type Settings, type WearableDay } from '../src/data/types';
import { dark, hcDark, hcLight, hasBangla, light } from '../src/theme/tokens';
import { addDays } from '../src/lib/dates';
import { localize } from '../src/i18n';

const TODAY = '2026-10-22';
const demo = generateDemo(TODAY);
const periods = detectPeriods(demo.periodDays, TODAY);
const input = { periods, dayLogs: demo.dayLogs, moods: demo.moods, pain: demo.pain, wearables: demo.wearables };

/* ------------------------------------------------------------------ */
/* Wearables                                                            */
/* ------------------------------------------------------------------ */

describe('wearable summaries', () => {
  const raw = {
    ...EMPTY_RAW,
    sleep: [
      { start: '2026-10-20T23:30:00', end: '2026-10-21T07:00:00' },
      { start: '2026-10-21T14:00:00', end: '2026-10-21T14:30:00' },
    ],
    steps: [
      { start: '2026-10-21T08:00:00', end: '2026-10-21T09:00:00', count: 3000 },
      { start: '2026-10-21T17:00:00', end: '2026-10-21T18:00:00', count: 2500 },
    ],
    restingHr: [
      { time: '2026-10-21T06:00:00', bpm: 60 },
      { time: '2026-10-21T06:30:00', bpm: 250 },
    ],
    tempDelta: [{ time: '2026-10-21T03:00:00', celsius: 0.31 }],
    bbt: [
      { time: '2026-10-21T06:00:00', celsius: 36.6 },
      { time: '2026-10-21T12:00:00', celsius: 37.1 },
    ],
  };

  test('one row per day; sleep counts toward the morning you woke, naps included', () => {
    const [d] = summarizeHealth(raw, ['sleep', 'steps', 'restingHr', 'temperature']);
    expect(d.date).toBe('2026-10-21');
    expect(d.sleepMinutes).toBe(450 + 30);
    expect(d.steps).toBe(5500);
    expect(d.restingHr).toBe(60); // 250 bpm is dropped as a device error
    expect(d.tempDelta).toBe(0.31);
    expect(d.bbt).toBe(36.6); // the first reading of the day
  });

  test('only metrics the person chose are kept', () => {
    const [d] = summarizeHealth(raw, ['steps']);
    expect(d).toMatchObject({ steps: 5500, sleepMinutes: null, restingHr: null, tempDelta: null, bbt: null });
    expect(summarizeHealth(raw, [])).toEqual([]);
  });

  test('stopping a metric clears it and drops empty days', () => {
    const days: WearableDay[] = [
      { date: '2026-10-01', sleepMinutes: 400, steps: null, restingHr: null, tempDelta: null, bbt: null, source: 'demo' },
      { date: '2026-10-02', sleepMinutes: 420, steps: 8000, restingHr: 61, tempDelta: null, bbt: null, source: 'demo' },
    ];
    const kept = keepMetrics(days, ['steps']);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ date: '2026-10-02', steps: 8000, sleepMinutes: null, restingHr: null });
  });

  test('newer rows replace older ones; sync re-reads the last two days and never more than 90', () => {
    const a = { date: '2026-10-01', sleepMinutes: 400, steps: null, restingHr: null, tempDelta: null, bbt: null, source: 'demo' as const };
    expect(mergeWearableDays([a], [{ ...a, sleepMinutes: 410 }])).toEqual([{ ...a, sleepMinutes: 410 }]);
    expect(syncWindow(null, TODAY)).toEqual({ from: addDays(TODAY, -90), to: TODAY });
    expect(syncWindow('2026-10-20T10:00:00', TODAY).from).toBe('2026-10-18');
    expect(syncWindow('2025-01-01T10:00:00', TODAY).from).toBe(addDays(TODAY, -90));
  });

  test('week summary averages what is there', () => {
    const sum = recentSummary(demo.wearables, TODAY);
    expect(sum.days).toBe(6); // the demo watch has synced up to yesterday
    expect(sum.avgSleepMinutes).toBeGreaterThan(300);
    expect(sum.avgRestingHr).toBeGreaterThan(55);
  });
});

describe('wearable patterns', () => {
  test('the demo shows the resting heart rate rise before a period, worded as common', () => {
    const i = restingHrAcrossCycle(input);
    expect(i).not.toBeNull();
    expect(i!.title).toMatch(/resting heart rate rises/);
    expect(i!.body).toMatch(/common/);
    expect(i!.how).toMatch(/cycles/);
  });

  test('wearable patterns join Insights only when wearable data is passed', () => {
    const kinds = (w: WearableDay[] | undefined) => generateInsights({ ...input, wearables: w }).map((x) => x.kind);
    expect(kinds(demo.wearables).some((k) => k.startsWith('wear_'))).toBe(true);
    expect(kinds(undefined).some((k) => k.startsWith('wear_'))).toBe(false);
  });

  test('nothing is claimed from a single cycle of readings', () => {
    const oneCycle = demo.wearables.filter((d) => d.date >= periods[periods.length - 2].start);
    expect(wearableInsights({ ...input, wearables: oneCycle }).find((x) => x.kind === 'wear_rhr_cycle')).toBeUndefined();
  });

  test('every wearable pattern explains how it was found', () => {
    for (const i of wearableInsights(input)) {
      expect(i.how.length).toBeGreaterThan(20);
      expect(i.evidence).toBeTruthy();
    }
  });
});

/* ------------------------------------------------------------------ */
/* Prediction Lab                                                       */
/* ------------------------------------------------------------------ */

function series(start: string, values: number[]): TempPoint[] {
  return values.map((value, i) => ({ date: addDays(start, i), value }));
}

describe('temperature shift (three over six)', () => {
  test('finds the rise and puts ovulation the day before', () => {
    const pts = series('2026-09-01', [36.4, 36.45, 36.4, 36.35, 36.5, 36.42, 36.44, 36.6, 36.65, 36.75, 36.7]);
    const s = detectTempShift(pts, '2026-09-01', '2026-09-30', 'bbt');
    expect(s).toMatchObject({ riseDate: '2026-09-08', ovulation: '2026-09-07', source: 'bbt' });
    expect(s!.rise).toBeGreaterThan(0.15);
  });

  test('a single high reading or a rise under 0.2 °C is not enough', () => {
    expect(detectTempShift(series('2026-09-01', [36.4, 36.45, 36.4, 36.35, 36.5, 36.42, 36.44, 36.9, 36.4, 36.45]), '2026-09-01', '2026-09-30', 'bbt')).toBeNull();
    expect(detectTempShift(series('2026-09-01', [36.4, 36.45, 36.4, 36.35, 36.5, 36.42, 36.44, 36.55, 36.56, 36.6]), '2026-09-01', '2026-09-30', 'bbt')).toBeNull();
  });

  test('the three raised readings must be on consecutive days', () => {
    const pts = series('2026-09-01', [36.4, 36.45, 36.4, 36.35, 36.5, 36.42, 36.44, 36.75]);
    pts.push({ date: '2026-09-10', value: 36.8 }, { date: '2026-09-11', value: 36.8 });
    expect(detectTempShift(pts, '2026-09-01', '2026-09-30', 'bbt')).toBeNull();
  });

  test('a thermometer reading typed in wins over an app reading for the same day', () => {
    const w: WearableDay = { date: '2026-09-01', sleepMinutes: null, steps: null, restingHr: null, tempDelta: 0.1, bbt: 36.2, source: 'demo' };
    const s = temperatureSeries([{ ...EMPTY_DAY_LOG('2026-09-01'), bbt: 36.5 }], [w]);
    expect(s.bbt).toEqual([{ date: '2026-09-01', value: 36.5 }]);
    expect(s.skin).toEqual([{ date: '2026-09-01', value: 0.1 }]);
  });
});

describe('Prediction Lab', () => {
  const lab = predictionLab({ periods, dayLogs: demo.dayLogs, wearables: demo.wearables, today: TODAY });

  test('finds a temperature rise in the demo cycles with watch data, and a usual luteal length', () => {
    const withShift = lab.cycles.filter((c) => c.shift);
    expect(withShift.length).toBeGreaterThanOrEqual(2);
    expect(withShift.every((c) => c.shift!.source === 'skin')).toBe(true);
    for (const c of withShift.filter((x) => x.luteal !== null)) expect(c.luteal).toBeGreaterThanOrEqual(11);
  });

  test('scores every method on past cycles using only the cycles before', () => {
    const scores = backtest(lab.cycles);
    expect(scores.map((s) => s.method)).toEqual(['median', 'recent', 'temperature']);
    expect(scores[0].tested).toBeGreaterThanOrEqual(2);
    // Changing a later cycle must not change an earlier estimate (no peeking ahead).
    const k = 3;
    const before = estimateFor('median', lab.cycles, k);
    const altered = lab.cycles.map((c, i) => (i > k ? { ...c, length: 60 } : c));
    expect(estimateFor('median', altered, k)).toBe(before);
  });

  test('temperature estimates need a rise; without temperature the Lab says what to log', () => {
    const none = predictionLab({ periods, dayLogs: demo.dayLogs, wearables: [], today: TODAY });
    expect(none.estimates.find((e) => e.method === 'temperature')).toBeUndefined();
    expect(none.readings).toBe(0);
    expect(none.estimates.length).toBeGreaterThan(0);
  });

  test('windows stay between ±1 and ±7 days', () => {
    for (const e of lab.estimates) {
      const half = (Date.parse(e.latest) - Date.parse(e.earliest)) / 86400000 / 2;
      expect(half).toBeGreaterThanOrEqual(1);
      expect(half).toBeLessThanOrEqual(7);
    }
  });

  test('cycles too short to judge produce no estimate', () => {
    const two = labCycles(periods.slice(0, 2), temperatureSeries([], []), TODAY);
    expect(estimateFor('median', two, 1)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Research                                                             */
/* ------------------------------------------------------------------ */

const adult = { ageRange: '25_34' as const, isDemo: false };
const consented: Settings = giveResearchConsent(DEFAULT_SETTINGS, new Date('2026-10-01T00:00:00Z'));
const researchInput = { profile: adult, settings: consented, periods, dayLogs: demo.dayLogs, moods: demo.moods, pain: demo.pain };

describe('research eligibility and consent', () => {
  test('off by default; adults only; never demo data; unsure age has to be set first', () => {
    expect(hasResearchConsent(DEFAULT_SETTINGS)).toBe(false);
    expect(researchEligible({ ageRange: '16_17', isDemo: false }).ok).toBe(false);
    expect(researchEligible({ ageRange: 'under_16', isDemo: false }).ok).toBe(false);
    expect(researchEligible({ ageRange: 'unsure', isDemo: false }).ok).toBe(false);
    expect(researchEligible({ ageRange: null, isDemo: false }).ok).toBe(false);
    expect(researchEligible({ ageRange: '25_34', isDemo: true }).ok).toBe(false);
    expect(researchEligible(adult)).toEqual({ ok: true, band: '25_34' });
  });

  test('withdrawing stops sharing but keeps delete keys', () => {
    const withReceipt = { ...consented, research: { ...consented.research, receipts: [{ id: 'a'.repeat(32), deleteKey: 'k', sentAt: '', endpoint: 'https://x' }] } };
    const w = withdrawResearchConsent(withReceipt);
    expect(hasResearchConsent(w)).toBe(false);
    expect(w.research.receipts).toHaveLength(1);
    expect('error' in buildContribution({ ...researchInput, settings: w })).toBe(true);
  });
});

describe('research contribution', () => {
  const c = buildContribution(researchInput, () => 0.99) as Contribution;

  test('passes the strict server schema', () => {
    expect('error' in c).toBe(false);
    expect(validateContribution(c)).toBe(true);
  });

  test('contains no dates, names, free text or ids', () => {
    const json = JSON.stringify(c);
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(json).not.toMatch(/Mira|Assignment|demo_/);
    expect(Object.keys(c).sort()).toEqual(['ageBand', 'consentVersion', 'cycles', 'hardMoodShare', 'pain', 'schema', 'symptoms', 'usesWearable']);
    expect(c.cycles.length).toBeLessThanOrEqual(6);
    expect([0, 0.25, 0.5, 0.75, 1, null]).toContain(c.hardMoodShare);
  });

  test('randomised response: true answers when no coin is flipped, coin flips otherwise', () => {
    expect(c.symptoms.cramps).toBe(true); // logged every cycle in the demo
    expect(c.symptoms.acne).toBe(false);
    let i = 0;
    const seq = [0.1, 0.9]; // flip, then the coin says "no"
    const flipped = buildContribution(researchInput, () => seq[i++ % 2]) as Contribution;
    expect(Object.values(flipped.symptoms).every((v) => v === false)).toBe(true);
    expect(Object.keys(flipped.symptoms).sort()).toEqual([...RESEARCH_SYMPTOMS].sort());
  });

  test('the plain-language preview matches the data', () => {
    const lines = describeContribution(c);
    expect(lines[0]).toBe('Age band: 25–34');
    expect(lines[1]).toContain(String(c.cycles[0].length));
  });

  test('the server schema rejects anything extra or out of range', () => {
    expect(validateContribution({ ...c, note: 'hi' })).toBe(false);
    expect(validateContribution({ ...c, ageBand: '16_17' })).toBe(false);
    expect(validateContribution({ ...c, cycles: [{ length: 28, periodLength: 5, start: '2026-01-01' }, c.cycles[1]] })).toBe(false);
    expect(validateContribution({ ...c, symptoms: { ...c.symptoms, fainting: true } })).toBe(false);
    expect(validateContribution({ ...c, pain: { average: 11, daysPerCycle: 2 } })).toBe(false);
    expect(parseSubmission({ contribution: c, deleteKeyHash: 'f'.repeat(64), installId: 'x' })).toBeNull();
    expect(parseSubmission({ contribution: c, deleteKeyHash: 'short' })).toBeNull();
    expect(parseSubmission({ contribution: c, deleteKeyHash: 'f'.repeat(64) })).not.toBeNull();
  });
});

describe('research store and client', () => {
  test('saves one file per contribution with only the day, and deletes with the right key only', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'petal-research-'));
    const store = createResearchStore(dir);
    const key = 'k'.repeat(64);
    const hash = createHash('sha256').update(key).digest('hex');
    const id = await store.save({ any: 'thing' }, hash, new Date('2026-10-22T13:45:00Z'));
    const saved = JSON.parse(readFileSync(path.join(dir, `${id}.json`), 'utf8'));
    expect(saved.day).toBe('2026-10-22');
    expect(JSON.stringify(saved)).not.toMatch(/13:45/);
    expect(await store.remove(id, 'wrong')).toBe('forbidden');
    expect(await store.remove('../etc', key)).toBe('forbidden');
    expect(await store.remove(id, key)).toBe('deleted');
    expect(readdirSync(dir)).toEqual([]);
    expect(await store.remove(id, key)).toBe('missing');
  });

  test('the app sends no token or install id, keeps the delete key, and deletes with it', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ id: 'a'.repeat(32) }) } as Response;
    }) as unknown as typeof fetch;
    const c = buildContribution(researchInput, () => 0.99) as Contribution;
    const r = await sendContribution('https://study.example', c, { fetchImpl, randomHex: () => 'secret', sha256: async (s) => `hash-of-${s}` });
    expect(r).toMatchObject({ id: 'a'.repeat(32), deleteKey: 'secret', endpoint: 'https://study.example' });
    const sent = calls[0];
    expect(sent.url).toBe('https://study.example/v1/research');
    expect(sent.init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(String(sent.init.body)).toContain('hash-of-secret');
    expect(String(sent.init.body)).not.toContain('"secret"');
    expect(await deleteContribution(r!, { fetchImpl })).toBe(true);
    expect(calls[1].url).toBe(`https://study.example/v1/research/${'a'.repeat(32)}`);
    expect((calls[1].init.headers as Record<string, string>)['X-Delete-Key']).toBe('secret');
  });

  test('no study address means nothing is sent', async () => {
    const c = buildContribution(researchInput, () => 0.99) as Contribution;
    expect(await sendContribution('', c)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Clinician-reviewed content                                          */
/* ------------------------------------------------------------------ */

describe('Learn library', () => {
  test('every guide has sources and matching English and Bangla sections', () => {
    expect(ARTICLES.length).toBeGreaterThanOrEqual(8);
    for (const a of ARTICLES) {
      expect(a.sources.length).toBeGreaterThan(0);
      expect(a.bn.sections).toHaveLength(a.en.sections.length);
      expect(hasBangla(a.bn.title)).toBe(true);
      for (const s of a.bn.sections) expect(hasBangla(s.body)).toBe(true);
    }
    expect(new Set(ARTICLES.map((a) => a.id)).size).toBe(ARTICLES.length);
  });

  test('Bangla uses the app’s informal তুমি voice', () => {
    for (const a of ARTICLES) expect(JSON.stringify(a.bn)).not.toMatch(/আপনি|আপনার/);
  });

  test('nothing is marked reviewed until a clinician signs off on the exact text', () => {
    const a = ARTICLES[0];
    expect(reviewStatus(a).state).toBe('awaiting');
    const review = { hash: contentHash(a), reviewer: 'Dr Test', credential: 'MBBS', date: '2026-10-22' };
    expect(reviewStatus(a, { [a.id]: review }).state).toBe('reviewed');
    const edited = { ...a, en: { ...a.en, summary: a.en.summary + ' Edited.' } };
    expect(reviewStatus(edited, { [a.id]: review }).state).toBe('changed');
  });

  test('guides that mention urgent signs point to 999', () => {
    const doc = ARTICLES.find((a) => a.id === 'see-a-doctor')!;
    expect(doc.en.sections[0].body).toMatch(/999/);
    expect(doc.bn.sections[0].body).toMatch(/৯৯৯/);
  });
});

/* ------------------------------------------------------------------ */
/* Accessibility                                                        */
/* ------------------------------------------------------------------ */

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe('accessibility', () => {
  test('high contrast themes reach at least 7:1 (AAA) for all text, and beat the normal themes', () => {
    for (const [hc, base] of [
      [hcLight, light],
      [hcDark, dark],
    ] as const) {
      for (const k of ['text', 'textMuted', 'textSoft', 'primaryText'] as const) {
        expect(contrast(hc[k], hc.bg)).toBeGreaterThanOrEqual(7);
        expect(contrast(hc[k], hc.surface)).toBeGreaterThanOrEqual(7);
        expect(contrast(hc[k], hc.bg)).toBeGreaterThanOrEqual(contrast(base[k], base.bg) - 0.01);
      }
      expect(contrast(hc.accentText, hc.accent)).toBeGreaterThanOrEqual(7);
    }
  });

  test('new settings are off or neutral by default', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ textScale: 1, highContrast: false, largeTargets: false, predictionLab: false });
    expect(DEFAULT_SETTINGS.wearables).toEqual({ enabled: false, metrics: [], lastSync: null });
    expect(DEFAULT_SETTINGS.research.consentVersion).toBeNull();
  });

  test('new screens’ copy is translated', () => {
    for (const s of ['Wearables', 'Prediction Lab', 'Learn', 'High contrast', 'Larger touch areas', 'Text size', 'Help menstrual health research', 'Awaiting clinician review']) {
      expect(hasBangla(localize('bn', s))).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Database and store                                                   */
/* ------------------------------------------------------------------ */

describe('database v2', () => {
  test('adds the wearable table and a migration path from v1', () => {
    expect(SCHEMA_VERSION).toBe(2);
    expect(TABLES.wearable_days.key).toBe('date');
    expect(MIGRATIONS[2]).toEqual([]);
    expect(migrationsFrom(2)).toEqual([]);
    expect(Array.isArray(migrationsFrom(1))).toBe(true);
  });
});

describe('store', () => {
  const KEYS = Object.fromEntries(Object.entries(TABLES).map(([k, t]) => [k, t.key]));
  beforeEach(async () => {
    const mem = new MemoryBackend(KEYS);
    setBackendFactory(() => mem);
    await useApp.getState().load();
  });

  test('wearable summaries persist, and stopping all metrics deletes them', async () => {
    const day: WearableDay = { date: '2026-10-01', sleepMinutes: 400, steps: 5000, restingHr: null, tempDelta: null, bbt: null, source: 'health_connect' };
    await useApp.getState().saveWearables([day], '2026-10-02T08:00:00Z');
    expect(useApp.getState().settings.wearables.lastSync).toBe('2026-10-02T08:00:00Z');
    await useApp.getState().load();
    expect(useApp.getState().wearables).toEqual([day]);
    await useApp.getState().pruneWearables(['steps']);
    expect(useApp.getState().wearables[0].sleepMinutes).toBeNull();
    await useApp.getState().pruneWearables([]);
    await useApp.getState().load();
    expect(useApp.getState().wearables).toEqual([]);
  });

  test('the demo connects a synthetic watch and never opts into research', async () => {
    await useApp.getState().loadDemo();
    const s = useApp.getState();
    expect(s.wearables.length).toBeGreaterThan(80);
    expect(s.wearables.every((d) => d.source === 'demo')).toBe(true);
    expect(s.settings.wearables.enabled).toBe(true);
    expect(s.settings.research.consentVersion).toBeNull();
  });

  test('the JSON export includes wearables but not research delete keys', async () => {
    await useApp.getState().updateSettings({ research: { consentVersion: 1, consentedAt: 'x', receipts: [{ id: 'a'.repeat(32), deleteKey: 'secret', sentAt: '', endpoint: 'https://x' }] } });
    const out = JSON.stringify(useApp.getState().exportAll());
    expect(out).toContain('"wearables"');
    expect(out).not.toContain('secret');
  });
});
