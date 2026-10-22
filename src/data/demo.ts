/**
 * Synthetic demonstration data for a fictional user. Clearly labelled as
 * demo data everywhere it appears. Not real people, not medical validation.
 */
import { addDays, ISODate } from '../lib/dates';
import type { DayLog, Flow, Mood, MoodEntry, MoodTag, PainEpisode, PeriodDay, Profile, WearableDay } from './types';
import { DEFAULT_PROFILE, EMPTY_DAY_LOG } from './types';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface DemoData {
  profile: Profile;
  periodDays: PeriodDay[];
  dayLogs: DayLog[];
  moods: MoodEntry[];
  pain: PainEpisode[];
  wearables: WearableDay[];
}

export const DEMO_NAME = 'Mira';

export function generateDemo(today: ISODate): DemoData {
  const r = rng(20261022);
  const lengths = [28, 31, 29, 27, 30, 28]; // about six months
  const starts: ISODate[] = [];
  let s = addDays(today, -(lengths.reduce((a, b) => a + b, 0) + 1));
  for (const l of lengths) {
    starts.push(s);
    s = addDays(s, l);
  }
  starts.push(s); // current period started yesterday → cycle day 2 today

  const periodDays: PeriodDay[] = [];
  const flows: Flow[] = ['medium', 'heavy', 'medium', 'light', 'light'];
  starts.forEach((st, i) => {
    const current = i === starts.length - 1;
    const days = current ? 2 : 5;
    for (let d = 0; d < days; d++) periodDays.push({ date: addDays(st, d), flow: flows[d] });
    if (!current && r() > 0.5) periodDays.push({ date: addDays(st, -1), flow: 'spotting' });
  });

  const dayLogs: DayLog[] = [];
  const moods: MoodEntry[] = [];
  const pain: PainEpisode[] = [];
  const first = starts[0];
  let cycleIdx = 0;
  for (let d = first; d < today; d = addDays(d, 1)) {
    while (cycleIdx + 1 < starts.length && d >= starts[cycleIdx + 1]) cycleIdx++;
    const cycleStart = starts[cycleIdx];
    const next = starts[cycleIdx + 1];
    const cd = Math.round((Date.parse(d) - Date.parse(cycleStart)) / 86400000) + 1;
    const daysBefore = next ? Math.round((Date.parse(next) - Date.parse(d)) / 86400000) : 99;
    const premen = daysBefore >= 1 && daysBefore <= 5;
    const early = cd <= 2;
    const stressed = r() < 0.22;

    let sleep = 7 + (r() - 0.5) * 1.6;
    if (stressed) sleep -= 1.3 + r() * 0.6;
    if (premen) sleep -= 0.3;
    sleep = Math.round(sleep * 2) / 2;
    let energy = 3.4 + (sleep - 7) * 0.8 + (r() - 0.5);
    if (premen) energy -= 1.2;
    if (early) energy -= 1;
    energy = Math.max(1, Math.min(5, Math.round(energy)));

    if (r() < 0.82) {
      const log = EMPTY_DAY_LOG(d);
      log.sleepHours = sleep;
      log.energy = energy;
      log.activity = r() < 0.4 ? 'light' : r() < 0.7 ? 'moderate' : 'none';
      if (early) log.symptoms = ['cramps', 'fatigue'];
      else if (premen) log.symptoms = r() < 0.6 ? ['bloating', 'tender_breasts'] : ['cravings'];
      else if (r() < 0.1) log.symptoms = ['headache'];
      dayLogs.push(log);
    }

    if (r() < 0.75) {
      let mood: Mood;
      if (premen && r() < 0.7) mood = r() < 0.6 ? 'irritated' : 'exhausted';
      else if (stressed) mood = r() < 0.6 ? 'anxious' : 'overwhelmed';
      else if (early) mood = r() < 0.5 ? 'exhausted' : 'peaceful';
      else mood = (['happy', 'peaceful', 'happy', 'mixed', 'peaceful'] as Mood[])[Math.floor(r() * 5)];
      const tags: MoodTag[] = stressed ? ['stress', 'studies'] : early ? ['physical'] : premen ? (r() < 0.5 ? ['no_reason'] : ['sleep']) : [];
      moods.push({
        id: `demo_mood_${d}`,
        date: d,
        createdAt: `${d}T20:00:00.000Z`,
        mood,
        intensity: Math.max(1, Math.min(5, Math.round(2 + r() * 3))),
        tags,
        text: stressed && r() < 0.4 ? 'Assignment due and I slept badly.' : '',
        confirmedThemes: [],
      });
    }

    if (early && (cd === 1 || r() < 0.75)) {
      pain.push({
        id: `demo_pain_${d}`,
        date: d,
        createdAt: `${d}T09:30:00.000Z`,
        regions: r() < 0.6 ? ['lower_abdomen', 'lower_back'] : ['lower_abdomen'],
        intensity: Math.round(5 + r() * 2),
        qualities: ['cramping'],
        onset: 'few_hours',
        pattern: 'comes_and_goes',
        impact: r() < 0.5 ? 'a_lot' : 'a_little',
        otherSymptoms: r() < 0.3 ? ['nausea'] : [],
        heavyBleeding: false,
        tried: r() < 0.7 ? ['heat', 'position'] : ['fluids'],
        helped: r() < 0.7 ? ['heat'] : [],
        notes: '',
      });
    } else if (!early && r() < 0.04) {
      pain.push({
        id: `demo_pain_${d}`,
        date: d,
        createdAt: `${d}T15:00:00.000Z`,
        regions: ['head'],
        intensity: Math.round(3 + r() * 2),
        qualities: ['throbbing'],
        onset: 'few_hours',
        pattern: 'constant',
        impact: 'a_little',
        otherSymptoms: [],
        heavyBleeding: false,
        tried: ['rest_dark'],
        helped: ['rest_dark'],
        notes: '',
      });
    }
  }

  const profile: Profile = {
    ...DEFAULT_PROFILE,
    name: DEMO_NAME,
    ageRange: '18_24',
    goal: 'everything',
    lastPeriodStart: null,
    typicalCycleLength: 28,
    typicalPeriodLength: 5,
    regularity: 'regular',
    commonSymptoms: ['cramps', 'bloating', 'fatigue'],
    diet: 'none',
    foodRegion: 'both',
    onboardedAt: new Date().toISOString(),
    isDemo: true,
  };
  return { profile, periodDays, dayLogs, moods, pain, wearables: demoWearables(today, starts, dayLogs, moods) };
}

