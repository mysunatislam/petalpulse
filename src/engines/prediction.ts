/**
 * Prediction Lab (Stage 3 research)
 *
 * The standard estimate (engines/cycle.ts) uses the calendar method: the
 * middle value of recent cycle lengths. The Lab tries two other methods next
 * to it and scores all of them against the person's own past cycles, so they
 * can see which one would have been closest for them:
 *
 *  - Recent-weighted: like the standard method, but newer cycles count more.
 *  - Temperature: after ovulation, progesterone raises resting temperature by
 *    about 0.2–0.5 °C. We look for that rise (the "three over six" rule: three
 *    readings in a row above the highest of the six before) in basal body
 *    temperature or a wearable's night-time skin temperature. The day before
 *    the rise is the likely ovulation day, and the period usually follows
 *    after the person's own luteal length (about 13 days if not yet known).
 *
 * All three are estimates. A temperature rise only shows that ovulation has
 * probably already happened, so none of this is ever fertility or
 * contraception guidance. The Lab is opt-in and does not change the standard
 * estimate shown elsewhere in the app.
 */
import { addDays, diffDays, ISODate } from '../lib/dates';
import type { DayLog, WearableDay } from '../data/types';
import { MAX_CYCLE, MIN_CYCLE, Period } from './cycle';

export type TempSource = 'bbt' | 'skin';
export type Method = 'median' | 'recent' | 'temperature';

export interface TempPoint {
  date: ISODate;
  value: number;
}

export interface TempShift {
  /** First of the three raised readings. */
  riseDate: ISODate;
  /** Likely ovulation day: the day before the rise. */
  ovulation: ISODate;
  /** Average of the three raised readings minus the highest of the six before. */
  rise: number;
  source: TempSource;
}

export const DEFAULT_LUTEAL = 13;
const LUTEAL_RANGE = [9, 17] as const;
const MAX_HISTORY = 6;

export const METHOD_COPY: Record<Method, { title: string; detail: string }> = {
  median: { title: 'Standard', detail: 'The middle value of your recent cycle lengths. This is what the rest of the app uses.' },
  recent: { title: 'Recent-weighted', detail: 'Like the standard one, but your newest cycles count more. Can follow a gradual change sooner.' },
  temperature: { title: 'Temperature', detail: 'Looks for the small rise in temperature after ovulation, then adds your usual luteal length. Only works once the rise has happened.' },
};

export const LAB_COPY = {
  intro: 'Try experimental ways of estimating your next period, scored against your own past cycles. The rest of the app keeps using the standard estimate.',
  never: 'These are estimates for planning and self-understanding. A temperature rise shows ovulation has probably already passed. Never use this to avoid or plan a pregnancy.',
  needsTemp: 'Log a morning temperature in My Cycle, or share temperature from a watch or ring in Wearables, to try the temperature method.',
};

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* ------------------------------------------------------------------ */
/* Temperature                                                          */
/* ------------------------------------------------------------------ */

/** Temperature readings by day. A thermometer (BBT) wins over a wearable when both exist. */
export function temperatureSeries(dayLogs: DayLog[], wearables: WearableDay[]): { bbt: TempPoint[]; skin: TempPoint[] } {
  const bbt = new Map<ISODate, number>();
  for (const w of wearables) if (w.bbt !== null) bbt.set(w.date, w.bbt);
  // What the person typed in counts over an app's reading for the same day.
  for (const l of dayLogs) if (l.bbt != null) bbt.set(l.date, l.bbt);
  const skin = wearables.filter((w) => w.tempDelta !== null).map((w) => ({ date: w.date, value: w.tempDelta as number }));
  const sorted = (m: Map<ISODate, number>) => [...m.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => (a.date < b.date ? -1 : 1));
  return { bbt: sorted(bbt), skin: skin.sort((a, b) => (a.date < b.date ? -1 : 1)) };
}

/**
 * Three over six: three readings on consecutive days, each above the highest
 * of the six readings before them, the third at least 0.2 °C above it. The six
 * may have one or two gaps (within 8 days), the three may not.
 */
export function detectTempShift(points: TempPoint[], from: ISODate, to: ISODate, source: TempSource): TempShift | null {
  const p = points.filter((x) => x.date >= from && x.date <= to);
  for (let i = 6; i + 2 < p.length; i++) {
    const six = p.slice(i - 6, i);
    if (diffDays(p[i].date, six[0].date) > 8) continue;
    const three = p.slice(i, i + 3);
    if (diffDays(three[1].date, three[0].date) !== 1 || diffDays(three[2].date, three[1].date) !== 1) continue;
    const cover = Math.max(...six.map((x) => x.value));
    if (!three.every((x) => x.value > cover) || three[2].value < cover + 0.2) continue;
    const rise = three.reduce((a, b) => a + b.value, 0) / 3 - cover;
    return { riseDate: three[0].date, ovulation: addDays(three[0].date, -1), rise: Math.round(rise * 100) / 100, source };
  }
  return null;
}

/** Looks in one cycle, preferring a thermometer when it has enough readings. */
export function shiftInCycle(series: { bbt: TempPoint[]; skin: TempPoint[] }, start: ISODate, end: ISODate): TempShift | null {
  const enough = (pts: TempPoint[]) => pts.filter((x) => x.date >= start && x.date <= end).length >= 10;
  if (enough(series.bbt)) {
    const s = detectTempShift(series.bbt, start, end, 'bbt');
    if (s) return s;
  }
  return enough(series.skin) ? detectTempShift(series.skin, start, end, 'skin') : null;
}

/* ------------------------------------------------------------------ */
/* Cycle by cycle                                                       */
/* ------------------------------------------------------------------ */

