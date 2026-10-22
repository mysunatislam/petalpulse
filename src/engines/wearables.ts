/**
 * Wearables (Stage 3)
 *
 * Reads sleep, steps, resting heart rate and temperature that the person has
 * chosen to share from Health Connect, summarises them into one row per day
 * on the phone, and looks for patterns next to the cycle, pain and mood logs.
 * Raw readings are never stored and nothing is written back to Health Connect.
 * Like the other engines, every pattern is an observation with its evidence
 * and a minimum amount of data, never a cause or a diagnosis.
 */
import { addDays, diffDays, ISODate, todayISO } from '../lib/dates';
import type { Mood, WearableDay, WearableMetric } from '../data/types';
import type { Insight, InsightInput } from './insights';

export const WEARABLE_METRICS: Record<WearableMetric, { title: string; detail: string; icon: string }> = {
  sleep: { title: 'Sleep', detail: 'How long you slept each night, to compare with energy, mood and pain.', icon: '🌙' },
  steps: { title: 'Steps', detail: 'Daily step count, to see how movement sits next to pain and mood.', icon: '👟' },
  restingHr: { title: 'Resting heart rate', detail: 'It often rises a little in the second half of the cycle. Used for patterns and the Prediction Lab.', icon: '♡' },
  temperature: { title: 'Temperature', detail: 'Night-time skin temperature from a watch or ring, or basal body temperature from a thermometer app. Used by the Prediction Lab.', icon: '🌡️' },
};

export const WEARABLE_COPY = {
  intro: 'Petal & Pulse can read a few things your watch, ring or phone already records, through Android’s Health Connect. You choose each one, and you can stop at any time.',
  points: [
    'Read only. We never write to Health Connect or change anything there.',
    'Each day is summarised on this phone (for example “7 h 20 min of sleep”). Raw readings are not kept.',
    'Wearable data stays in the encrypted database on this phone. It is never sent to Petal AI or to research.',
    'Turning this off stops reading. You can also delete what was summarised.',
  ],
  unavailable: 'Health Connect isn’t available on this phone. On Android 13 and older, install Health Connect from the Play Store. On Android 14 and newer it is built in.',
  webPreview: 'Health Connect works in the Android app only. In this preview you can try it with the demo data.',
};

/* ------------------------------------------------------------------ */
/* Summarising raw readings                                            */
/* ------------------------------------------------------------------ */

/** Readings in a simple shape, already converted to °C and bpm by the Health Connect adapter. */
export interface RawHealth {
  sleep: { start: string; end: string }[];
  steps: { start: string; end: string; count: number }[];
  restingHr: { time: string; bpm: number }[];
  tempDelta: { time: string; celsius: number }[];
  bbt: { time: string; celsius: number }[];
}

export const EMPTY_RAW: RawHealth = { sleep: [], steps: [], restingHr: [], tempDelta: [], bbt: [] };

/** Plausible ranges. Readings outside them are treated as device errors and dropped. */
const RANGE = {
  sleepMinutes: [0, 16 * 60],
  steps: [0, 100_000],
  restingHr: [30, 120],
  tempDelta: [-3, 3],
  bbt: [34.5, 38.5],
} as const;

const within = (v: number, [lo, hi]: readonly [number, number]) => Number.isFinite(v) && v >= lo && v <= hi;
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** The phone's local calendar date for a timestamp. */
export function localDate(iso: string): ISODate {
  return todayISO(new Date(iso));
}

/**
 * One row per day. Sleep counts toward the morning you woke up; steps toward
 * the day they started. Only the metrics the person opted into are kept.
 */
