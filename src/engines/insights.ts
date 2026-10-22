/**
 * Insights Engine
 *
 * Finds patterns in the user's own records and phrases them as observations,
 * never as causes. Every insight carries its evidence and a plain-language
 * "How did we find this?" explanation, and requires a minimum amount of data.
 */
import { diffDays, ISODate } from '../lib/dates';
import type { DayLog, Mood, MoodEntry, PainEpisode } from '../data/types';
import { cycleDayFor, Period } from './cycle';
import { multiCycleInsights } from './patterns';

export type InsightKind =
  | 'pain_bleeding'
  | 'mood_premenstrual'
  | 'energy_premenstrual'
  | 'sleep_energy'
  | 'stress_sleep'
  | 'pain_impact'
  | 'cycle_variability'
  | 'cycle_shift'
  | 'period_length'
  | 'symptom_recurring'
  | 'pain_trend';

export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  body: string;
  how: string;
  evidence: string;
  strength: 'emerging' | 'consistent';
  relatesTo: ('pain' | 'mood' | 'sleep' | 'energy' | 'cycle' | 'stress')[];
}

export const MIN_CYCLES_FOR_CYCLE_INSIGHT = 2;
export const MIN_PAIRS_FOR_CORRELATION = 10;

const LOW_MOODS: Mood[] = ['irritated', 'anxious', 'sad', 'exhausted', 'overwhelmed'];

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** Completed cycles only — the windows we can reason about. */
function completedPeriods(periods: Period[]): Period[] {
  return periods.slice(0, -1);
}

export interface InsightInput {
  periods: Period[];
  dayLogs: DayLog[];
  moods: MoodEntry[];
  pain: PainEpisode[];
}

export function painAroundBleeding({ periods, pain }: InsightInput): Insight | null {
  if (periods.length < MIN_CYCLES_FOR_CYCLE_INSIGHT) return null;
  let cyclesWithEarlyPain = 0;
  let earlyEpisodes = 0;
  let otherEpisodes = 0;
  let cyclesConsidered = 0;
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const end = periods[i + 1]?.start;
    const inCycle = pain.filter((e) => e.date >= p.start && (!end || e.date < end));
    if (!end && inCycle.length === 0) continue;
    cyclesConsidered++;
    const early = inCycle.filter((e) => diffDays(e.date, p.start) <= 1 && e.regions.some((r) => r === 'lower_abdomen' || r.endsWith('pelvis') || r === 'lower_back'));
    if (early.length) cyclesWithEarlyPain++;
    earlyEpisodes += early.length;
    otherEpisodes += inCycle.length - early.length;
  }
  if (cyclesConsidered < MIN_CYCLES_FOR_CYCLE_INSIGHT || cyclesWithEarlyPain < 2) return null;
  // per-day rate: early window is 2 days, the rest of a cycle ~26 days
  const earlyRate = earlyEpisodes / (2 * cyclesConsidered);
  const otherRate = otherEpisodes / (26 * cyclesConsidered);
  if (earlyRate <= otherRate * 1.5) return null;
  return {
    id: `pain_bleeding_${cyclesConsidered}`,
    kind: 'pain_bleeding',
    title: 'Cramps tend to cluster early in your period',
    body: `Across your last ${cyclesConsidered} periods, you recorded cramps on the first two days of bleeding more often than on other days.`,
    how: `We looked at each pain log and counted how many fell on day 1–2 of a period versus the rest of the cycle. Day 1–2 pain appeared in ${cyclesWithEarlyPain} of your last ${cyclesConsidered} periods.`,
    evidence: `${earlyEpisodes} early-period pain logs vs ${otherEpisodes} at other times`,
    strength: cyclesWithEarlyPain >= 3 ? 'consistent' : 'emerging',
    relatesTo: ['pain', 'cycle'],
  };
}

export function moodBeforePeriod({ periods, moods }: InsightInput): Insight | null {
  const done = completedPeriods(periods);
  if (done.length < MIN_CYCLES_FOR_CYCLE_INSIGHT) return null;
  const counts = new Map<Mood, number>();
  let cyclesWith = 0;
  for (let i = 0; i < done.length; i++) {
    const next = periods[i + 1].start;
    const window = moods.filter((m) => {
      const d = diffDays(next, m.date);
      return d >= 1 && d <= 5;
    });
    const low = window.filter((m) => LOW_MOODS.includes(m.mood));
    if (low.length) cyclesWith++;
    for (const m of low) counts.set(m.mood, (counts.get(m.mood) ?? 0) + 1);
  }
  if (cyclesWith < MIN_CYCLES_FOR_CYCLE_INSIGHT) return null;
  // compare to the rest of the cycle
  const premen = new Set<string>();
  for (let i = 0; i < done.length; i++) {
    const next = periods[i + 1].start;
    for (const m of moods) {
      const d = diffDays(next, m.date);
      if (d >= 1 && d <= 5) premen.add(m.id);
    }
  }
  const inWindow = moods.filter((m) => premen.has(m.id));
  const outWindow = moods.filter((m) => !premen.has(m.id) && m.date >= done[0].start);
  const rate = (arr: MoodEntry[]) => (arr.length ? arr.filter((m) => LOW_MOODS.includes(m.mood)).length / arr.length : 0);
  if (inWindow.length < 3 || rate(inWindow) <= rate(outWindow) + 0.15) return null;
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return {
    id: `mood_premen_${top}_${done.length}`,
    kind: 'mood_premenstrual',
    title: `You’ve often felt ${top} in the days before your period`,
    body: `You logged feeling ${top} around this part of your last ${cyclesWith} cycles. That may be worth exploring, although stress, sleep and other things can matter too.`,
    how: `We compared check-ins from the 5 days before each period with the rest of your cycle. ${Math.round(rate(inWindow) * 100)}% of pre-period check-ins were difficult moods, versus ${Math.round(rate(outWindow) * 100)}% at other times.`,
    evidence: `${inWindow.length} pre-period check-ins across ${done.length} cycles`,
    strength: cyclesWith >= 3 ? 'consistent' : 'emerging',
    relatesTo: ['mood', 'cycle'],
  };
}

