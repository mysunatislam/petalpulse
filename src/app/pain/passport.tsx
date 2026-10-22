import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Gap, Pill, Row, Screen, SectionTitle, Segmented, T } from '../../components/ui';
import { PetalBars } from '../../components/Charts';
import { REGION_LABEL } from '../../components/BodyMap';
import { useApp } from '../../store/app';
import { useCycle, useToday } from '../../store/derived';
import { summarizePain } from '../../engines/insights';
import { isWorsening } from '../../engines/safety';
import { addDays, formatShort } from '../../lib/dates';
import { IMPACT_LABEL, QUALITY_LABEL, SYMPTOM_LABEL } from '../../lib/labels';
import { COMFORT_ITEMS } from '../../engines/personalization';
import { useTheme } from '../../theme/useTheme';

export default function Passport() {
  const t = useTheme();
  const today = useToday();
  const pain = useApp((s) => s.pain);
  const { periods } = useCycle();
  const [range, setRange] = useState<'30' | '90' | '180'>('30');
  const from = addDays(today, -Number(range) + 1);
  const s = useMemo(() => summarizePain(pain, periods, from, today), [pain, periods, from, today]);
  const episodes = pain.filter((p) => p.date >= from).slice().reverse();
  const worsening = isWorsening(pain);

  return (
    <Screen title="Pain Passport" eyebrow="Your pain story">
      <Segmented
        options={[
          { value: '30', label: 'This month' },
          { value: '90', label: '3 months' },
          { value: '180', label: '6 months' },
        ]}
        value={range}
        onChange={setRange}
      />
      <Gap h={14} />
      <Row style={{ gap: 10 }}>
        <Stat label="Pain days" value={String(s.daysWithPain)} tint={t.blush} />
        <Stat label="Average" value={s.avgIntensity !== null ? `${s.avgIntensity}` : '—'} tint={t.lavender} />
        <Stat label="Highest" value={s.maxIntensity !== null ? `${s.maxIntensity}` : '—'} tint={t.peach} />
      </Row>
      {worsening && (
        <Card tint={t.warnBg} style={{ marginTop: 12 }}>
          <T v="h3" color={t.warn}>Your pain seems to be increasing</T>
          <T v="small">Your recent logs are higher than before. That’s worth discussing with a health professional. You can bring this passport.</T>
        </Card>
      )}

      <SectionTitle>When it happens</SectionTitle>
      <Card>
        <PetalBars
          max={Math.max(1, s.timing.duringBleeding, s.timing.beforeBleeding, s.timing.otherTimes + s.timing.unknown)}
          color={t.primary}
          data={[
            { label: 'During period', value: s.timing.duringBleeding },
            { label: 'Days before', value: s.timing.beforeBleeding },
            { label: 'Other times', value: s.timing.otherTimes + s.timing.unknown },
          ]}
        />
      </Card>

      <SectionTitle>Where it happens</SectionTitle>
      <Card>
        {s.topRegions.length ? (
          s.topRegions.map((r) => (
            <Row key={r.region} style={{ paddingVertical: 6 }}>
              <T v="body" style={{ flex: 1 }}>
                {REGION_LABEL[r.region as keyof typeof REGION_LABEL]}
              </T>
              <View style={{ width: 120, height: 8, borderRadius: 4, backgroundColor: t.border, marginRight: 10 }}>
                <View style={{ width: `${(r.count / s.episodes) * 100}%`, height: 8, borderRadius: 4, backgroundColor: t.primary }} />
              </View>
              <T v="label">{r.count}</T>
            </Row>
          ))
        ) : (
          <T v="small" muted>
            No pain logged in this period.
          </T>
        )}
      </Card>

      {(s.qualities.length > 0 || Object.keys(s.impact).length > 0 || s.associated.length > 0) && (
        <>
          <SectionTitle>Details</SectionTitle>
          <Card>
            {s.qualities.length > 0 && <Line label="Felt like" value={s.qualities.map((q) => `${QUALITY_LABEL[q.quality as keyof typeof QUALITY_LABEL]} (${q.count})`).join(', ')} />}
            {Object.keys(s.impact).length > 0 && <Line label="Daily life" value={Object.entries(s.impact).map(([k, v]) => `${IMPACT_LABEL[k as keyof typeof IMPACT_LABEL]} (${v})`).join(', ')} />}
            {s.associated.length > 0 && <Line label="Alongside" value={s.associated.map((a) => `${SYMPTOM_LABEL[a.symptom as keyof typeof SYMPTOM_LABEL]} (${a.count})`).join(', ')} />}
            {s.tried.length > 0 && <Line label="What you tried" value={s.tried.map((x) => `${COMFORT_ITEMS[x.item]?.title ?? x.item} (helped ${x.helped}/${x.count})`).join(', ')} />}
          </Card>
        </>
      )}

      <SectionTitle>Timeline</SectionTitle>
      <View style={{ gap: 8 }}>
        {episodes.slice(0, 20).map((e) => (
          <Card key={e.id} style={{ paddingVertical: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="bodyMedium">{formatShort(e.date)}</T>
              <Pill color={e.intensity >= 7 ? t.dangerBg : e.intensity >= 4 ? t.peach : t.sage}>{e.intensity}/10</Pill>
            </Row>
            <T v="small" muted>
              {e.regions.map((r) => REGION_LABEL[r]).join(', ')}
              {e.qualities.length ? ` · ${e.qualities.map((q) => QUALITY_LABEL[q]).join(', ')}` : ''}
            </T>
          </Card>
        ))}
        {episodes.length === 0 && (
          <T v="small" muted>
            Your timeline will grow as you log.
          </T>
        )}
      </View>

      <Gap h={18} />
      <Button title="Log pain now" onPress={() => router.push('/pain/log')} />
      <Gap h={10} />
      <Button kind="secondary" title="Export a summary for my clinician (PDF)" onPress={() => router.push('/export')} />
    </Screen>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <Card tint={tint} style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }}>
      <T v="h1">{value}</T>
      <T v="small" muted>
        {label}
      </T>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <T v="label" muted>
        {label}
      </T>
      <T v="body">{value}</T>
    </View>
  );
}
