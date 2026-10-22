/**
 * Multi-cycle patterns (Stage 2)
 *
 * Looks across several cycles at once: how cycle and period length move, which
 * symptoms keep coming back at the same point in the cycle, whether pain is
 * changing, and how moods sit across the cycle (the Mood Mirror). Like the
 * Insights Engine, everything here is an observation with its evidence and a
 * minimum amount of data, never a cause or a diagnosis.
 */
import { diffDays, ISODate } from '../lib/dates';
import type { Mood, MoodEntry, MoodTag, Symptom } from '../data/types';
import { SYMPTOM_LABEL } from '../lib/labels';
import { MAX_CYCLE, MIN_CYCLE, Period } from './cycle';
import type { Insight, InsightInput } from './insights';

export const MIN_CYCLES_FOR_TREND = 3;
const LOW_MOODS: Mood[] = ['irritated', 'anxious', 'sad', 'exhausted', 'overwhelmed'];

/* ------------------------------------------------------------------ */
/* Cycle by cycle                                                       */
/* ------------------------------------------------------------------ */

export interface CycleRow {
  start: ISODate;
  /** null for the current, unfinished cycle */
  length: number | null;
  periodLength: number;
  painLogs: number;
  avgPain: number | null;
  maxPain: number | null;
  checkIns: number;
  lowMoodShare: number | null;
  symptoms: Symptom[];
  avgSleep: number | null;
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** One row per cycle, oldest first. The last row is the current cycle. */
export function cycleTimeline({ periods, dayLogs, moods, pain }: InsightInput): CycleRow[] {
  return periods.map((p, i) => {
    const next = periods[i + 1]?.start ?? null;
    const inside = (d: ISODate) => d >= p.start && (!next || d < next);
    const eps = pain.filter((e) => inside(e.date));
    const ms = moods.filter((m) => inside(m.date));
    const logs = dayLogs.filter((l) => inside(l.date));
    const intensities = eps.map((e) => e.intensity);
    const sleep = logs.map((l) => l.sleepHours).filter((h): h is number => h != null);
    return {
      start: p.start,
      length: next ? diffDays(next, p.start) : null,
      periodLength: p.length,
      painLogs: eps.length,
      avgPain: round1(avg(intensities)),
      maxPain: intensities.length ? Math.max(...intensities) : null,
      checkIns: ms.length,
      lowMoodShare: ms.length >= 3 ? Math.round((ms.filter((m) => LOW_MOODS.includes(m.mood)).length / ms.length) * 100) / 100 : null,
      symptoms: [...new Set(logs.flatMap((l) => l.symptoms))],
      avgSleep: round1(avg(sleep)),
    };
  });
}

function plausible(rows: CycleRow[]): CycleRow[] {
  return rows.filter((r) => r.length !== null && r.length >= MIN_CYCLE && r.length <= MAX_CYCLE);
}

/* ------------------------------------------------------------------ */
/* Cycle length: variation and shifts                                   */
/* ------------------------------------------------------------------ */

export function cycleLengthPattern(input: InsightInput): Insight | null {
  const rows = plausible(cycleTimeline(input)).slice(-12);
  if (rows.length < MIN_CYCLES_FOR_TREND) return null;
  const lengths = rows.map((r) => r.length as number);
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const range = max - min;
  const list = lengths.join(', ');
  if (range >= 8) {
    return {
      id: `cycle_var_${rows.length}_${range}`,
      kind: 'cycle_variability',
      title: 'Your cycle length has varied quite a bit',
      body: `Your last ${rows.length} cycles ranged from ${min} to ${max} days. Variation like this is common, especially with stress, illness or big changes. If it keeps happening or worries you, it’s worth mentioning to a doctor.`,
      how: `We measured each cycle from the first day of one period to the first day of the next: ${list} days. A difference of 8 days or more between the shortest and longest is often described as irregular.`,
      evidence: `${rows.length} complete cycles`,
      strength: rows.length >= 5 ? 'consistent' : 'emerging',
      relatesTo: ['cycle'],
    };
  }
  if (rows.length >= 6) {
    const half = Math.floor(rows.length / 2);
    const early = avg(lengths.slice(0, half)) as number;
    const late = avg(lengths.slice(-half)) as number;
    const shift = Math.round(late - early);
    if (Math.abs(shift) >= 3) {
      const way = shift > 0 ? 'longer' : 'shorter';
      return {
        id: `cycle_shift_${rows.length}_${shift}`,
        kind: 'cycle_shift',
        title: `Your recent cycles have been a little ${way}`,
        body: `Your last ${half} cycles averaged ${Math.round(late)} days, compared with ${Math.round(early)} days before that. Small shifts are common. Predictions will adjust as you keep logging.`,
        how: `We compared the average length of your most recent ${half} cycles with the ${half} before them. Cycle lengths: ${list} days.`,
        evidence: `${rows.length} complete cycles`,
        strength: 'emerging',
        relatesTo: ['cycle'],
      };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Period length                                                        */
/* ------------------------------------------------------------------ */

export function periodLengthPattern({ periods }: InsightInput): Insight | null {
  const done = periods.slice(0, -1).slice(-6);
  if (done.length < MIN_CYCLES_FOR_TREND) return null;
  const long = done.filter((p) => p.length > 7);
  if (long.length < 2) return null;
  return {
    id: `period_long_${done.length}_${long.length}`,
    kind: 'period_length',
    title: 'Some of your periods have lasted more than 7 days',
    body: `${long.length} of your last ${done.length} periods lasted longer than 7 days. Periods that often last more than a week are worth mentioning to a doctor or nurse, especially if they are heavy.`,
    how: `We counted the bleeding days in each of your last ${done.length} periods: ${done.map((p) => p.length).join(', ')} days. Spotting on its own isn’t counted as a period day.`,
    evidence: `${done.length} periods`,
    strength: long.length >= 3 ? 'consistent' : 'emerging',
    relatesTo: ['cycle'],
  };
}

/* ------------------------------------------------------------------ */
/* Symptoms that come back at the same point                            */
/* ------------------------------------------------------------------ */

export type CycleWindow = 'early_period' | 'before_period' | 'mid_cycle';

const WINDOW_TEXT: Record<CycleWindow, { title: string; body: string; days: string }> = {
  early_period: { title: 'early in your period', body: 'in the first 3 days of your period', days: 'cycle days 1–3' },
  before_period: { title: 'before your period', body: 'in the 5 days before your period', days: 'the 5 days before each period' },
  mid_cycle: { title: 'in the middle of your cycle', body: 'around the middle of your cycle', days: 'cycle days 11–17' },
};

function windowOf(date: ISODate, start: ISODate, next: ISODate): CycleWindow | null {
  const cd = diffDays(date, start) + 1;
  const before = diffDays(next, date);
  if (before >= 1 && before <= 5) return 'before_period';
  if (cd >= 1 && cd <= 3) return 'early_period';
  if (cd >= 11 && cd <= 17) return 'mid_cycle';
  return null;
}

// Fainting and fever go through the Safety Engine, and cramps have their own pain insight.
const SKIP: Symptom[] = ['fainting', 'fever', 'cramps'];

interface Recurrence {
  sym: Symptom;
  w: CycleWindow;
  cycles: number;
  cyclesWith: number;
  inDays: number;
  inRate: number;
  outRate: number;
}

/** Symptom and window pairs that keep coming back: in 3+ cycles, 60%+ of them, and at least twice as often as at other times. */
function recurrences({ periods, dayLogs }: InsightInput): Recurrence[] {
  const done = periods.slice(0, -1).slice(-6);
  if (done.length < MIN_CYCLES_FOR_TREND) return [];
  const found: Recurrence[] = [];
  const symptoms = [...new Set(dayLogs.flatMap((l) => l.symptoms))];
  for (const sym of symptoms) {
    for (const w of Object.keys(WINDOW_TEXT) as CycleWindow[]) {
      let cyclesWith = 0;
      let inDays = 0;
      let inHits = 0;
      let outDays = 0;
      let outHits = 0;
      for (const p of done) {
        const next = periods[periods.indexOf(p) + 1].start;
        let here = false;
        for (const l of dayLogs) {
          if (l.date < p.start || l.date >= next) continue;
          const has = l.symptoms.includes(sym);
          if (windowOf(l.date, p.start, next) === w) {
            inDays++;
            if (has) {
              inHits++;
              here = true;
            }
          } else {
            outDays++;
            if (has) outHits++;
          }
        }
        if (here) cyclesWith++;
      }
      const inRate = inDays ? inHits / inDays : 0;
      const outRate = outDays ? outHits / outDays : 0;
      if (cyclesWith < MIN_CYCLES_FOR_TREND || cyclesWith / done.length < 0.6 || inRate < Math.max(0.25, outRate * 2)) continue;
      found.push({ sym, w, cycles: done.length, cyclesWith, inDays, inRate, outRate });
    }
  }
  return found;
}

/** Symptoms that tend to come back in a given part of the cycle, for planning ahead. */
export function usualSymptoms(input: InsightInput, w: CycleWindow): Symptom[] {
  return recurrences(input)
    .filter((r) => r.w === w)
    .map((r) => r.sym);
}

export function recurringSymptoms(input: InsightInput): Insight[] {
  // One card per symptom (its strongest window), strongest first, at most three.
  const score = (r: Recurrence) => r.cyclesWith / r.cycles + r.inRate;
  const best = new Map<Symptom, Recurrence>();
  for (const r of recurrences(input)) if (!SKIP.includes(r.sym) && (!best.has(r.sym) || score(best.get(r.sym)!) < score(r))) best.set(r.sym, r);
  return [...best.values()]
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)
    .map(({ sym, w, cycles, cyclesWith, inDays, inRate, outRate }) => {
      const label = SYMPTOM_LABEL[sym].toLowerCase();
      const when = WINDOW_TEXT[w];
      return {
        id: `sym_${sym}_${w}_${cycles}`,
        kind: 'symptom_recurring',
        title: `${when.title.charAt(0).toUpperCase()}${when.title.slice(1)}, you often log ${label}`,
        body: `You logged ${label} ${when.body} in ${cyclesWith} of your last ${cycles} cycles. Knowing this may help you plan ahead.`,
        how: `We checked ${when.days} in each cycle. You logged ${label} on ${Math.round(inRate * 100)}% of those days, versus ${Math.round(outRate * 100)}% of other days.`,
        evidence: `${inDays} days logged in that window across ${cycles} cycles`,
        strength: cyclesWith / cycles >= 0.8 ? 'consistent' : 'emerging',
        relatesTo: sym === 'back_pain' || sym === 'headache' ? ['pain', 'cycle'] : sym === 'fatigue' ? ['energy', 'cycle'] : sym === 'insomnia' ? ['sleep', 'cycle'] : ['cycle'],
      };
    });
}

/* ------------------------------------------------------------------ */
/* Pain across cycles                                                   */
/* ------------------------------------------------------------------ */

export function painTrend(input: InsightInput): Insight | null {
  const rows = cycleTimeline(input).slice(0, -1).filter((r) => r.maxPain !== null).slice(-6);
  if (rows.length < MIN_CYCLES_FOR_TREND + 1) return null;
  const peaks = rows.map((r) => r.maxPain as number);
  const last3 = peaks.slice(-3);
  const earlier = peaks.slice(0, -3);
  const rising = last3[0] < last3[1] && last3[1] < last3[2];
  const up = (avg(last3) as number) - (avg(earlier) as number);
  if (!rising || up < 1.5) return null;
  return {
    id: `pain_trend_${rows.length}_${peaks.join('')}`,
    kind: 'pain_trend',
    title: 'Your period pain has been getting stronger',
    body: `Your strongest pain each cycle has gone up over your last 3 cycles (${last3.join(', ')} out of 10). Pain that keeps getting worse is worth talking about with a doctor. Your Pain Passport summary can help you explain it.`,
    how: `We took the highest pain score you logged in each of your last ${rows.length} cycles: ${peaks.join(', ')}. The last 3 rose each time and averaged ${up.toFixed(1)} points higher than the cycles before.`,
    evidence: `${rows.reduce((a, r) => a + r.painLogs, 0)} pain logs across ${rows.length} cycles`,
    strength: 'emerging',
    relatesTo: ['pain', 'cycle'],
  };
}

export function multiCycleInsights(input: InsightInput): Insight[] {
  return [painTrend(input), cycleLengthPattern(input), periodLengthPattern(input), ...recurringSymptoms(input)].filter((x): x is Insight => x !== null);
}

/* ------------------------------------------------------------------ */
/* Mood Mirror: how moods sit across the cycle                          */
/* ------------------------------------------------------------------ */

export type MirrorPart = 'period' | 'after_period' | 'middle' | 'before_period';

export const MIRROR_PART_LABEL: Record<MirrorPart, string> = {
  period: 'During your period',
  after_period: 'The week after your period',
  middle: 'Mid-cycle',
  before_period: 'The days before your period',
};

export interface MirrorRow {
  part: MirrorPart;
  n: number;
  counts: Partial<Record<Mood, number>>;
  topMood: Mood | null;
  topTag: MoodTag | null;
  lowShare: number;
}

export interface MoodMirror {
  cycles: number;
  checkIns: number;
  rows: MirrorRow[];
  reflection: string | null;
}

function partOf(date: ISODate, periods: Period[]): MirrorPart | null {
  for (let i = periods.length - 2; i >= 0; i--) {
    const p = periods[i];
    const next = periods[i + 1].start;
    if (date < p.start || date >= next) continue;
    const cd = diffDays(date, p.start) + 1;
    const before = diffDays(next, date);
    if (before >= 1 && before <= 5) return 'before_period';
    if (date <= p.end) return 'period';
    if (cd <= p.length + 7) return 'after_period';
    return 'middle';
  }
  return null;
}

/** Needs at least 2 complete cycles and 12 check-ins inside them. */
export function moodMirror(moods: MoodEntry[], periods: Period[]): MoodMirror | null {
  const cycles = periods.length - 1;
  if (cycles < 2) return null;
  const parts: MirrorPart[] = ['period', 'after_period', 'middle', 'before_period'];
  const buckets = new Map<MirrorPart, MoodEntry[]>(parts.map((p) => [p, []]));
  for (const m of moods) {
    const part = partOf(m.date, periods);
    if (part) (buckets.get(part) as MoodEntry[]).push(m);
  }
  const total = [...buckets.values()].reduce((a, b) => a + b.length, 0);
  if (total < 12) return null;
  const rows: MirrorRow[] = parts.map((part) => {
    const ms = buckets.get(part) as MoodEntry[];
    const counts: Partial<Record<Mood, number>> = {};
    const tags: Partial<Record<MoodTag, number>> = {};
    for (const m of ms) {
      counts[m.mood] = (counts[m.mood] ?? 0) + 1;
      for (const t of m.tags) tags[t] = (tags[t] ?? 0) + 1;
    }
    const top = (o: Partial<Record<string, number>>) => (Object.entries(o) as [string, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      part,
      n: ms.length,
      counts,
      topMood: top(counts) as Mood | null,
      topTag: top(tags) as MoodTag | null,
      lowShare: ms.length ? ms.filter((m) => LOW_MOODS.includes(m.mood)).length / ms.length : 0,
    };
  });
  const enough = rows.filter((r) => r.n >= 3);
  let reflection: string | null = null;
  if (enough.length >= 2) {
    const calm = [...enough].sort((a, b) => a.lowShare - b.lowShare)[0];
    const hard = [...enough].sort((a, b) => b.lowShare - a.lowShare)[0];
    if (hard.lowShare - calm.lowShare >= 0.25) {
      reflection = `${MIRROR_PART_LABEL[calm.part]} has tended to feel easiest for you, and ${MIRROR_PART_LABEL[hard.part].toLowerCase()} the hardest. Moods have many causes, so treat this as a gentle mirror, not a rule.`;
    } else {
      reflection = 'Your moods look fairly similar across your cycle. Whatever is shaping them may have more to do with your days than your cycle.';
    }
  }
  return { cycles, checkIns: total, rows, reflection };
}

/* ------------------------------------------------------------------ */
/* Longitudinal view: month by month and cycle by cycle                 */
/* ------------------------------------------------------------------ */

export interface MonthRow {
  month: string; // YYYY-MM
  checkIns: number;
  hardShare: number | null;
  painDays: number;
  maxPain: number | null;
  avgSleep: number | null;
  bleedingDays: number;
}

export function monthlyTimeline(input: InsightInput & { from: ISODate; to: ISODate }): MonthRow[] {
  const { from, to, moods, pain, dayLogs, periods } = input;
  const months: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  while (`${y}-${String(m).padStart(2, '0')}` <= to.slice(0, 7)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  const inRange = (d: ISODate) => d >= from && d <= to;
  const bleeding = new Set(periods.flatMap((p) => p.days.filter((d) => d.flow !== 'spotting').map((d) => d.date)));
  return months.map((month) => {
    const inMonth = (d: ISODate) => d.startsWith(month) && inRange(d);
    const ms = moods.filter((m) => inMonth(m.date));
    const ps = pain.filter((p) => inMonth(p.date));
    const sleep = dayLogs.filter((l) => inMonth(l.date) && l.sleepHours != null).map((l) => l.sleepHours as number);
    return {
      month,
      checkIns: ms.length,
      hardShare: ms.length >= 3 ? Math.round((ms.filter((m) => LOW_MOODS.includes(m.mood)).length / ms.length) * 100) / 100 : null,
      painDays: new Set(ps.map((p) => p.date)).size,
      maxPain: ps.length ? Math.max(...ps.map((p) => p.intensity)) : null,
      avgSleep: round1(avg(sleep)),
      bleedingDays: [...bleeding].filter(inMonth).length,
    };
  });
}

export interface Longitudinal {
  cycles: CycleRow[];
  months: MonthRow[];
  patterns: Insight[];
  summary: { cycleCount: number; medianLength: number | null; minLength: number | null; maxLength: number | null; medianPeriod: number | null; painPeakTrend: 'up' | 'down' | 'steady' | null };
}

/** Everything the six-month view and the clinician report need, from the same numbers. */
export function buildLongitudinal(input: InsightInput & { from: ISODate; to: ISODate }): Longitudinal {
  const all = cycleTimeline(input);
  const cycles = all.filter((r, i) => {
    const end = all[i + 1]?.start ?? input.to;
    return end >= input.from && r.start <= input.to;
  });
  const done = plausible(cycles);
  const lengths = done.map((r) => r.length as number).sort((a, b) => a - b);
  const periodsDone = cycles.filter((r) => r.length !== null).map((r) => r.periodLength).sort((a, b) => a - b);
  const mid = (a: number[]) => (a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null);
  const peaks = cycles.filter((r) => r.length !== null && r.maxPain !== null).map((r) => r.maxPain as number);
  let painPeakTrend: Longitudinal['summary']['painPeakTrend'] = null;
  if (peaks.length >= 4) {
    const half = Math.floor(peaks.length / 2);
    const d = (avg(peaks.slice(-half)) as number) - (avg(peaks.slice(0, half)) as number);
    painPeakTrend = d >= 1 ? 'up' : d <= -1 ? 'down' : 'steady';
  }
  return {
    cycles,
    months: monthlyTimeline(input),
    patterns: multiCycleInsights(input),
    summary: {
      cycleCount: done.length,
      medianLength: mid(lengths),
      minLength: lengths.length ? lengths[0] : null,
      maxLength: lengths.length ? lengths[lengths.length - 1] : null,
      medianPeriod: mid(periodsDone),
      painPeakTrend,
    },
  };
}