export function energyBeforePeriod({ periods, dayLogs }: InsightInput): Insight | null {
  const done = completedPeriods(periods);
  if (done.length < MIN_CYCLES_FOR_CYCLE_INSIGHT) return null;
  const before: number[] = [];
  const other: number[] = [];
  let cyclesWithLow = 0;
  for (let i = 0; i < done.length; i++) {
    const next = periods[i + 1].start;
    const start = periods[i].start;
    let lowHere = false;
    for (const l of dayLogs) {
      if (l.energy == null || l.date < start || l.date >= next) continue;
      const d = diffDays(next, l.date);
      if (d >= 1 && d <= 5) {
        before.push(l.energy);
        if (l.energy <= 2) lowHere = true;
      } else other.push(l.energy);
    }
    if (lowHere) cyclesWithLow++;
  }
  if (before.length < 4 || other.length < 4 || cyclesWithLow < 2) return null;
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const diff = avg(other) - avg(before);
  if (diff < 0.6) return null;
  return {
    id: `energy_premen_${done.length}`,
    kind: 'energy_premenstrual',
    title: 'Lower energy before your period',
    body: `You logged low energy on several days before your period across your last ${cyclesWithLow} cycles.`,
    how: `Average energy in the 5 days before a period was ${avg(before).toFixed(1)}/5, compared with ${avg(other).toFixed(1)}/5 on other days.`,
    evidence: `${before.length} pre-period energy logs, ${other.length} other`,
    strength: cyclesWithLow >= 3 ? 'consistent' : 'emerging',
    relatesTo: ['energy', 'cycle'],
  };
}

export function sleepAndEnergy({ dayLogs }: InsightInput): Insight | null {
  const pairs = dayLogs.filter((l) => l.sleepHours != null && l.energy != null);
  if (pairs.length < MIN_PAIRS_FOR_CORRELATION) return null;
  const r = pearson(pairs.map((p) => p.sleepHours as number), pairs.map((p) => p.energy as number));
  if (r === null || r < 0.35) return null;
  const short = pairs.filter((p) => (p.sleepHours as number) < 6.5);
  const rest = pairs.filter((p) => (p.sleepHours as number) >= 6.5);
  if (short.length < 3 || rest.length < 3) return null;
  const avg = (a: DayLog[]) => a.reduce((x, y) => x + (y.energy as number), 0) / a.length;
  return {
    id: `sleep_energy_${Math.floor(pairs.length / 10)}`,
    kind: 'sleep_energy',
    title: 'Shorter sleep and lower energy show up together',
    body: 'Low-energy days appear to coincide with shorter sleep in your recent logs.',
    how: `On ${short.length} days with under 6.5 hours of sleep, your energy averaged ${avg(short).toFixed(1)}/5, versus ${avg(rest).toFixed(1)}/5 on other days (correlation ${r.toFixed(2)}). This shows they move together, not that one causes the other.`,
    evidence: `${pairs.length} days with both sleep and energy logged`,
    strength: r >= 0.55 ? 'consistent' : 'emerging',
    relatesTo: ['sleep', 'energy'],
  };
}

export function stressAndSleep({ dayLogs, moods }: InsightInput): Insight | null {
  const sleepByDate = new Map(dayLogs.filter((l) => l.sleepHours != null).map((l) => [l.date, l.sleepHours as number]));
  const stressDates = new Set(moods.filter((m) => m.tags.includes('stress')).map((m) => m.date));
  const stressed: number[] = [];
  const calm: number[] = [];
  for (const [date, h] of sleepByDate) (stressDates.has(date) ? stressed : calm).push(h);
  if (stressed.length < 4 || calm.length < 6) return null;
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const d = avg(calm) - avg(stressed);
  if (d < 0.7) return null;
  return {
    id: `stress_sleep_${Math.floor((stressed.length + calm.length) / 10)}`,
    kind: 'stress_sleep',
    title: 'Stressful days and shorter sleep',
    body: 'Your stressful days also coincided with shorter sleep.',
    how: `On days you tagged “stress”, you slept ${avg(stressed).toFixed(1)} hours on average, versus ${avg(calm).toFixed(1)} on other days. Either could affect the other, or something else could affect both.`,
    evidence: `${stressed.length} stress-tagged days, ${calm.length} other days with sleep logged`,
    strength: stressed.length >= 8 ? 'consistent' : 'emerging',
    relatesTo: ['stress', 'sleep'],
  };
}

