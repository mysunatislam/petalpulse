import { generateDemo } from '../src/data/demo';
import { detectPeriods, getCycleStatus } from '../src/engines/cycle';
import { generateInsights } from '../src/engines/insights';
import { buildLongitudinal, cycleLengthPattern, cycleTimeline, moodMirror, painTrend, periodLengthPattern, recurringSymptoms, usualSymptoms } from '../src/engines/patterns';
import { comfortPath, IRON_TIP, nourishFocus, recommendMeals, whatHelps } from '../src/engines/personalization';
import { buildReportHtml } from '../src/engines/report';
import { deviceReply, detectIntent, respond } from '../src/engines/conversation';
import { localize } from '../src/i18n';
import { hasBangla } from '../src/theme/tokens';
import { addDays } from '../src/lib/dates';
import { EMPTY_DAY_LOG, type DayLog, type PainEpisode, type PeriodDay, type Symptom } from '../src/data/types';

const TODAY = '2026-10-22';
const demo = generateDemo(TODAY);
const demoPeriods = detectPeriods(demo.periodDays, TODAY);
const demoInput = { periods: demoPeriods, dayLogs: demo.dayLogs, moods: demo.moods, pain: demo.pain };

/** Periods starting on the given dates, each `bleed` days long, plus a current one. */
function periodsFrom(lengths: number[], bleed: number | number[] = 5) {
  const days: PeriodDay[] = [];
  let start = '2026-01-05';
  const starts: string[] = [];
  [...lengths, 0].forEach((len, i) => {
    starts.push(start);
    const b = Array.isArray(bleed) ? (bleed[i] ?? 5) : bleed;
    for (let d = 0; d < b; d++) days.push({ date: addDays(start, d), flow: 'medium' });
    start = addDays(start, len);
  });
  return { periods: detectPeriods(days, addDays(starts[starts.length - 1], 2)), starts };
}

function logsWith(starts: string[], pick: (cycleDay: number, daysBefore: number) => Symptom[]): DayLog[] {
  const logs: DayLog[] = [];
  for (let i = 0; i < starts.length - 1; i++) {
    for (let d = starts[i]; d < starts[i + 1]; d = addDays(d, 1)) {
      const cd = Math.round((Date.parse(d) - Date.parse(starts[i])) / 86400000) + 1;
      const before = Math.round((Date.parse(starts[i + 1]) - Date.parse(d)) / 86400000);
      logs.push({ ...EMPTY_DAY_LOG(d), symptoms: pick(cd, before) });
    }
  }
  return logs;
}

const painOn = (date: string, intensity: number, extra: Partial<PainEpisode> = {}): PainEpisode => ({
  id: `p_${date}`,
  date,
  createdAt: `${date}T10:00:00.000Z`,
  regions: ['lower_abdomen'],
  intensity,
  qualities: ['cramping'],
  onset: 'today',
  pattern: 'comes_and_goes',
  impact: 'a_little',
  otherSymptoms: [],
  heavyBleeding: false,
  tried: [],
  helped: [],
  notes: '',
  ...extra,
});