export function summarizeHealth(raw: RawHealth, metrics: WearableMetric[], source: WearableDay['source'] = 'health_connect'): WearableDay[] {
  const on = new Set(metrics);
  const days = new Map<ISODate, { sleep: number[]; steps: number[]; hr: number[]; temp: number[]; bbt: number[] }>();
  const day = (d: ISODate) => {
    let v = days.get(d);
    if (!v) {
      v = { sleep: [], steps: [], hr: [], temp: [], bbt: [] };
      days.set(d, v);
    }
    return v;
  };
  if (on.has('sleep'))
    for (const s of raw.sleep) {
      const mins = (Date.parse(s.end) - Date.parse(s.start)) / 60000;
      if (mins > 0) day(localDate(s.end)).sleep.push(mins);
    }
  if (on.has('steps')) for (const s of raw.steps) if (s.count >= 0) day(localDate(s.start)).steps.push(s.count);
  if (on.has('restingHr')) for (const r of raw.restingHr) if (within(r.bpm, RANGE.restingHr)) day(localDate(r.time)).hr.push(r.bpm);
  if (on.has('temperature')) {
    for (const r of raw.tempDelta) if (within(r.celsius, RANGE.tempDelta)) day(localDate(r.time)).temp.push(r.celsius);
    for (const r of raw.bbt) if (within(r.celsius, RANGE.bbt)) day(localDate(r.time)).bbt.push(r.celsius);
  }
  const out: WearableDay[] = [];
  for (const [date, v] of days) {
    const sleep = v.sleep.reduce((a, b) => a + b, 0);
    const steps = v.steps.reduce((a, b) => a + b, 0);
    const row: WearableDay = {
      date,
      sleepMinutes: v.sleep.length && within(sleep, RANGE.sleepMinutes) ? Math.round(sleep) : null,
      steps: v.steps.length && within(steps, RANGE.steps) ? Math.round(steps) : null,
      restingHr: v.hr.length ? round(mean(v.hr) as number, 1) : null,
      tempDelta: v.temp.length ? round(mean(v.temp) as number, 2) : null,
      // The first reading of the day is the basal one.
      bbt: v.bbt.length ? round(v.bbt[0], 2) : null,
      source,
    };
    if (row.sleepMinutes !== null || row.steps !== null || row.restingHr !== null || row.tempDelta !== null || row.bbt !== null) out.push(row);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Newer rows replace older ones for the same day. */
export function mergeWearableDays(existing: WearableDay[], incoming: WearableDay[]): WearableDay[] {
  const m = new Map(existing.map((d) => [d.date, d]));
  for (const d of incoming) m.set(d.date, d);
  return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Clears the fields for metrics the person has stopped sharing, and drops rows left empty. */
export function keepMetrics(days: WearableDay[], metrics: WearableMetric[]): WearableDay[] {
  const on = new Set(metrics);
  return days
    .map((d) => ({
      ...d,
      sleepMinutes: on.has('sleep') ? d.sleepMinutes : null,
      steps: on.has('steps') ? d.steps : null,
      restingHr: on.has('restingHr') ? d.restingHr : null,
      tempDelta: on.has('temperature') ? d.tempDelta : null,
      bbt: on.has('temperature') ? d.bbt : null,
    }))
    .filter((d) => d.sleepMinutes !== null || d.steps !== null || d.restingHr !== null || d.tempDelta !== null || d.bbt !== null);
}

/** Where to start reading from: the day after the last sync, at most 90 days back. */
export function syncWindow(lastSync: string | null, today: ISODate): { from: ISODate; to: ISODate } {
  const earliest = addDays(today, -90);
  // Re-read the last two days: last night's sleep and today's steps are still being written.
  const from = lastSync ? addDays(localDate(lastSync), -2) : earliest;
  return { from: from < earliest ? earliest : from, to: today };
}

export function formatSleep(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ------------------------------------------------------------------ */
/* Week at a glance                                                    */
/* ------------------------------------------------------------------ */

export interface WearableSummary {
  days: number;
  avgSleepMinutes: number | null;
  avgSteps: number | null;
  avgRestingHr: number | null;
  latest: WearableDay | null;
}

export function recentSummary(days: WearableDay[], today: ISODate, span = 7): WearableSummary {
  const from = addDays(today, -(span - 1));
  const recent = days.filter((d) => d.date >= from && d.date <= today);
  const pick = (f: (d: WearableDay) => number | null) => recent.map(f).filter((v): v is number => v !== null);
  const s = mean(pick((d) => d.sleepMinutes));
  const st = mean(pick((d) => d.steps));
  const hr = mean(pick((d) => d.restingHr));
  return {
    days: recent.length,
    avgSleepMinutes: s === null ? null : Math.round(s),
    avgSteps: st === null ? null : Math.round(st),
    avgRestingHr: hr === null ? null : round(hr, 1),
    latest: recent.length ? recent[recent.length - 1] : null,
  };
}

/* ------------------------------------------------------------------ */
/* Patterns                                                            */
/* ------------------------------------------------------------------ */

export const MIN_WEARABLE_CYCLES = 2;
const LOW_MOODS: Mood[] = ['irritated', 'anxious', 'sad', 'exhausted', 'overwhelmed'];

export type WearableInput = InsightInput & { wearables: WearableDay[] };

/** Days before each completed period's start (1 = the day before). */
function beforeNextPeriod(input: WearableInput, date: ISODate): number | null {
  for (let i = 1; i < input.periods.length; i++) {
    const prev = input.periods[i - 1].start;
    const next = input.periods[i].start;
    if (date >= prev && date < next) return diffDays(next, date);
  }
  return null;
}

/** Sleep in the 3 nights before a period compared with the rest of the cycle. */
export function sleepBeforePeriod(input: WearableInput): Insight | null {
  const before: number[] = [];
  const other: number[] = [];
  const cycles = new Set<number>();
  for (const d of input.wearables) {
    if (d.sleepMinutes === null) continue;
    const k = beforeNextPeriod(input, d.date);
    if (k === null) continue;
    if (k >= 1 && k <= 3) {
      before.push(d.sleepMinutes);
      cycles.add(input.periods.findIndex((p) => p.start === addDays(d.date, k)));
    } else if (k > 5) other.push(d.sleepMinutes);
  }
  if (cycles.size < MIN_WEARABLE_CYCLES || before.length < 4 || other.length < 10) return null;
  const b = mean(before) as number;
  const o = mean(other) as number;
  const diff = Math.round(o - b);
  if (Math.abs(diff) < 30) return null;
  const less = diff > 0;
  return {
    id: `wear_sleep_period_${cycles.size}`,
    kind: 'wear_sleep_period',
    title: less ? 'You tend to sleep less just before your period' : 'You tend to sleep more just before your period',
    body: `Your watch or phone recorded about ${Math.abs(diff)} minutes ${less ? 'less' : 'more'} sleep in the nights before your period. Many people notice sleep changes then; if it bothers you, a calmer evening routine in those days may help.`,
    how: `We compared sleep from the 3 nights before each period (${formatSleep(b)} on average) with nights earlier in the cycle (${formatSleep(o)}), across ${cycles.size} cycles.`,
    evidence: `${before.length} nights before a period, ${other.length} other nights`,
    strength: cycles.size >= 3 ? 'consistent' : 'emerging',
    relatesTo: ['sleep', 'cycle'],
  };
}

/** Resting heart rate in the week before a period compared with the week after it ends. */
export function restingHrAcrossCycle(input: WearableInput): Insight | null {
  const late: number[] = [];
  const early: number[] = [];
  let cycles = 0;
  for (let i = 1; i < input.periods.length; i++) {
    const p = input.periods[i - 1];
    const next = input.periods[i].start;
    const lateHere: number[] = [];
    const earlyHere: number[] = [];
    for (const d of input.wearables) {
      if (d.restingHr === null || d.date < p.start || d.date >= next) continue;
      const k = diffDays(next, d.date);
      const cd = diffDays(d.date, p.start) + 1;
      if (k >= 1 && k <= 7) lateHere.push(d.restingHr);
      else if (cd > p.length && cd <= p.length + 7) earlyHere.push(d.restingHr);
    }
    if (lateHere.length >= 3 && earlyHere.length >= 3) {
      cycles++;
      late.push(...lateHere);
      early.push(...earlyHere);
    }
  }
  if (cycles < MIN_WEARABLE_CYCLES) return null;
  const l = mean(late) as number;
  const e = mean(early) as number;
  const diff = round(l - e, 1);
  if (diff < 1.5) return null;
  return {
    id: `wear_rhr_cycle_${cycles}`,
    kind: 'wear_rhr_cycle',
    title: 'Your resting heart rate rises before your period',
    body: `It was about ${diff} beats per minute higher in the week before your period than in the week after it. This is common: after ovulation, progesterone often nudges resting heart rate and temperature up a little.`,
    how: `We compared resting heart rate from the 7 days before each period (${round(l, 1)} bpm on average) with the 7 days after each period ended (${round(e, 1)} bpm), across ${cycles} cycles.`,
    evidence: `${late.length + early.length} days with resting heart rate`,
    strength: cycles >= 3 ? 'consistent' : 'emerging',
    relatesTo: ['cycle', 'energy'],
  };
}

/** Pain on days after a short night compared with days after a longer one. */
export function sleepAndPain(input: WearableInput): Insight | null {
  const painByDate = new Map<ISODate, number>();
  for (const e of input.pain) painByDate.set(e.date, Math.max(painByDate.get(e.date) ?? 0, e.intensity));
  const short: number[] = [];
  const long: number[] = [];
  for (const d of input.wearables) {
    if (d.sleepMinutes === null) continue;
    const p = painByDate.get(d.date) ?? 0;
    if (d.sleepMinutes < 6 * 60) short.push(p);
    else if (d.sleepMinutes >= 7 * 60) long.push(p);
  }
  if (short.length < 5 || long.length < 10) return null;
  const s = mean(short) as number;
  const l = mean(long) as number;
  if (s - l < 1) return null;
  return {
    id: `wear_sleep_pain_${Math.floor((short.length + long.length) / 10)}`,
    kind: 'wear_sleep_pain',
    title: 'Short nights and more pain show up together',
    body: 'On days after under 6 hours of sleep you tended to log more pain. Pain can also make sleep harder, so either could affect the other.',
    how: `After ${short.length} short nights your pain averaged ${round(s, 1)}/10 (0 when you logged none), versus ${round(l, 1)}/10 after ${long.length} nights of 7 hours or more.`,
    evidence: `${short.length + long.length} nights with sleep recorded`,
    strength: short.length >= 10 ? 'consistent' : 'emerging',
    relatesTo: ['sleep', 'pain'],
  };
}

/** Share of hard moods on more active days compared with quieter ones. */
export function stepsAndMood(input: WearableInput): Insight | null {
  const stepsByDate = new Map(input.wearables.filter((d) => d.steps !== null).map((d) => [d.date, d.steps as number]));
  const active: boolean[] = [];
  const quiet: boolean[] = [];
  for (const m of input.moods) {
    const s = stepsByDate.get(m.date);
    if (s === undefined) continue;
    const hard = LOW_MOODS.includes(m.mood);
    if (s >= 7000) active.push(hard);
    else if (s < 3000) quiet.push(hard);
  }
  if (active.length < 6 || quiet.length < 6) return null;
  const share = (a: boolean[]) => a.filter(Boolean).length / a.length;
  const a = share(active);
  const q = share(quiet);
  if (q - a < 0.2) return null;
  return {
    id: `wear_steps_mood_${Math.floor((active.length + quiet.length) / 10)}`,
    kind: 'wear_steps_mood',
    title: 'More active days and lighter moods show up together',
    body: 'On days you walked more, fewer of your check-ins were hard ones. Low days can also make moving harder, so this is a pattern, not a rule.',
    how: `${Math.round(a * 100)}% of check-ins were hard moods on days with 7,000 steps or more (${active.length} check-ins), versus ${Math.round(q * 100)}% on days under 3,000 steps (${quiet.length} check-ins).`,
    evidence: `${active.length + quiet.length} check-ins on days with steps recorded`,
    strength: active.length + quiet.length >= 20 ? 'consistent' : 'emerging',
    relatesTo: ['mood', 'energy'],
  };
}

export function wearableInsights(input: WearableInput): Insight[] {
  if (!input.wearables.length) return [];
  return [sleepBeforePeriod, restingHrAcrossCycle, sleepAndPain, stepsAndMood].map((f) => f(input)).filter((x): x is Insight => x !== null);
}
