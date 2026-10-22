import { useMemo } from 'react';
import { useApp } from './app';
import { detectPeriods, getCycleStatus } from '../engines/cycle';
import { generateInsights } from '../engines/insights';
import { todayISO } from '../lib/dates';

export function useToday() {
  return todayISO();
}

export function useCycle() {
  const periodDays = useApp((s) => s.periodDays);
  const dayLogs = useApp((s) => s.dayLogs);
  const profile = useApp((s) => s.profile);
  const today = useToday();
  return useMemo(() => {
    const status = getCycleStatus({ periodDays, dayLogs, profile, today });
    const periods = detectPeriods(periodDays, today);
    return { status, periods };
  }, [periodDays, dayLogs, profile, today]);
}

export function useInsights() {
  const { periods } = useCycle();
  const dayLogs = useApp((s) => s.dayLogs);
  const moods = useApp((s) => s.moods);
  const pain = useApp((s) => s.pain);
  const feedback = useApp((s) => s.insightFeedback);
  return useMemo(() => {
    const dismissed = new Set(feedback.filter((f) => f.status === 'dismissed').map((f) => f.id));
    return {
      visible: generateInsights({ periods, dayLogs, moods, pain }, dismissed),
      all: generateInsights({ periods, dayLogs, moods, pain }),
      dismissed,
    };
  }, [periods, dayLogs, moods, pain, feedback]);
}

export function useTodayEntries() {
  const today = useToday();
  const moods = useApp((s) => s.moods);
  const pain = useApp((s) => s.pain);
  const dayLogs = useApp((s) => s.dayLogs);
  return useMemo(
    () => ({
      mood: [...moods].reverse().find((m) => m.date === today) ?? null,
      pain: [...pain].reverse().find((p) => p.date === today) ?? null,
      log: dayLogs.find((d) => d.date === today) ?? null,
    }),
    [moods, pain, dayLogs, today],
  );
}