describe('multi-cycle patterns', () => {
  test('cycle by cycle rows', () => {
    const rows = cycleTimeline(demoInput);
    expect(rows).toHaveLength(7);
    expect(rows.slice(0, -1).map((r) => r.length)).toEqual([28, 31, 29, 27, 30, 28]);
    expect(rows[rows.length - 1].length).toBeNull();
  });

  test('wide variation in cycle length is noticed, gently', () => {
    const { periods } = periodsFrom([24, 35, 27, 33]);
    const i = cycleLengthPattern({ periods, dayLogs: [], moods: [], pain: [] });
    expect(i?.kind).toBe('cycle_variability');
    expect(i?.how).toMatch(/24, 35, 27, 33 days/);
    expect(i?.body).toMatch(/worth mentioning to a doctor/);
  });

  test('steady cycles and too few cycles give nothing', () => {
    expect(cycleLengthPattern({ periods: periodsFrom([28, 29, 28, 30]).periods, dayLogs: [], moods: [], pain: [] })).toBeNull();
    expect(cycleLengthPattern({ periods: periodsFrom([24, 35]).periods, dayLogs: [], moods: [], pain: [] })).toBeNull();
  });

  test('a gradual shift is described without alarm', () => {
    const i = cycleLengthPattern({ periods: periodsFrom([26, 26, 27, 29, 30, 30]).periods, dayLogs: [], moods: [], pain: [] });
    expect(i?.kind).toBe('cycle_shift');
    expect(i?.title).toBe('Your recent cycles have been a little longer');
  });

  test('periods often over 7 days are flagged for a doctor', () => {
    const i = periodLengthPattern({ periods: periodsFrom([28, 28, 28, 28], [9, 5, 9, 9]).periods, dayLogs: [], moods: [], pain: [] });
    expect(i?.kind).toBe('period_length');
    expect(i?.body).toMatch(/3 of your last 4 periods/);
  });

  test('a symptom that keeps coming back before the period is found', () => {
    const { periods, starts } = periodsFrom([28, 28, 28, 28]);
    const dayLogs = logsWith(starts, (cd, before) => (before >= 1 && before <= 3 ? ['headache'] : cd <= 2 ? ['cramps'] : []));
    const found = recurringSymptoms({ periods, dayLogs, moods: [], pain: [] });
    expect(found.map((i) => i.title)).toEqual(['Before your period, you often log headache']);
    expect(usualSymptoms({ periods, dayLogs, moods: [], pain: [] }, 'before_period')).toEqual(['headache']);
  });

  test('a symptom that shows up all the time is not called a cycle pattern', () => {
    const { periods, starts } = periodsFrom([28, 28, 28, 28]);
    const dayLogs = logsWith(starts, () => ['bloating']);
    expect(recurringSymptoms({ periods, dayLogs, moods: [], pain: [] })).toEqual([]);
  });

  test('fainting and fever are left to the Safety Engine', () => {
    const { periods, starts } = periodsFrom([28, 28, 28, 28]);
    const dayLogs = logsWith(starts, (cd) => (cd <= 2 ? ['fainting'] : []));
    expect(recurringSymptoms({ periods, dayLogs, moods: [], pain: [] })).toEqual([]);
  });

  test('rising period pain is noticed and shown first', () => {
    const { periods, starts } = periodsFrom([28, 28, 28, 28, 28]);
    const pain = starts.slice(0, 5).map((s, i) => painOn(s, [4, 4, 5, 7, 9][i]));
    const input = { periods, dayLogs: [], moods: [], pain };
    expect(painTrend(input)?.body).toMatch(/5, 7, 9 out of 10/);
    expect(generateInsights(input)[0].kind).toBe('pain_trend');
  });

  test('steady pain gives no trend', () => {
    const { periods, starts } = periodsFrom([28, 28, 28, 28, 28]);
    const pain = starts.slice(0, 5).map((s) => painOn(s, 6));
    expect(painTrend({ periods, dayLogs: [], moods: [], pain })).toBeNull();
  });

  test('every pattern stays an observation, not a cause', () => {
    for (const i of generateInsights(demoInput)) expect(`${i.title} ${i.body} ${i.how}`).not.toMatch(/\bcause[sd]?\b(?! the other)|because of your hormones|diagnos/i);
  });
});

describe('Mood Mirror', () => {
  test('needs two full cycles and a dozen check-ins', () => {
    expect(moodMirror(demo.moods, demoPeriods.slice(0, 2))).toBeNull();
    expect(moodMirror(demo.moods.slice(0, 5), demoPeriods)).toBeNull();
  });
  test('shows moods across the cycle with a gentle reflection', () => {
    const m = moodMirror(demo.moods, demoPeriods);
    expect(m?.rows.map((r) => r.part)).toEqual(['period', 'after_period', 'middle', 'before_period']);
    const before = m?.rows.find((r) => r.part === 'before_period');
    expect(before?.topMood).toBe('irritated');
    expect(m?.reflection).toMatch(/gentle mirror, not a rule/);
  });
});

describe('Comfort Path that learns', () => {
  const ep = { regions: ['lower_abdomen' as const], intensity: 6, qualities: ['cramping' as const] };
  test('something that keeps not helping sinks, with a note', () => {
    const history = [1, 2, 3].map((n) => painOn(`2026-0${n}-01`, 6, { tried: ['heat'], helped: [] }));
    const c = comfortPath(ep, history);
    const heat = c.find((x) => x.id === 'heat');
    expect(c[0].id).not.toBe('heat');
    expect(heat?.note).toMatch(/Hasn’t helped/);
  });
  test('something that helped similar pain is offered even if the rules would not', () => {
    const history = [painOn('2026-01-01', 5, { tried: ['rest_dark'], helped: ['rest_dark'] })];
    expect(comfortPath(ep, history).map((x) => x.id)).toContain('rest_dark');
  });
  test('asking about pain relief is never dropped for stronger pain', () => {
    const history = [1, 2, 3, 4].map((n) => painOn(`2026-0${n}-01`, 7, { tried: ['pharmacist'], helped: [] }));
    expect(comfortPath({ ...ep, intensity: 7 }, history).map((x) => x.id)).toContain('pharmacist');
  });
  test('what tends to help, from the demo', () => {
    const top = whatHelps(demo.pain);
    expect(top.map((x) => x.item.id)).toContain('heat');
    expect(top.map((x) => x.item.id)).not.toContain('position'); // tried often, never marked as helping
    for (const x of top) expect(x.helped).toBeLessThanOrEqual(x.tried);
  });
});

