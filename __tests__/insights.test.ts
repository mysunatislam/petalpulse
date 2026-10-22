import { generateDemo } from '../src/data/demo';
import { detectPeriods, getCycleStatus } from '../src/engines/cycle';
import { generateInsights, painAroundBleeding, pearson, sleepAndEnergy, summarizePain } from '../src/engines/insights';
import { recommendMeals, comfortPath, gentlePlan, suggestCareMode, suggestThemes } from '../src/engines/personalization';
import { buildReportHtml } from '../src/engines/report';
import { deviceReply } from '../src/engines/conversation';
import { MEALS } from '../src/data/meals';
import { EMPTY_DAY_LOG } from '../src/data/types';

const TODAY = '2026-10-22';
const demo = generateDemo(TODAY);
const periods = detectPeriods(demo.periodDays, TODAY);

describe('demo data', () => {
  test('has three+ months and a current period starting yesterday', () => {
    expect(periods.length).toBe(5);
    const status = getCycleStatus({ periodDays: demo.periodDays, profile: demo.profile, today: TODAY });
    expect(status.cycleDay).toBe(2);
    expect(status.phase).toBe('menstrual');
    expect(status.confidence).toBe('high');
    expect(demo.profile.isDemo).toBe(true);
  });
  test('produces meaningful but non-causal insights', () => {
    const ins = generateInsights({ periods, dayLogs: demo.dayLogs, moods: demo.moods, pain: demo.pain });
    const kinds = ins.map((i) => i.kind);
    expect(kinds).toContain('pain_bleeding');
    expect(ins.length).toBeGreaterThanOrEqual(3);
    for (const i of ins) {
      expect(i.body).not.toMatch(/\bcause[sd]?\b|because of your hormones/i);
      expect(i.how.length).toBeGreaterThan(20);
    }
  });
  test('dismissed insights are hidden', () => {
    const ins = generateInsights({ periods, dayLogs: demo.dayLogs, moods: demo.moods, pain: demo.pain });
    const after = generateInsights({ periods, dayLogs: demo.dayLogs, moods: demo.moods, pain: demo.pain }, new Set([ins[0].id]));
    expect(after.find((i) => i.id === ins[0].id)).toBeUndefined();
  });
});

describe('minimum data requirements', () => {
  test('no insights from one cycle or a few days', () => {
    expect(generateInsights({ periods: periods.slice(0, 1), dayLogs: demo.dayLogs.slice(0, 5), moods: demo.moods.slice(0, 5), pain: demo.pain.slice(0, 2) })).toEqual([]);
  });
  test('sleep/energy needs 10 paired days', () => {
    const logs = Array.from({ length: 9 }, (_, i) => ({ ...EMPTY_DAY_LOG(`2026-01-${String(i + 1).padStart(2, '0')}`), sleepHours: 5 + i * 0.4, energy: 1 + Math.floor(i / 2) }));
    expect(sleepAndEnergy({ periods: [], dayLogs: logs, moods: [], pain: [] })).toBeNull();
  });
  test('pearson handles constant data', () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });
  test('pain insight needs at least two cycles with early pain', () => {
    expect(painAroundBleeding({ periods: periods.slice(0, 1), dayLogs: [], moods: [], pain: demo.pain })).toBeNull();
  });
});

describe('pain summary', () => {
  test('summarises frequency, intensity, regions and timing', () => {
    const s = summarizePain(demo.pain, periods, '2026-07-01', TODAY);
    expect(s.episodes).toBeGreaterThan(0);
    expect(s.maxIntensity).toBeLessThanOrEqual(10);
    expect(s.topRegions[0].region).toBe('lower_abdomen');
    expect(s.timing.duringBleeding).toBeGreaterThan(0);
  });
  test('empty range is safe', () => {
    const s = summarizePain([], [], '2026-01-01', '2026-01-31');
    expect(s.avgIntensity).toBeNull();
    expect(s.episodes).toBe(0);
  });
  test('PDF HTML marks demo data and escapes user text', () => {
    const status = getCycleStatus({ periodDays: demo.periodDays, profile: demo.profile, today: TODAY });
    const pain = [...demo.pain, { ...demo.pain[demo.pain.length - 1], id: 'evil', notes: '<script>alert(1)</script>' }];
    const html = buildReportHtml(
      { from: '2026-07-01', to: TODAY, includeCycle: true, includePain: true, includeMood: true, includeSymptoms: true, includeNotes: true },
      { profile: demo.profile, status, periods, pain, moods: demo.moods, dayLogs: demo.dayLogs },
    );
    expect(html).toMatch(/DEMO DATA/);
    expect(html).not.toMatch(/<script>/);
    expect(html).toMatch(/&lt;script&gt;/);
  });
});

