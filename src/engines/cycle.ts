/**
 * Cycle Intelligence Engine
 *
 * Turns recorded bleeding days into cycles and makes transparent,
 * uncertainty-aware estimates. Every number it returns can be traced back to
 * the user's own records plus the stated method below — nothing is invented.
 *
 * Method (explained to users in plain language on the cycle screen):
 *  - A period starts on a day with flow light or heavier that follows at
 *    least MIN_GAP_BETWEEN_PERIODS days without bleeding. Spotting alone never
 *    starts a period.
 *  - Cycle length = days between consecutive period starts. Implausible
 *    lengths (<MIN_CYCLE or >MAX_CYCLE) are kept for display but excluded
 *    from the prediction and flagged.
 *  - The next start is predicted from the median of up to the last six
 *    valid cycles. The window widens with variability (SD) and narrows as
 *    more cycles are recorded.
 *  - The ovulatory window is a calendar estimate (about 14 days before the
 *    predicted next period, ±2 days) unless a positive LH test was logged.
 *    It is never presented as fertile/safe-day guidance.
 */
import { addDays, diffDays, ISODate, isValidISODate, toDayNumber, fromDayNumber } from '../lib/dates';
import type { DayLog, PeriodDay, PredictionCaveat, Profile } from '../data/types';

export const MIN_CYCLE = 15;
export const MAX_CYCLE = 90;
export const MIN_GAP_BETWEEN_PERIODS = 7;
const LUTEAL_ESTIMATE = 14;
const MAX_HISTORY = 6;

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'late' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low' | 'insufficient';

export interface Period {
  start: ISODate;
  end: ISODate;
  length: number;
  days: PeriodDay[];
}

export interface Cycle {
  start: ISODate;
  /** Start of the next period; null for the current, unfinished cycle. */
  nextStart: ISODate | null;
  length: number | null;
  periodLength: number;
  excluded: boolean; // implausible length, not used for prediction
}

export interface CycleStats {
  count: number;
  validCount: number;
  median: number | null;
  mean: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  periodLengthMedian: number | null;
  irregular: boolean;
}

export interface Prediction {
  nextStartEarliest: ISODate;
  nextStartLikely: ISODate;
  nextStartLatest: ISODate;
  confidence: Confidence;
  basis: 'history' | 'typical' | 'none';
  basisText: string;
}

export interface CycleStatus {
  today: ISODate;
  cycleDay: number | null;
  phase: Phase;
  phaseLimited: boolean; // estimates suppressed or softened
  limitReason: string | null;
  prediction: Prediction | null;
  ovulationWindow: { start: ISODate; end: ISODate; basis: 'calendar' | 'lh' } | null;
  currentPeriod: Period | null;
  lastPeriod: Period | null;
  stats: CycleStats;
  confidence: Confidence;
  daysUntilNext: number | null;
}

const FLOW_STARTS_PERIOD = new Set(['light', 'medium', 'heavy', 'very_heavy']);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function sd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