describe('enhanced nutrition', () => {
  const profile = { diet: 'none' as const, allergies: [], foodRegion: 'both' as const };
  test('cravings get satisfying, fibre-rich ideas', () => {
    const picks = recommendMeals({ profile, symptoms: ['cravings'], bleeding: false, energy: 3, appetite: null, phase: 'luteal' });
    expect(picks[0].meal.tags).toEqual(expect.arrayContaining(['fiber']));
  });
  test('iron-rich meals without vitamin C get a pairing tip while bleeding', () => {
    const picks = recommendMeals({ profile, symptoms: [], bleeding: true, energy: 3, appetite: null }, 21);
    const tipped = picks.filter((p) => p.tip);
    expect(tipped.length).toBeGreaterThan(0);
    for (const p of tipped) expect(p.meal.tags.includes('iron') && !p.meal.tags.includes('vitamin_c')).toBe(true);
    expect(tipped[0].tip).toBe(IRON_TIP);
  });
  test('allergies still win', () => {
    const picks = recommendMeals({ profile: { ...profile, allergies: ['nuts', 'gluten'] }, symptoms: ['cravings'], bleeding: false, energy: 2, appetite: null }, 21);
    expect(picks.map((p) => p.meal.id)).not.toContain('banana_peanut_toast');
  });
  test('today’s focus plans ahead from past cycles', () => {
    expect(nourishFocus({ bleeding: true, symptoms: [], energy: null }).title).toBe('Today’s focus: iron and warmth');
    const f = nourishFocus({ bleeding: false, symptoms: [], phase: 'luteal', usuallyBefore: ['cravings'], energy: null });
    expect(f.points.join(' ')).toMatch(/Cravings often come up for you/);
    for (const p of f.points) expect(p).not.toMatch(/avoid|cut out|must|detox/i);
  });
});