describe('personalization', () => {
  test('respects diet and allergies', () => {
    const picks = recommendMeals({ profile: { diet: 'vegan', allergies: ['nuts', 'soy'], foodRegion: 'both' }, symptoms: ['cramps'], bleeding: true, energy: 2, appetite: null }, 10);
    for (const p of picks) {
      const c = p.meal.contains;
      expect(c.meat || c.fish || c.egg || c.dairy || c.nuts || c.soy).toBeFalsy();
    }
  });
  test('bleeding favours iron-rich meals', () => {
    const picks = recommendMeals({ profile: { diet: 'none', allergies: [], foodRegion: 'bangladeshi' }, symptoms: [], bleeding: true, energy: 3, appetite: null });
    expect(picks[0].meal.tags).toContain('iron');
    expect(picks.every((p) => p.meal.region === 'bangladeshi')).toBe(true);
  });
  test('no meal makes hormone-balancing or cure claims', () => {
    for (const m of MEALS) expect(m.why).not.toMatch(/balance (your )?hormones|cure|detox/i);
  });
  test('comfort path suits the region and never promises a cure', () => {
    const c = comfortPath({ regions: ['head'], intensity: 3, qualities: ['throbbing'] });
    expect(c.map((x) => x.id)).toContain('rest_dark');
    expect(c.map((x) => x.id)).not.toContain('heat');
    for (const x of c) expect(x.detail).not.toMatch(/cure|will stop/i);
  });
  test('things that helped before come first', () => {
    const c = comfortPath({ regions: ['lower_abdomen'], intensity: 5, qualities: [] }, ['breathing']);
    expect(c[0].id).toBe('breathing');
  });
  test('gentle plan has no guilt language', () => {
    const plan = gentlePlan({ mood: 'exhausted', bodyScore: 2, need: 'rest', painIntensity: 6, phase: 'menstrual' });
    expect(plan.length).toBeGreaterThanOrEqual(3);
    for (const p of plan) expect(p).not.toMatch(/must|should have|streak|failed/i);
  });
  test('care mode is suggested, never applied', () => {
    expect(suggestCareMode(8, null, 'everyday')?.mode).toBe('comfort');
    expect(suggestCareMode(8, null, 'comfort')).toBeNull();
    expect(suggestCareMode(null, 'overwhelmed', 'everyday')?.mode).toBe('quiet');
  });
  test('journal themes are suggestions', () => {
    expect(suggestThemes('Exam tomorrow and I slept badly')).toEqual(expect.arrayContaining(['Pressure from studies or work', 'Tiredness and sleep']));
    expect(suggestThemes('')).toEqual([]);
  });
});

describe('device companion', () => {
  test('mentions a recurring pattern with caveats when shared', () => {
    const r = deviceReply('I don’t know why I’m so irritated today. Everything feels annoying.', [], { language: 'en', patterns: ['You logged feeling irritated around this part of your last 3 cycles.'] });
    expect(r.text).toMatch(/exhausting|grating/);
    expect(r.text).toMatch(/irritated/);
    expect(r.text).toMatch(/stress, sleep, and other things/);
    expect(r.suggestions).toEqual(['Talk it out', 'Try a calming activity', 'See my patterns', 'Just log how I feel']);
  });
  test('pattern mentions read as one clean sentence', () => {
    const r = deviceReply('My stomach hurts so much.', [], { language: 'en', patterns: ['Across your last 5 periods, you recorded cramps on the first two days of bleeding.'] });
    expect(r.text).toMatch(/cramps/);
    expect(r.text).not.toMatch(/\.\./);
  });
  test('exam + period gets a comfort plan offer', () => {
    expect(deviceReply('I have an exam tomorrow and my period just started.', [], { language: 'en' }).text).toMatch(/difficult timing|a lot at once/);
  });
  test('replies in Bangla to Bangla messages', () => {
    expect(deviceReply('আমার পেটে খুব ব্যথা', [], { language: 'en' }).text).toMatch(/[ঀ-৿]/);
  });
  test('does not guess phase when estimates are limited', () => {
    const r = deviceReply('what phase am I in?', [], { language: 'en', cycle: { cycleDay: 12, phase: 'unknown', limited: true, confidence: 'low' } });
    expect(r.text).toMatch(/don’t want to guess/);
  });
});
