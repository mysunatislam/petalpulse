import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Gap, Notice, Pill, Row, Screen, SectionTitle, T } from '../../components/ui';
import { MonthCalendar } from '../../components/Calendar';
import { PetalBloom } from '../../components/PetalCompass';
import { useApp } from '../../store/app';
import { useCycle, useToday } from '../../store/derived';
import { buildCycles, PHASE_COPY, predictedDayKind } from '../../engines/cycle';
import { METHOD_COPY, predictionLab } from '../../engines/prediction';
import { formatLong, formatRange, formatShort } from '../../lib/dates';
import { FLOW_COLOR, FLOW_LABEL } from '../../lib/labels';
import { useTheme } from '../../theme/useTheme';
import { PHASE_PETALS } from '../../theme/tokens';

export default function CycleScreen() {
  const t = useTheme();
  const today = useToday();
  const periodDays = useApp((s) => s.periodDays);
  const pain = useApp((s) => s.pain);
  const { status, periods } = useCycle();
  const [selected, setSelected] = useState<string | null>(null);
  const byDate = new Map(periodDays.map((d) => [d.date, d]));
  const painDates = new Set(pain.map((p) => p.date));
  const seeded = status.lastPeriod && status.lastPeriod.days.length === 0 ? status.lastPeriod : null;
  const cycles = buildCycles(periods).filter((c) => c.length !== null).slice(-6);
  const labOn = useApp((s) => s.settings.predictionLab);
  const dayLogs = useApp((s) => s.dayLogs);
  const wearOn = useApp((s) => s.settings.wearables.enabled);
  const wearables = useApp((s) => s.wearables);
  const lab = useMemo(
    () => (labOn ? predictionLab({ periods, dayLogs, wearables: wearOn ? wearables : [], today }) : null),
    [labOn, periods, dayLogs, wearOn, wearables, today],
  );
  // The Lab's closest method when it has an estimate this cycle, otherwise the closest one that does.
  const labPick = lab
    ? (lab.estimates.find((e) => e.method === lab.best) ?? [...lab.estimates].sort((a, b) => (a.pastError ?? 99) - (b.pastError ?? 99))[0])
    : undefined;

  return (
    <Screen back={false} title="My Cycle" eyebrow="The Cycle Compass">
      <Card glass>
        <MonthCalendar
          selected={selected}
          onSelect={(d) => {
            setSelected(d);
            router.push(`/day/${d}`);
          }}
          maxDate={undefined}
          decorate={(d) => {
            const rec = byDate.get(d);
            if (rec) return { fill: FLOW_COLOR[rec.flow], dot: painDates.has(d) ? t.accent : undefined, label: `${FLOW_LABEL[rec.flow]} flow${painDates.has(d) ? ', pain logged' : ''}` };
            if (seeded && d >= seeded.start && d <= seeded.end) return { fill: FLOW_COLOR.light, label: 'Period (from onboarding)' };
            const kind = predictedDayKind(d, status);
            if (kind === 'predicted_period') return { ring: PHASE_PETALS.menstrual.petals[1], dashed: true, label: 'Possible period' };
            if (kind === 'ovulation_window') return { fill: t.dark ? '#3A2F48' : '#EFE8FB', label: 'Estimated ovulatory window' };
            if (painDates.has(d)) return { dot: t.accent, label: 'Pain logged' };
            return null;
          }}
        />
        <Row style={{ flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          <Legend color={FLOW_COLOR.medium} label="Bleeding" />
          <Legend color="transparent" ring={PHASE_PETALS.menstrual.petals[1]} label="Possible period" />
          {!status.phaseLimited && <Legend color={t.dark ? '#3A2F48' : '#EFE8FB'} label="Est. ovulatory window" />}
          <Legend color={t.accent} dot label="Pain logged" />
        </Row>
      </Card>

      <Row style={{ gap: 10, marginTop: 14 }}>
        <Button style={{ flex: 1 }} title="Log today" onPress={() => router.push(`/day/${today}`)} />
        <Button style={{ flex: 1 }} kind="secondary" title="Pain Passport" onPress={() => router.push('/pain/passport')} />
      </Row>

      <SectionTitle>Your prediction</SectionTitle>
      <Card>
        {status.prediction ? (
          <>
            <T v="eyebrow" soft>
              Next period may start
            </T>
            <T v="h1" style={{ marginTop: 4 }}>
              {formatRange(status.prediction.nextStartEarliest, status.prediction.nextStartLatest)}
            </T>
            <T v="small" muted style={{ marginTop: 4 }}>
              Most likely around {formatShort(status.prediction.nextStartLikely)} · {status.confidence} confidence
            </T>
            <Gap h={10} />
            <T v="body">{status.prediction.basisText}</T>
          </>
        ) : (
          <T v="body">We’re still learning your pattern. It’s too early to estimate this confidently. Log the first day of your next period to begin.</T>
        )}
        {status.phaseLimited && status.limitReason && (
          <>
            <Gap h={10} />
            <Notice tone="calm">{status.limitReason}</Notice>
          </>
        )}
        <Gap h={12} />
        <T v="small" muted>
          Predictions use your own recorded cycles: the middle value of up to six recent cycles, with a wider window when cycles vary. They are estimates, not certainties.
        </T>
      </Card>
      {labOn && (
        <>
          <Gap h={10} />
          <Card tint={t.lavender} onPress={() => router.push('/lab')} accessibilityLabel="Prediction Lab">
            <T v="eyebrow" soft>
              Prediction Lab · experimental
            </T>
            {labPick ? (
              <>
                <T v="h3" style={{ marginTop: 4 }}>
                  {formatRange(labPick.earliest, labPick.latest)}
                </T>
                <T v="small" muted>
                  {labPick.pastError !== null ? `${METHOD_COPY[labPick.method].title} · ± ${labPick.pastError} days on past cycles` : METHOD_COPY[labPick.method].title}
                </T>
              </>
            ) : (
              <T v="small" muted style={{ marginTop: 4 }}>
                Not enough data yet to compare methods.
              </T>
            )}
          </Card>
        </>
      )}

      {cycles.length > 0 && (
        <>
          <SectionTitle>Recent cycles</SectionTitle>
          <Card>
            {cycles.map((c) => (
              <Row key={c.start} style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
                <T v="body">{formatShort(c.start)}</T>
                <View style={{ flex: 1, marginHorizontal: 12, height: 8, borderRadius: 4, backgroundColor: t.border }}>
                  <View style={{ width: `${Math.min(100, ((c.length ?? 0) / 40) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: c.excluded ? t.textSoft : t.primary }} />
                </View>
                <T v="label">{c.length} days{c.excluded ? ' *' : ''}</T>
              </Row>
            ))}
            {cycles.some((c) => c.excluded) && (
              <T v="small" muted>
                * Very short or long cycles are shown but not used for predictions.
              </T>
            )}
            {status.stats.median !== null && (
              <Row style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pill>Typical: {Math.round(status.stats.median)} days</Pill>
                {status.stats.min !== null && <Pill color={t.lavender}>Range: {status.stats.min}–{status.stats.max} days</Pill>}
                {status.stats.irregular && <Pill color={t.peach}>Varies 8+ days</Pill>}
              </Row>
            )}
            {status.stats.irregular && (
              <T v="small" muted style={{ marginTop: 10 }}>
                Cycles that vary by 8 or more days are common, especially in teens and around perimenopause. If it’s new for you or worries you, it’s worth mentioning to a health professional.
              </T>
            )}
          </Card>
        </>
      )}

      <SectionTitle>Understanding the phases</SectionTitle>
      <T v="small" muted style={{ marginBottom: 10 }}>
        Your period happens at the start of the follicular phase, so the phases overlap rather than being separate boxes. Colours are a visual metaphor, not hormone measurements.
      </T>
      <View style={{ gap: 10 }}>
        {(['menstrual', 'follicular', 'ovulatory', 'luteal'] as const).map((p) => (
          <Card key={p} tint={status.phase === p ? t.blush : undefined}>
            <Row style={{ gap: 12 }}>
              <PetalBloom phase={p} size={54} />
              <View style={{ flex: 1 }}>
                <T v="h3">{cap(PHASE_COPY[p].title)}</T>
                <T v="small" muted>
                  {PHASE_COPY[p].detail}
                </T>
              </View>
            </Row>
          </Card>
        ))}
      </View>

      <Gap h={16} />
      <Notice tone="warn" title="Not a contraceptive">
        Petal & Pulse can’t tell you which days are safe or unsafe for pregnancy. Ovulation can’t be reliably determined from calendar dates, mood, or symptoms alone.
      </Notice>
      <Gap h={10} />
      <T v="small" muted>
        Optional signs like basal body temperature, LH tests and cervical mucus can be added in each day’s log.
        {status.ovulationWindow?.basis === 'lh' ? ' Your estimate currently uses a positive LH test you logged.' : ''}
      </T>
      {status.lastPeriod && (
        <T v="small" soft style={{ marginTop: 8 }}>
          Last period: {formatLong(status.lastPeriod.start)}
        </T>
      )}
    </Screen>
  );
}

function Legend({ color, label, ring, dot }: { color: string; label: string; ring?: string; dot?: boolean }) {
  return (
    <Row style={{ gap: 6 }}>
      <View style={{ width: dot ? 6 : 14, height: dot ? 6 : 14, borderRadius: 7, backgroundColor: color, borderWidth: ring ? 2 : 0, borderColor: ring, borderStyle: 'dashed' }} />
      <T v="small" muted>
        {label}
      </T>
    </Row>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