export interface LabCycle {
  start: ISODate;
  nextStart: ISODate | null;
  length: number | null;
  shift: TempShift | null;
  /** Days from likely ovulation to the next period. */
  luteal: number | null;
}

export function labCycles(periods: Period[], series: { bbt: TempPoint[]; skin: TempPoint[] }, today: ISODate): LabCycle[] {
  return periods.map((p, i) => {
    const next = periods[i + 1]?.start ?? null;
    const shift = shiftInCycle(series, p.start, next ? addDays(next, -1) : today);
    const luteal = shift && next ? diffDays(next, shift.ovulation) : null;
    return {
      start: p.start,
      nextStart: next,
      length: next ? diffDays(next, p.start) : null,
      shift,
      luteal: luteal !== null && luteal >= LUTEAL_RANGE[0] && luteal <= LUTEAL_RANGE[1] ? luteal : null,
    };
  });
}

const validLength = (c: LabCycle) => c.length !== null && c.length >= MIN_CYCLE && c.length <= MAX_CYCLE;

/** Next-start estimate for the cycle at `k`, using only what was known before it ended. */
export function estimateFor(method: Method, cycles: LabCycle[], k: number): ISODate | null {
  const c = cycles[k];
  const prior = cycles.slice(0, k).filter(validLength).slice(-MAX_HISTORY);
  if (method === 'temperature') {
    if (!c.shift) return null;
    const luteals = cycles.slice(0, k).map((x) => x.luteal).filter((x): x is number => x !== null);
    const luteal = luteals.length >= 2 ? Math.round(median(luteals)) : DEFAULT_LUTEAL;
    return addDays(c.shift.ovulation, luteal);
  }
  if (prior.length < 2) return null;
  const lengths = prior.map((x) => x.length as number);
  if (method === 'median') return addDays(c.start, Math.round(median(lengths)));
  // Weights 1, 2, 3 … so the newest cycle counts most.
  const w = lengths.map((_, i) => i + 1);
  const mean = lengths.reduce((a, l, i) => a + l * w[i], 0) / w.reduce((a, b) => a + b, 0);
  return addDays(c.start, Math.round(mean));
}

export interface MethodScore {
  method: Method;
  /** Completed cycles the method could be checked on. */
  tested: number;
  /** Average distance from the real start, in days. */
  meanError: number | null;
  /** Share of checks within 2 days of the real start. */
  within2: number | null;
}

/** How close each method would have been on the person's own completed cycles. */
export function backtest(cycles: LabCycle[]): MethodScore[] {
  return (['median', 'recent', 'temperature'] as Method[]).map((method) => {
    const errors: number[] = [];
    cycles.forEach((c, k) => {
      if (!c.nextStart || !validLength(c)) return;
      const est = estimateFor(method, cycles, k);
      if (est) errors.push(Math.abs(diffDays(est, c.nextStart)));
    });
    return {
      method,
      tested: errors.length,
      meanError: errors.length ? Math.round((errors.reduce((a, b) => a + b, 0) / errors.length) * 10) / 10 : null,
      within2: errors.length ? Math.round((errors.filter((e) => e <= 2).length / errors.length) * 100) / 100 : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* This cycle                                                          */
/* ------------------------------------------------------------------ */

export interface LabEstimate {
  method: Method;
  likely: ISODate;
  earliest: ISODate;
  latest: ISODate;
  /** The method's average error on past cycles, when it could be checked. */
  pastError: number | null;
}

export interface LabResult {
  cycles: LabCycle[];
  scores: MethodScore[];
  /** The method with the smallest average error, when at least two have been checked twice or more. */
  best: Method | null;
  estimates: LabEstimate[];
  current: LabCycle | null;
  tempSource: TempSource | null;
  lutealMedian: number | null;
  readings: number;
}

export function predictionLab(input: { periods: Period[]; dayLogs: DayLog[]; wearables: WearableDay[]; today: ISODate }): LabResult {
  const series = temperatureSeries(input.dayLogs, input.wearables);
  const cycles = labCycles(input.periods, series, input.today);
  const scores = backtest(cycles);
  const ranked = scores.filter((s) => s.tested >= 2 && s.meanError !== null).sort((a, b) => (a.meanError as number) - (b.meanError as number));
  const current = cycles.length ? cycles[cycles.length - 1] : null;
  const estimates: LabEstimate[] = [];
  if (current) {
    const k = cycles.length - 1;
    const score = (m: Method) => scores.find((s) => s.method === m);
    for (const m of ['median', 'recent', 'temperature'] as Method[]) {
      const likely = estimateFor(m, cycles, k);
      if (!likely) continue;
      // The window is the method's own track record, at least ±1 and at most ±7 days.
      const err = score(m)?.meanError ?? null;
      const half = Math.min(7, Math.max(1, Math.ceil(err ?? (m === 'temperature' ? 2 : 3))));
      estimates.push({ method: m, likely, earliest: addDays(likely, -half), latest: addDays(likely, half), pastError: err });
    }
  }
  const luteals = cycles.map((c) => c.luteal).filter((x): x is number => x !== null);
  const shifts = cycles.map((c) => c.shift).filter((s): s is TempShift => s !== null);
  return {
    cycles,
    scores,
    best: ranked.length >= 2 ? ranked[0].method : null,
    estimates,
    current,
    tempSource: shifts.length ? shifts[shifts.length - 1].source : series.bbt.length >= 10 ? 'bbt' : series.skin.length >= 10 ? 'skin' : null,
    lutealMedian: luteals.length >= 2 ? Math.round(median(luteals)) : null,
    readings: series.bbt.length + series.skin.length,
  };
}
