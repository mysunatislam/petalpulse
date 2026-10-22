import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Chip, Gap, Notice, Pill, Row, Screen, SectionTitle, T } from '../../components/ui';
import { LineChart, PetalBars, Scatter } from '../../components/Charts';
import { PetalBloom } from '../../components/PetalCompass';
import { useApp } from '../../store/app';
import { useCycle, useInsights } from '../../store/derived';
import { buildCycles } from '../../engines/cycle';
import { byCycleDay, Insight, pearson } from '../../engines/insights';
import { addDays, formatShort, monthName, num, todayISO } from '../../lib/dates';
import { buildLongitudinal } from '../../engines/patterns';
import { useLocalize } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import type { Mood } from '../../data/types';

// Bangla month names can't be cut to three letters without breaking a conjunct.
const shortMonth = (i: number) => {
  const n = monthName(i);
  return /^[A-Za-z]/.test(n) ? n.slice(0, 3) : n;
};

const VALENCE: Record<Mood, number> = { happy: 5, peaceful: 4.5, mixed: 3, anxious: 2, irritated: 2, sad: 1.5, exhausted: 1.5, overwhelmed: 1 };

type Compare = 'pain_cycle' | 'mood_sleep' | 'energy_activity' | 'bleeding_pain' | 'stress_symptoms';
const COMPARE: { value: Compare; label: string }[] = [
  { value: 'pain_cycle', label: 'Pain & cycle timing' },
  { value: 'mood_sleep', label: 'Mood & sleep' },
  { value: 'energy_activity', label: 'Energy & activity' },
  { value: 'bleeding_pain', label: 'Bleeding & discomfort' },
  { value: 'stress_symptoms', label: 'Stress & symptoms' },
];