describe('six-month view', () => {
  const from = addDays(TODAY, -183);
  test('month by month and cycle by cycle', () => {
    const lg = buildLongitudinal({ ...demoInput, from, to: TODAY });
    expect(lg.months.map((m) => m.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(lg.summary.cycleCount).toBe(6);
    expect(lg.summary.minLength).toBe(27);
    expect(lg.summary.maxLength).toBe(31);
    expect(lg.cycles[lg.cycles.length - 1].length).toBeNull();
  });
  test('the clinician PDF gets a changes-over-time section', () => {
    const status = getCycleStatus({ periodDays: demo.periodDays, profile: demo.profile, today: TODAY });
    const base = { from, to: TODAY, includeCycle: false, includePain: false, includeSymptoms: false, includeNotes: false, includeTrends: true };
    const data = { profile: demo.profile, status, periods: demoPeriods, pain: demo.pain, moods: demo.moods, dayLogs: demo.dayLogs };
    const html = buildReportHtml({ ...base, includeMood: false }, data);
    expect(html).toMatch(/Changes over time/);
    expect(html).toMatch(/<svg/);
    expect(html).toMatch(/Month by month/);
    expect(html).not.toMatch(/Hard-mood check-ins<\/th>/);
    expect(buildReportHtml({ ...base, includeMood: true }, data)).toMatch(/Hard-mood check-ins<\/th>/);
  });
});

describe('Bangla conversation', () => {
  const ctx = { language: 'bn' as const };
  test.each([
    ['জানি না আজ কেন এত বিরক্ত লাগছে।', 'irritated'],
    ['আমার পেট খুব ব্যথা করছে।', 'pain'],
    ['কাল আমার পরীক্ষা, আর এইমাত্র পিরিয়ড শুরু হলো।', 'exam_period'],
    ['আমি শুধু চাই কেউ আমার কথা শুনুক।', 'listen'],
    ['কথা বলি', 'listen'],
    ['খুব মন খারাপ', 'sad'],
    ['ভালো লাগছে না', 'sad'],
    ['একটু ভালো লাগছে', 'better'],
    ['এখনো টেনশন লাগছে', 'calm'],
    ['খুব টেনশন হচ্ছে', 'anxious'],
    ['পিরিয়ড এখনো আসছে না', 'late'],
    ['ami khub klanto', 'tired'],
    ['amar pet e onek betha', 'pain'],
  ])('%s → %s', (text, intent) => expect(detectIntent(text)).toBe(intent));

  test('replies are in Bangla, with Bangla numbers for the cycle', () => {
    const r = deviceReply('আমি কোন পর্যায়ে আছি?', [], { ...ctx, cycle: { cycleDay: 12, phase: 'follicular', limited: false, confidence: 'high', nextPeriod: '2026-11-17 to 2026-11-21' } });
    expect(r.text).toMatch(/১২ নম্বর দিন/);
    expect(r.text).toMatch(/ফলিকুলার/);
    expect(r.text).toMatch(/১৭ নভেম্বর/);
    expect(r.text).not.toMatch(/[A-Za-z]/);
  });

  test('every intent has a Bangla reply', () => {
    for (const t of ['হাই', 'ধন্যবাদ', 'ঘুম আসছে না', 'কী খাব?', 'আমার ধরন দেখাও', 'শুধু কেমন লাগছে লিখি', 'শান্ত হওয়ার কিছু করি', 'এটা কী']) {
      expect(hasBangla(deviceReply(t, [], ctx).text)).toBe(true);
    }
  });

  test('Bangla pattern mentions come from Insights', () => {
    const r = deviceReply('আমার পেট খুব ব্যথা করছে।', [], { ...ctx, patterns: ['Across your last 5 periods, you recorded cramps on the first two days of bleeding more often than on other days.'] });
    expect(r.text).toMatch(/তোমার নোটে একটা জিনিস চোখে পড়েছে/);
    expect(r.text).not.toMatch(/[A-Za-z]{3}/);
  });

  test('English stays English even when the app is in Bangla', () => {
    expect(deviceReply('My stomach hurts so much.', [], ctx).text).toMatch(/[A-Za-z]{4}/);
  });

  test('Banglish crisis messages are caught and answered in Bangla', async () => {
    const fetchImpl = jest.fn();
    const settings = { aiCloudConsent: true, aiEndpoint: 'https://example.test', aiResponseLength: 'medium' as const, aiMemory: false };
    for (const text of ['ami r bachte chai na', 'amar more jete chai', 'আর বাঁচতে ইচ্ছা করে না']) {
      const r = await respond(text, [], { language: 'en' }, { settings, fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(r.safety).toBe('crisis');
      expect(hasBangla(r.text)).toBe(true);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('Bangla for Stage 2 text', () => {
  test('every new pattern, note and focus line translates', () => {
    const { periods, starts } = periodsFrom([24, 35, 27, 33, 28]);
    const dayLogs = logsWith(starts, (_cd, before) => (before >= 1 && before <= 3 ? ['headache'] : []));
    const pain = starts.slice(0, 5).map((s, i) => painOn(s, [4, 4, 5, 7, 9][i]));
    const texts = [
      ...generateInsights({ periods, dayLogs, moods: [], pain }).flatMap((i) => [i.title, i.body, i.how, i.evidence]),
      ...generateInsights({ periods: periodsFrom([26, 26, 27, 29, 30, 30]).periods, dayLogs: [], moods: [], pain: [] }).flatMap((i) => [i.title, i.body, i.how]),
      ...generateInsights({ periods: periodsFrom([28, 28, 28, 28], [9, 5, 9, 9]).periods, dayLogs: [], moods: [], pain: [] }).flatMap((i) => [i.title, i.body, i.how, i.evidence]),
      ...generateInsights(demoInput).flatMap((i) => [i.title, i.body, i.how]),
      moodMirror(demo.moods, demoPeriods)?.reflection ?? '',
      'Helped you 2 of 3 times',
      'Helped you 1 of 1 time',
      ...nourishFocus({ bleeding: true, symptoms: ['bloating'], energy: 1 }).points,
      ...nourishFocus({ bleeding: false, symptoms: [], phase: 'luteal', usuallyBefore: ['cravings', 'bloating'], energy: null }).points,
    ];
    const missing = texts.filter((s) => s && !hasBangla(localize('bn', s)));
    expect(missing).toEqual([]);
  });
});