export function generateInsights(input: InsightInput, dismissed: Set<string> = new Set()): Insight[] {
  const all = [painAroundBleeding, moodBeforePeriod, energyBeforePeriod, sleepAndEnergy, stressAndSleep]
    .map((f) => f(input))
    .filter((x): x is Insight => x !== null)
    .concat(multiCycleInsights(input));
  // A worsening-pain trend matters more than any other pattern, so it goes first.
  all.sort((a, b) => Number(b.kind === 'pain_trend') - Number(a.kind === 'pain_trend'));
  return all.filter((i) => !dismissed.has(i.id));
}

/* ------------------------------------------------------------------ */
/* Series for charts                                                   */
/* ------------------------------------------------------------------ */

export interface CycleDayPoint {
  cycleDay: number;
  value: number;
  n: number;
}

/** Average a metric by cycle day across completed cycles. */
export function byCycleDay(
  periods: Period[],
  points: { date: ISODate; value: number }[],
  maxDay = 35,
): CycleDayPoint[] {
  const buckets = new Map<number, number[]>();
  for (const p of points) {
    const cd = cycleDayFor(p.date, periods);
    if (!cd || cd.cycleDay > maxDay) continue;
    const arr = buckets.get(cd.cycleDay) ?? [];
    arr.push(p.value);
    buckets.set(cd.cycleDay, arr);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cycleDay, vals]) => ({ cycleDay, value: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length }));
}

/* ------------------------------------------------------------------ */
/* Monthly Pain Passport summary (structured, validated)               */
/* ------------------------------------------------------------------ */

export interface PainSummary {
  from: ISODate;
  to: ISODate;
  episodes: number;
  daysWithPain: number;
  avgIntensity: number | null;
  maxIntensity: number | null;
  topRegions: { region: string; count: number }[];
  qualities: { quality: string; count: number }[];
  timing: { duringBleeding: number; beforeBleeding: number; otherTimes: number; unknown: number };
  associated: { symptom: string; count: number }[];
  impact: Record<string, number>;
  tried: { item: string; count: number; helped: number }[];
}

function tally<T extends string>(items: T[]): { key: T; count: number }[] {
  const m = new Map<T, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export function summarizePain(pain: PainEpisode[], periods: Period[], from: ISODate, to: ISODate): PainSummary {
  const eps = pain.filter((e) => e.date >= from && e.date <= to);
  const intensities = eps.map((e) => e.intensity);
  const timing = { duringBleeding: 0, beforeBleeding: 0, otherTimes: 0, unknown: 0 };
  for (const e of eps) {
    const during = periods.some((p) => e.date >= p.start && e.date <= p.end);
    if (during) {
      timing.duringBleeding++;
      continue;
    }
    const cd = cycleDayFor(e.date, periods);
    if (!cd) timing.unknown++;
    else if (cd.daysBeforeNext !== null && cd.daysBeforeNext <= 5) timing.beforeBleeding++;
    else if (cd.daysBeforeNext === null) timing.unknown++;
    else timing.otherTimes++;
  }
  const impact: Record<string, number> = {};
  for (const e of eps) if (e.impact) impact[e.impact] = (impact[e.impact] ?? 0) + 1;
  const triedMap = new Map<string, { count: number; helped: number }>();
  for (const e of eps) {
    for (const t of e.tried) {
      const v = triedMap.get(t) ?? { count: 0, helped: 0 };
      v.count++;
      if (e.helped.includes(t)) v.helped++;
      triedMap.set(t, v);
    }
  }
  return {
    from,
    to,
    episodes: eps.length,
    daysWithPain: new Set(eps.map((e) => e.date)).size,
    avgIntensity: intensities.length ? Math.round((intensities.reduce((a, b) => a + b, 0) / intensities.length) * 10) / 10 : null,
    maxIntensity: intensities.length ? Math.max(...intensities) : null,
    topRegions: tally(eps.flatMap((e) => e.regions)).map(({ key, count }) => ({ region: key, count })),
    qualities: tally(eps.flatMap((e) => e.qualities)).map(({ key, count }) => ({ quality: key, count })),
    timing,
    associated: tally(eps.flatMap((e) => e.otherSymptoms)).map(({ key, count }) => ({ symptom: key, count })),
    impact,
    tried: [...triedMap.entries()].map(([item, v]) => ({ item, ...v })).sort((a, b) => b.count - a.count),
  };
}