export default function Insights() {
  const t = useTheme();
  const { periods } = useCycle();
  const { visible, all, dismissed } = useInsights();
  const dayLogs = useApp((s) => s.dayLogs);
  const moods = useApp((s) => s.moods);
  const pain = useApp((s) => s.pain);
  const periodDays = useApp((s) => s.periodDays);
  const feedback = useApp((s) => s.insightFeedback);
  const [compare, setCompare] = useState<Compare>('pain_cycle');
  const [how, setHow] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const L = useLocalize();
  const six = useMemo(() => {
    const to = todayISO();
    return buildLongitudinal({ periods, dayLogs, moods, pain, from: addDays(to, -183), to });
  }, [periods, dayLogs, moods, pain]);

  const cycles = buildCycles(periods).filter((c) => c.length !== null).slice(-6);
  const garden = cycles.map((c) => {
    const end = c.nextStart as string;
    const ms = moods.filter((m) => m.date >= c.start && m.date < end);
    const avg = ms.length ? ms.reduce((a, m) => a + VALENCE[m.mood], 0) / ms.length : null;
    const painDays = new Set(pain.filter((p) => p.date >= c.start && p.date < end).map((p) => p.date)).size;
    return { ...c, avgMood: avg, painDays };
  });

  return (
    <Screen back={false} title="My Pattern Garden" eyebrow="Insights">
      <Card glass>
        <T v="small" muted>
          Each flower is one of your cycles. Fuller flowers were longer cycles; the number shows days with pain.
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <Row style={{ gap: 14, alignItems: 'flex-end' }}>
            {garden.map((g) => (
              <View key={g.start} style={{ alignItems: 'center' }} accessible accessibilityLabel={`Cycle starting ${formatShort(g.start)}, ${g.length} days, ${g.painDays} pain days`}>
                <PetalBloom phase={g.avgMood === null ? 'unknown' : g.avgMood >= 3.6 ? 'follicular' : g.avgMood >= 2.8 ? 'luteal' : 'menstrual'} size={40 + Math.min(40, (g.length ?? 28) * 1.2)} openness={0.9} />
                <View style={{ width: 2, height: 22, backgroundColor: t.sage }} />
                <T v="label">{g.length}d</T>
                <T v="small" soft>
                  {formatShort(g.start)}
                </T>
                <Pill color={g.painDays > 2 ? t.blush : t.sage}>{g.painDays} 🤍</Pill>
              </View>
            ))}
            {garden.length === 0 && (
              <T v="small" muted>
                Your garden grows with each cycle you log.
              </T>
            )}
          </Row>
        </ScrollView>
      </Card>

      <SectionTitle>What we’ve noticed</SectionTitle>
      {visible.length === 0 && (
        <Notice tone="calm" title="Still growing">
          We only show a pattern when there’s enough data: at least two full cycles for cycle-related patterns, or ten days for sleep and energy. Keep checking in, there’s no rush.
        </Notice>
      )}
      <View style={{ gap: 12 }}>
        {visible.map((i) => (
          <InsightCard key={i.id} insight={i} open={how === i.id} onHow={() => setHow(how === i.id ? null : i.id)} helpful={feedback.some((f) => f.id === i.id && f.status === 'helpful')} />
        ))}
      </View>
      {dismissed.size > 0 && (
        <Button small kind="ghost" title={showDismissed ? 'Hide dismissed insights' : `Show dismissed (${all.filter((a) => dismissed.has(a.id)).length})`} onPress={() => setShowDismissed(!showDismissed)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      )}
      {showDismissed &&
        all
          .filter((a) => dismissed.has(a.id))
          .map((i) => (
            <Card key={i.id} style={{ marginTop: 8, opacity: 0.7 }}>
              <T v="h3">{i.title}</T>
              <Button small kind="ghost" title="Restore" onPress={() => useApp.getState().setInsightFeedback(i.id, null)} style={{ alignSelf: 'flex-start' }} />
            </Card>
          ))}
      <T v="small" soft style={{ marginTop: 10 }}>
        Patterns show things that happen together in your own records. They don’t prove one causes the other, and they aren’t medical advice. Demo insights are illustrative only.
      </T>

      {six.summary.cycleCount >= 2 && (
        <>
          <SectionTitle action="PDF for a clinician" onAction={() => router.push('/export')}>
            The last six months
          </SectionTitle>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T v="label">Cycle length</T>
                <T v="h3">{`${num(six.summary.minLength ?? 0)}–${num(six.summary.maxLength ?? 0)} ${L('days')}`}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T v="label">Bleeding days</T>
                <T v="h3">{`${num(six.summary.medianPeriod ?? 0)} ${L('days')}`}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T v="label">Highest pain</T>
                <T v="h3">{six.summary.painPeakTrend === null ? '—' : { up: 'A bit higher', down: 'A bit lower', steady: 'About the same' }[six.summary.painPeakTrend]}</T>
              </View>
            </Row>
            <Gap h={12} />
            <T v="label">Days with pain, month by month</T>
            <PetalBars data={six.months.map((m) => ({ label: shortMonth(Number(m.month.slice(5)) - 1), value: m.painDays }))} max={Math.max(4, ...six.months.map((m) => m.painDays))} color={t.primary} height={110} />
            <Gap h={8} />
            <T v="label">Cycle by cycle</T>
            {six.cycles.map((c) => (
              <Row
                key={c.start}
                style={{ justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: t.border }}
                accessible
                accessibilityLabel={`${formatShort(c.start)}: ${c.length ? `${num(c.length)} ${L('days')}` : L('current cycle')}, ${num(c.periodLength)} ${L('bleeding days')}${c.maxPain !== null ? `, ${L('highest pain')} ${num(c.maxPain)}/10` : ''}`}
              >
                <T v="small" style={{ flex: 1.2 }}>
                  {formatShort(c.start)}
                </T>
                <T v="small" muted style={{ flex: 1 }}>
                  {c.length ? `${num(c.length)} ${L('days')}` : L('current cycle')}
                </T>
                <T v="small" muted style={{ flex: 1 }}>
                  {`🩸 ${num(c.periodLength)}`}
                </T>
                <T v="small" muted style={{ flex: 1 }}>
                  {c.maxPain !== null ? `🤍 ${num(c.maxPain)}/10` : '—'}
                </T>
              </Row>
            ))}
            <T v="small" soft style={{ marginTop: 8 }}>
              🩸 bleeding days · 🤍 highest pain logged in that cycle
            </T>
          </Card>
        </>
      )}

      <SectionTitle>Explore a relationship</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row style={{ gap: 8 }}>
          {COMPARE.map((c) => (
            <Chip key={c.value} label={c.label} selected={compare === c.value} onPress={() => setCompare(c.value)} />
          ))}
        </Row>
      </ScrollView>
      <Gap h={12} />
      <Card>
        <Explorer kind={compare} periods={periods} dayLogs={dayLogs} moods={moods} pain={pain} periodDays={periodDays} />
      </Card>
      <Gap h={14} />
      <Button kind="secondary" title="Open Mood Mirror" onPress={() => router.push('/mood')} />
    </Screen>
  );
}

function InsightCard({ insight, open, onHow, helpful }: { insight: Insight; open: boolean; onHow: () => void; helpful: boolean }) {
  const t = useTheme();
  return (
    <Card tint={insight.relatesTo.includes('pain') ? t.blush : insight.relatesTo.includes('mood') ? t.lavender : t.dark ? t.sage : '#EEF5EE'}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pill color={t.surface}>{insight.strength === 'consistent' ? 'Consistent pattern' : 'Emerging pattern'}</Pill>
      </Row>
      <T v="h3" style={{ marginTop: 8 }}>
        {insight.title}
      </T>
      <T v="body" style={{ marginTop: 4 }}>
        {insight.body}
      </T>
      {open && (
        <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: t.surfaceGlass }}>
          <T v="label">How did we find this?</T>
          <T v="small" style={{ marginTop: 4 }}>
            {insight.how}
          </T>
          <T v="small" soft style={{ marginTop: 4 }}>
            Based on: {insight.evidence}
          </T>
        </View>
      )}
      <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button small kind="secondary" title={open ? 'Hide details' : 'How did we find this?'} onPress={onHow} />
        <Button small kind={helpful ? 'primary' : 'ghost'} title={helpful ? '♥ Helpful' : 'Helpful'} onPress={() => useApp.getState().setInsightFeedback(insight.id, helpful ? null : 'helpful')} />
        <Button small kind="ghost" title="Doesn’t fit me" onPress={() => useApp.getState().setInsightFeedback(insight.id, 'dismissed')} accessibilityHint="Dismisses this insight" />
      </Row>
    </Card>
  );
}

