import { addDays, diffDays, isValidISODate, monthMatrix, toDayNumber } from '../src/lib/dates';
import { computeStats, buildCycles, detectPeriods, getCycleStatus, predictNext, normalizePeriodDays, cycleDayFor } from '../src/engines/cycle';
import type { PeriodDay, Profile } from '../src/data/types';
import { DEFAULT_PROFILE } from '../src/data/types';

const profile = (p: Partial<Profile> = {}): Profile => ({ ...DEFAULT_PROFILE, ...p });

/** Build bleeding days: each start gets `len` days of medium flow. */
function periodsFrom(starts: string[], len = 5): PeriodDay[] {
  return starts.flatMap((s) => Array.from({ length: len }, (_, i) => ({ date: addDays(s, i), flow: 'medium' as const })));
}

describe('date helpers', () => {
  test('validates real calendar dates only', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true); // leap year
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('26-01-01')).toBe(false);
    expect(isValidISODate(undefined)).toBe(false);
  });
  test('day arithmetic crosses month, year and DST boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2); // EU DST change weekend
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2); // US DST change
    expect(toDayNumber('1970-01-02')).toBe(1);
  });
  test('month matrix starts on Monday and covers all days', () => {
    const m = monthMatrix(2026, 1); // Feb 2026 starts on a Sunday
    expect(m[0].slice(0, 6).every((c) => c === null)).toBe(true);
    expect(m[0][6]).toBe('2026-02-01');
    expect(m.flat().filter(Boolean)).toHaveLength(28);
  });
});

describe('period detection', () => {
  test('groups consecutive bleeding days into periods', () => {
    const p = detectPeriods(periodsFrom(['2026-01-01', '2026-01-29']));
    expect(p.map((x) => x.start)).toEqual(['2026-01-01', '2026-01-29']);
    expect(p[0].length).toBe(5);
  });
  test('spotting alone never starts a period', () => {
    const days: PeriodDay[] = [...periodsFrom(['2026-01-01']), { date: '2026-01-14', flow: 'spotting' }];
    expect(detectPeriods(days)).toHaveLength(1);
  });
  test('spotting just before bleeding is not counted as the start', () => {
    const days: PeriodDay[] = [{ date: '2025-12-31', flow: 'spotting' }, ...periodsFrom(['2026-01-01'])];
    expect(detectPeriods(days)[0].start).toBe('2026-01-01');
  });
  test('a skipped logging day does not split a period', () => {
    const days: PeriodDay[] = [
      { date: '2026-01-01', flow: 'heavy' },
      { date: '2026-01-02', flow: 'medium' },
      { date: '2026-01-04', flow: 'light' },
    ];
    expect(detectPeriods(days)).toHaveLength(1);
  });
  test('drops invalid dates, duplicates and future records', () => {
    const days = [
      { date: '2026-01-01', flow: 'light' },
      { date: '2026-01-01', flow: 'heavy' },
      { date: 'not-a-date', flow: 'heavy' },
      { date: '2026-02-30', flow: 'heavy' },
      { date: '2027-01-01', flow: 'heavy' },
    ] as PeriodDay[];
    const clean = normalizePeriodDays(days, '2026-06-01');
    expect(clean).toEqual([{ date: '2026-01-01', flow: 'heavy' }]);
  });
  test('unsorted input gives the same result', () => {
    const a = periodsFrom(['2026-01-01', '2026-01-29', '2026-02-26']);
    const shuffled = [...a].reverse();
    expect(detectPeriods(shuffled)).toEqual(detectPeriods(a));
  });
});