/**
 * About 90 days of synthetic watch data, as if Health Connect was connected
 * three months ago. Its own random stream keeps the rest of the demo unchanged.
 * Resting heart rate and night temperature rise after a calendar-estimated
 * ovulation, as they commonly do, so the Prediction Lab has something to find.
 */
function demoWearables(today: ISODate, starts: ISODate[], dayLogs: DayLog[], moods: MoodEntry[]): WearableDay[] {
  const r = rng(90210);
  const sleepBy = new Map(dayLogs.map((l) => [l.date, l.sleepHours]));
  const hard = new Set(moods.filter((m) => ['irritated', 'anxious', 'sad', 'exhausted', 'overwhelmed'].includes(m.mood)).map((m) => m.date));
  const out: WearableDay[] = [];
  for (let d = addDays(today, -90); d < today; d = addDays(d, 1)) {
    let i = 0;
    while (i + 1 < starts.length && d >= starts[i + 1]) i++;
    const next = starts[i + 1];
    const daysBefore = next ? Math.round((Date.parse(next) - Date.parse(d)) / 86400000) : 99;
    const cd = Math.round((Date.parse(d) - Date.parse(starts[i])) / 86400000) + 1;
    const afterOvulation = daysBefore >= 1 && daysBefore <= 13;
    const sleepH = sleepBy.get(d) ?? 7 + (r() - 0.5);
    let steps = 6500 + (r() - 0.5) * 4000;
    // Harder days are often quieter ones, but not always, and quiet days aren't always hard.
    if (hard.has(d) ? r() < 0.6 : r() < 0.15) steps -= 2500 + r() * 2000;
    if (cd <= 2) steps -= 2500;
    out.push({
      date: d,
      sleepMinutes: Math.round(sleepH * 60 + (r() - 0.5) * 30),
      steps: Math.max(600, Math.round(steps)),
      restingHr: Math.round((61 + (afterOvulation ? 2.6 : 0) + (r() - 0.5) * 1.6) * 10) / 10,
      tempDelta: Math.round(((afterOvulation ? 0.32 : -0.08) + (r() - 0.5) * 0.12) * 100) / 100,
      bbt: null,
      source: 'demo',
    });
  }
  return out;
}