function Explorer({ kind, periods, dayLogs, moods, pain, periodDays }: { kind: Compare; periods: ReturnType<typeof useCycle>['periods']; dayLogs: ReturnType<typeof useApp.getState>['dayLogs']; moods: ReturnType<typeof useApp.getState>['moods']; pain: ReturnType<typeof useApp.getState>['pain']; periodDays: ReturnType<typeof useApp.getState>['periodDays'] }) {
  const content = useMemo(() => {
    if (kind === 'pain_cycle') {
      const pts = byCycleDay(periods, pain.map((p) => ({ date: p.date, value: p.intensity })), 35);
      const energy = byCycleDay(periods, dayLogs.filter((l) => l.energy != null).map((l) => ({ date: l.date, value: (l.energy as number) * 2 })), 35);
      if (pts.length < 3 || periods.length < 2) return null;
      return {
        title: 'Average pain by cycle day',
        node: (
          <LineChart
            series={[
              { label: 'Pain (0–10)', color: '#D992AA', points: pts.map((p) => ({ x: p.cycleDay, y: p.value })) },
              { label: 'Energy (×2)', color: '#9F86D6', points: energy.map((p) => ({ x: p.cycleDay, y: p.value })) },
            ]}
            xMax={35}
            yMax={10}
            xLabel="· cycle day"
            bands={[{ from: 1, to: 5, color: '#F7DCE5' }]}
          />
        ),
        note: `Based on ${pain.length} pain logs across ${periods.length} periods. Shaded: typical bleeding days.`,
      };
    }
    if (kind === 'mood_sleep') {
      const sleepBy = new Map(dayLogs.filter((l) => l.sleepHours != null).map((l) => [l.date, l.sleepHours as number]));
      const pts = moods.filter((m) => sleepBy.has(m.date)).map((m) => ({ x: sleepBy.get(m.date) as number, y: VALENCE[m.mood] }));
      if (pts.length < 10) return null;
      const r = pearson(pts.map((p) => p.x), pts.map((p) => p.y));
      return {
        title: 'Mood (1 = hard, 5 = good) vs hours slept',
        node: <Scatter points={pts} xLabel="Hours slept" yLabel="Mood" xDomain={[4, 10]} yDomain={[1, 5]} color="#9F86D6" />,
        note: `${pts.length} days with both logged. ${r !== null ? `Correlation ${r.toFixed(2)} (${Math.abs(r) < 0.2 ? 'little or no' : Math.abs(r) < 0.45 ? 'a modest' : 'a clear'} relationship).` : ''} Correlation isn’t causation.`,
      };
    }
    if (kind === 'energy_activity') {
      const levels = ['none', 'light', 'moderate', 'active'] as const;
      const data = levels.map((lv) => {
        const xs = dayLogs.filter((l) => l.activity === lv && l.energy != null).map((l) => l.energy as number);
        return { label: lv === 'none' ? 'Rest' : lv[0].toUpperCase() + lv.slice(1), value: xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0, n: xs.length };
      });
      if (data.reduce((a, d) => a + d.n, 0) < 10) return null;
      return { title: 'Average energy (1–5) by movement', node: <PetalBars data={data} max={5} color="#CADCCB" />, note: `Days per group: ${data.map((d) => `${d.label} ${d.n}`).join(', ')}.` };
    }
    if (kind === 'bleeding_pain') {
      const flows = ['spotting', 'light', 'medium', 'heavy', 'very_heavy'] as const;
      const painBy = new Map<string, number>();
      for (const p of pain) painBy.set(p.date, Math.max(painBy.get(p.date) ?? 0, p.intensity));
      const data = flows.map((f) => {
        const ds = periodDays.filter((d) => d.flow === f);
        const xs = ds.map((d) => painBy.get(d.date) ?? 0);
        return { label: f === 'very_heavy' ? 'V. heavy' : f[0].toUpperCase() + f.slice(1), value: xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0, n: xs.length };
      });
      if (data.reduce((a, d) => a + d.n, 0) < 6) return null;
      return { title: 'Average highest pain by flow', node: <PetalBars data={data} max={10} color="#D992AA" />, note: `Bleeding days per group: ${data.map((d) => `${d.label} ${d.n}`).join(', ')}. Days without a pain log count as 0.` };
    }
    const stressDates = new Set(moods.filter((m) => m.tags.includes('stress')).map((m) => m.date));
    const s = dayLogs.filter((l) => stressDates.has(l.date));
    const o = dayLogs.filter((l) => !stressDates.has(l.date));
    if (s.length < 4 || o.length < 4) return null;
    const avg = (a: typeof dayLogs) => Math.round((a.reduce((x, l) => x + l.symptoms.length, 0) / a.length) * 10) / 10;
    return {
      title: 'Symptoms logged per day',
      node: <PetalBars data={[{ label: 'Stress-tagged days', value: avg(s) }, { label: 'Other days', value: avg(o) }]} max={Math.max(1, avg(s), avg(o)) * 1.2} color="#FFDCCB" />,
      note: `${s.length} stress-tagged days vs ${o.length} other days.`,
    };
  }, [kind, periods, dayLogs, moods, pain, periodDays]);

  if (!content)
    return (
      <View>
        <T v="h3">Not enough data yet</T>
        <T v="small" muted style={{ marginTop: 4 }}>
          We need a bit more logging before this comparison is meaningful. We’d rather show nothing than something misleading.
        </T>
      </View>
    );
  return (
    <View>
      <T v="h3">{content.title}</T>
      <Gap h={8} />
      {content.node}
      <T v="small" muted style={{ marginTop: 8 }}>
        {content.note}
      </T>
    </View>
  );
}