describe('statistics & prediction', () => {
  test('regular cycles give a narrow, high-confidence window', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-23'];
    const status = getCycleStatus({ periodDays: periodsFrom(starts), profile: profile(), today: '2026-05-10' });
    expect(status.stats.median).toBe(28);
    expect(status.confidence).toBe('high');
    expect(status.prediction?.nextStartLikely).toBe('2026-05-21');
    expect(status.prediction?.nextStartEarliest).toBe('2026-05-20');
    expect(status.prediction?.nextStartLatest).toBe('2026-05-22');
    expect(status.cycleDay).toBe(18);
  });

  test('irregular cycles widen the window and limit phase estimates', () => {
    const starts = ['2026-01-01', '2026-01-24', '2026-03-05', '2026-03-31', '2026-05-10'];
    const status = getCycleStatus({ periodDays: periodsFrom(starts), profile: profile(), today: '2026-05-25' });
    expect(status.stats.irregular).toBe(true);
    expect(status.confidence).toBe('low');
    expect(status.phaseLimited).toBe(true);
    expect(status.phase).toBe('unknown');
    expect(status.ovulationWindow).toBeNull();
    const width = diffDays(status.prediction!.nextStartLatest, status.prediction!.nextStartEarliest);
    expect(width).toBeGreaterThanOrEqual(14);
  });

  test('implausible cycle lengths are excluded but kept', () => {
    const cycles = buildCycles(detectPeriods(periodsFrom(['2026-01-01', '2026-01-29', '2026-05-29', '2026-06-26'])));
    expect(cycles.find((c) => c.length === 120)?.excluded).toBe(true);
    const stats = computeStats(cycles);
    expect(stats.validCount).toBe(2);
    expect(stats.median).toBe(28);
  });

  test('no data at all: still learning, no phase, no prediction', () => {
    const status = getCycleStatus({ periodDays: [], profile: profile(), today: '2026-05-10' });
    expect(status.phase).toBe('unknown');
    expect(status.prediction).toBeNull();
    expect(status.confidence).toBe('insufficient');
    expect(status.limitReason).toMatch(/still learning/i);
  });

  test('onboarding answers alone give a low-confidence estimate only', () => {
    const status = getCycleStatus({ periodDays: [], profile: profile({ lastPeriodStart: '2026-05-01', typicalCycleLength: 30, typicalPeriodLength: 5 }), today: '2026-05-03' });
    expect(status.cycleDay).toBe(3);
    expect(status.phase).toBe('menstrual');
    expect(status.prediction?.basis).toBe('typical');
    expect(status.confidence).toBe('low');
  });

  test('"I’m not sure" cycle length with one period → no prediction', () => {
    const status = getCycleStatus({ periodDays: periodsFrom(['2026-05-01']), profile: profile({ typicalCycleLength: null }), today: '2026-05-20' });
    expect(status.prediction).toBeNull();
    expect(status.phase).toBe('unknown');
  });

  test('ignores an implausible typical length from onboarding', () => {
    expect(predictNext('2026-01-01', computeStats([]), { typicalCycleLength: 200, regularity: 'regular' })).toBeNull();
  });

  test('late period is reported, not guessed', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
    const status = getCycleStatus({ periodDays: periodsFrom(starts), profile: profile(), today: '2026-05-05' });
    expect(status.phase).toBe('late');
  });

  test('hormonal contraception suppresses phase and ovulation estimates', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
    const status = getCycleStatus({ periodDays: periodsFrom(starts), profile: profile({ caveats: ['hormonal_contraception'] }), today: '2026-04-10' });
    expect(status.phaseLimited).toBe(true);
    expect(status.ovulationWindow).toBeNull();
    expect(status.limitReason).toMatch(/contraception/i);
  });

  test('positive LH test anchors the ovulation estimate', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
    const logs = [{ date: '2026-04-12', symptoms: [], energy: null, sleepHours: null, activity: null, need: null, bbt: null, lhTest: 'positive' as const, mucus: null, notes: '' }];
    const status = getCycleStatus({ periodDays: periodsFrom(starts), dayLogs: logs, profile: profile(), today: '2026-04-13' });
    expect(status.ovulationWindow).toEqual({ start: '2026-04-12', end: '2026-04-14', basis: 'lh' });
    expect(status.phase).toBe('ovulatory');
  });

  test('phases progress through a regular cycle', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
    const at = (today: string) => getCycleStatus({ periodDays: periodsFrom(starts), profile: profile(), today }).phase;
    expect(at('2026-03-27')).toBe('menstrual');
    expect(at('2026-04-03')).toBe('follicular');
    expect(at('2026-04-09')).toBe('ovulatory');
    expect(at('2026-04-18')).toBe('luteal');
  });

  test('cycleDayFor maps past dates to cycle days', () => {
    const periods = detectPeriods(periodsFrom(['2026-01-01', '2026-01-29']));
    expect(cycleDayFor('2026-01-10', periods)).toEqual({ cycleDay: 10, daysBeforeNext: 19 });
    expect(cycleDayFor('2025-12-01', periods)).toBeNull();
  });
});