/** Clean, de-duplicate and sort period day records. Invalid dates are dropped. */
export function normalizePeriodDays(days: PeriodDay[], today?: ISODate): PeriodDay[] {
  const byDate = new Map<string, PeriodDay>();
  for (const d of days) {
    if (!d || !isValidISODate(d.date)) continue;
    if (today && d.date > today) continue; // no future bleeding records
    byDate.set(d.date, d); // last write wins
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Group bleeding days into periods. */
export function detectPeriods(days: PeriodDay[], today?: ISODate): Period[] {
  const clean = normalizePeriodDays(days, today);
  const periods: Period[] = [];
  let current: PeriodDay[] = [];
  let lastBleedDay: number | null = null;

  const flush = () => {
    const firstReal = current.findIndex((d) => FLOW_STARTS_PERIOD.has(d.flow));
    if (firstReal >= 0) {
      const ds = current.slice(firstReal);
      // trailing spotting stays attached to the period
      periods.push({
        start: ds[0].date,
        end: ds[ds.length - 1].date,
        length: diffDays(ds[ds.length - 1].date, ds[0].date) + 1,
        days: ds,
      });
    }
    current = [];
  };

  for (const d of clean) {
    const n = toDayNumber(d.date);
    if (lastBleedDay !== null && n - lastBleedDay >= MIN_GAP_BETWEEN_PERIODS) {
      flush();
    }
    current.push(d);
    lastBleedDay = n;
  }
  if (current.length) flush();
  return periods;
}

export function buildCycles(periods: Period[]): Cycle[] {
  return periods.map((p, i) => {
    const next = periods[i + 1];
    const length = next ? diffDays(next.start, p.start) : null;
    return {
      start: p.start,
      nextStart: next ? next.start : null,
      length,
      periodLength: p.length,
      excluded: length !== null && (length < MIN_CYCLE || length > MAX_CYCLE),
    };
  });
}

export function computeStats(cycles: Cycle[]): CycleStats {
  const complete = cycles.filter((c) => c.length !== null);
  const valid = complete.filter((c) => !c.excluded).slice(-MAX_HISTORY);
  const lengths = valid.map((c) => c.length as number);
  const periodLengths = cycles.slice(-MAX_HISTORY).map((c) => c.periodLength);
  const s = lengths.length >= 2 ? sd(lengths) : null;
  const range = lengths.length ? Math.max(...lengths) - Math.min(...lengths) : 0;
  return {
    count: complete.length,
    validCount: lengths.length,
    median: lengths.length ? median(lengths) : null,
    mean: lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null,
    sd: s,
    min: lengths.length ? Math.min(...lengths) : null,
    max: lengths.length ? Math.max(...lengths) : null,
    periodLengthMedian: periodLengths.length ? median(periodLengths) : null,
    // Clinically, cycle-to-cycle variation of 8+ days is considered irregular.
    irregular: lengths.length >= 2 && range >= 8,
  };
}

function caveatReason(caveats: PredictionCaveat[]): string | null {
  if (caveats.includes('hormonal_contraception'))
    return 'Hormonal contraception changes how bleeding and phases work, so we show bleeding patterns instead of phase estimates.';
  if (caveats.includes('postpartum') || caveats.includes('breastfeeding'))
    return 'After pregnancy and while breastfeeding, cycles often take time to settle. We’ll track gently without guessing phases.';
  if (caveats.includes('perimenopause'))
    return 'During perimenopause cycles can vary a lot, so phase estimates may not reflect what your body is doing.';
  if (caveats.includes('pcos'))
    return 'With PCOS, ovulation timing can vary, so calendar-based phase estimates are shown with extra caution.';
  if (caveats.includes('recent_stop_contraception'))
    return 'Cycles can take a few months to settle after stopping hormonal contraception.';
  return null;
}

export function predictNext(
  lastStart: ISODate | null,
  stats: CycleStats,
  profile: Pick<Profile, 'typicalCycleLength' | 'regularity'>,
): Prediction | null {
  if (!lastStart) return null;
  if (stats.validCount >= 1 && stats.median !== null) {
    const m = Math.round(stats.median);
    const s = stats.sd ?? 0;
    // window half-width: grows with variability, shrinks with more data
    const base = stats.validCount >= 3 ? 1 : stats.validCount === 2 ? 2 : 3;
    const half = Math.min(10, Math.max(base, Math.ceil(1.5 * s)));
    let confidence: Confidence;
    if (stats.irregular) confidence = 'low';
    else if (stats.validCount >= 3 && s <= 2) confidence = 'high';
    else if (stats.validCount >= 2 && s <= 4) confidence = 'medium';
    else confidence = 'low';
    return {
      nextStartEarliest: addDays(lastStart, m - half),
      nextStartLikely: addDays(lastStart, m),
      nextStartLatest: addDays(lastStart, m + half),
      confidence,
      basis: 'history',
      basisText:
        stats.validCount === 1
          ? 'Based on your one recorded cycle, so the window is wide.'
          : `Based on the middle value of your last ${stats.validCount} cycles (${stats.min}–${stats.max} days).`,
    };
  }
  const typical = profile.typicalCycleLength;
  if (typical && typical >= MIN_CYCLE && typical <= MAX_CYCLE) {
    const half = profile.regularity === 'regular' ? 3 : 5;
    return {
      nextStartEarliest: addDays(lastStart, typical - half),
      nextStartLikely: addDays(lastStart, typical),
      nextStartLatest: addDays(lastStart, typical + half),
      confidence: 'low',
      basis: 'typical',
      basisText: 'Based on the cycle length you shared. It will get more personal as you log periods.',
    };
  }
  return null;
}

export interface CycleInput {
  periodDays: PeriodDay[];
  dayLogs?: DayLog[];
  profile: Pick<Profile, 'lastPeriodStart' | 'typicalCycleLength' | 'typicalPeriodLength' | 'regularity' | 'caveats'>;
  today: ISODate;
}

export function getCycleStatus({ periodDays, dayLogs = [], profile, today }: CycleInput): CycleStatus {
  const periods = detectPeriods(periodDays, today);

  // Seed from onboarding answer when no bleeding has been logged yet.
  if (
    profile.lastPeriodStart &&
    isValidISODate(profile.lastPeriodStart) &&
    profile.lastPeriodStart <= today &&
    !periods.some((p) => Math.abs(diffDays(p.start, profile.lastPeriodStart as string)) < MIN_GAP_BETWEEN_PERIODS) &&
    (periods.length === 0 || profile.lastPeriodStart > periods[periods.length - 1].end)
  ) {
    const len = Math.min(10, Math.max(1, profile.typicalPeriodLength ?? 5));
    periods.push({
      start: profile.lastPeriodStart,
      end: addDays(profile.lastPeriodStart, len - 1),
      length: len,
      days: [],
    });
  }

  const cycles = buildCycles(periods);
  const stats = computeStats(cycles);
  const last = periods.length ? periods[periods.length - 1] : null;

  const base: CycleStatus = {
    today,
    cycleDay: null,
    phase: 'unknown',
    phaseLimited: false,
    limitReason: null,
    prediction: null,
    ovulationWindow: null,
    currentPeriod: null,
    lastPeriod: last,
    stats,
    confidence: 'insufficient',
    daysUntilNext: null,
  };
  if (!last) {
    return { ...base, phaseLimited: true, limitReason: 'We’re still learning your pattern. Log a period to begin.' };
  }

  const cycleDay = diffDays(today, last.start) + 1;
  const prediction = predictNext(last.start, stats, profile);
  const periodLen = Math.round(stats.periodLengthMedian ?? profile.typicalPeriodLength ?? 5);

  // Is the user currently bleeding (logged today/yesterday or within the period)?
  const loggedRecently = last.days.length > 0 && diffDays(today, last.end) <= 1;
  const inPeriod = cycleDay >= 1 && (cycleDay <= last.length || (loggedRecently && cycleDay <= 10) || (last.days.length === 0 && cycleDay <= periodLen));

  let ovulationWindow: CycleStatus['ovulationWindow'] = null;
  const lh = dayLogs
    .filter((d) => d.lhTest === 'positive' && d.date >= last.start && d.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  if (lh) {
    ovulationWindow = { start: lh.date, end: addDays(lh.date, 2), basis: 'lh' };
  } else if (prediction) {
    const ov = addDays(prediction.nextStartLikely, -LUTEAL_ESTIMATE);
    ovulationWindow = { start: addDays(ov, -2), end: addDays(ov, 2), basis: 'calendar' };
  }

  let phase: Phase;
  if (inPeriod) phase = 'menstrual';
  else if (!prediction) phase = 'unknown';
  else if (today > prediction.nextStartLatest) phase = 'late';
  else if (ovulationWindow && today < ovulationWindow.start) phase = 'follicular';
  else if (ovulationWindow && today <= ovulationWindow.end) phase = 'ovulatory';
  else phase = 'luteal';

  const caveat = caveatReason(profile.caveats);
  let phaseLimited = false;
  let limitReason: string | null = null;
  if (caveat) {
    phaseLimited = true;
    limitReason = caveat;
  } else if (!prediction || prediction.confidence === 'low') {
    phaseLimited = true;
    limitReason = stats.irregular
      ? 'Your recent cycles vary quite a bit, so phase estimates are uncertain. That’s common and worth noting, not a judgement.'
      : 'We’re still learning your pattern. It’s too early to estimate this confidently.';
  }
  // Under limits we keep the bleeding fact but drop phase guesses.
  if (phaseLimited && phase !== 'menstrual' && phase !== 'late') phase = 'unknown';
  if (caveat && prediction) {
    // Hormonal contraception etc.: no ovulation estimate at all.
    ovulationWindow = null;
  }

  return {
    ...base,
    cycleDay: cycleDay >= 1 ? cycleDay : null,
    phase,
    phaseLimited,
    limitReason,
    prediction,
    ovulationWindow: phaseLimited ? null : ovulationWindow,
    currentPeriod: inPeriod ? last : null,
    confidence: prediction?.confidence ?? 'insufficient',
    daysUntilNext: prediction ? diffDays(prediction.nextStartLikely, today) : null,
  };
}

/** For calendars: classify an arbitrary day relative to predictions. */
export function predictedDayKind(
  date: ISODate,
  status: CycleStatus,
): 'predicted_period' | 'ovulation_window' | null {
  if (status.prediction && date > status.today) {
    const p = status.prediction;
    if (date >= p.nextStartEarliest && date <= p.nextStartLatest) return 'predicted_period';
  }
  const w = status.ovulationWindow;
  if (w && date >= w.start && date <= w.end && date >= status.today) return 'ovulation_window';
  return null;
}

/** Map any past date to its cycle day using recorded period starts. */
export function cycleDayFor(date: ISODate, periods: Period[]): { cycleDay: number; daysBeforeNext: number | null } | null {
  let idx = -1;
  for (let i = 0; i < periods.length; i++) if (periods[i].start <= date) idx = i;
  if (idx < 0) return null;
  const next = periods[idx + 1];
  return {
    cycleDay: diffDays(date, periods[idx].start) + 1,
    daysBeforeNext: next ? diffDays(next.start, date) : null,
  };
}

export const PHASE_COPY: Record<Phase, { title: string; line: string; detail: string }> = {
  menstrual: {
    title: 'menstrual days',
    line: 'You’re likely on your period.',
    detail:
      'Your period is the start of the follicular phase. Energy and comfort can vary a lot on these days. Go gently.',
  },
  follicular: {
    title: 'follicular phase',
    line: 'You’re likely in your follicular phase.',
    detail:
      'After bleeding ends, the body prepares a new egg. Some people notice more energy here, and some don’t. Both are normal.',
  },
  ovulatory: {
    title: 'estimated ovulatory window',
    line: 'You may be around your estimated ovulatory window.',
    detail:
      'This is a calendar estimate. Ovulation can’t be confirmed from dates, mood or symptoms alone. Never use it to prevent pregnancy.',
  },
  luteal: {
    title: 'luteal phase',
    line: 'You’re likely in your luteal phase.',
    detail:
      'Your body may be approaching its next period. Everyone experiences this differently.',
  },
  late: {
    title: 'beyond the predicted window',
    line: 'Your period hasn’t been logged in the predicted window.',
    detail:
      'Cycles shift with stress, illness, travel and more. If it’s much later than usual or you’re concerned, a health professional can help.',
  },
  unknown: {
    title: 'still learning',
    line: 'We’re still learning your pattern.',
    detail: 'It’s too early to estimate this confidently. Each period you log makes your insights more personal.',
  },
};

export { fromDayNumber };
