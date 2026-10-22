import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { announce, Button, Card, Gap, Notice, Row, Screen, SectionTitle, T, Toggle, tap } from '../components/ui';
import { useApp } from '../store/app';
import { useCycle, useToday } from '../store/derived';
import { formatSleep, recentSummary, summarizeHealth, syncWindow, WEARABLE_COPY, WEARABLE_METRICS, wearableInsights } from '../engines/wearables';
import { grantedMetrics, healthStatus, HealthStatus, openHealthSettings, readHealth, requestHealthAccess } from '../lib/healthConnect';
import { formatShort, num } from '../lib/dates';
import { useLocalize } from '../i18n';
import { useTheme } from '../theme/useTheme';
import type { WearableMetric } from '../data/types';

const ALL: WearableMetric[] = ['sleep', 'steps', 'restingHr', 'temperature'];

export default function Wearables() {
  const t = useTheme();
  const L = useLocalize();
  const s = useApp();
  const today = useToday();
  const { periods } = useCycle();
  const w = s.settings.wearables;
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    healthStatus().then(setStatus);
  }, []);

  const setW = (patch: Partial<typeof w>) => s.updateSettings({ wearables: { ...w, ...patch } });

  const sync = async (metrics = w.metrics) => {
    if (s.profile.isDemo) {
      setMsg('Demo mode uses synthetic watch data, so there is nothing to sync.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const { from, to } = syncWindow(w.lastSync, today);
      const raw = await readHealth(metrics, new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`));
      const days = summarizeHealth(raw, metrics);
      await s.saveWearables(days, new Date().toISOString());
      setMsg(days.length ? `Updated ${days.length} days.` : 'Nothing new to add yet.');
      announce('Wearable data updated');
    } catch {
      setMsg('Couldn’t read from Health Connect. Check its permissions and try again.');
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    const want = w.metrics.length ? w.metrics : ALL;
    const granted = await requestHealthAccess(want);
    if (!granted.length) {
      setMsg('No permissions were given, so nothing will be read.');
      return;
    }
    tap('success');
    await setW({ enabled: true, metrics: granted });
    await sync(granted);
  };

  const toggleMetric = async (m: WearableMetric, on: boolean) => {
    if (on && !s.profile.isDemo && status === 'available') {
      const granted = await grantedMetrics();
      if (!granted.includes(m)) {
        const got = await requestHealthAccess([m]);
        if (!got.includes(m)) return setMsg(`${WEARABLE_METRICS[m].title} wasn’t allowed in Health Connect.`);
      }
    }
    const metrics = on ? [...new Set([...w.metrics, m])] : w.metrics.filter((x) => x !== m);
    await setW({ metrics, enabled: metrics.length > 0 && w.enabled });
    // Stopping a metric also removes what was summarised from it.
    if (!on) await s.pruneWearables(metrics);
  };

  const stop = async () => {
    await setW({ enabled: false });
    setMsg('Stopped. Nothing more will be read. To remove the app’s access completely, open Health Connect.');
  };

  const sum = recentSummary(s.wearables, today);
  const found = w.enabled ? wearableInsights({ periods, dayLogs: s.dayLogs, moods: s.moods, pain: s.pain, wearables: s.wearables }) : [];
  const available = status === 'available' || s.profile.isDemo;

  return (
    <Screen title="Wearables" eyebrow="Health Connect · read only">
      <T v="body" muted>
        {WEARABLE_COPY.intro}
      </T>
      <Gap h={12} />
      <Card tint={t.lavender}>
        {WEARABLE_COPY.points.map((p) => (
          <T key={p} v="small" style={{ marginBottom: 6 }}>
            ✿ {p}
          </T>
        ))}
      </Card>

      {status !== null && !available && (
        <>
          <Gap h={12} />
          <Notice tone="info" title={Platform.OS === 'android' ? 'Health Connect needed' : 'Android only'}>
            {Platform.OS === 'android' ? (status === 'needs_update' ? 'Health Connect needs an update from the Play Store first.' : WEARABLE_COPY.unavailable) : WEARABLE_COPY.webPreview}
          </Notice>
        </>
      )}

      <SectionTitle>What to read</SectionTitle>
      <Card>
        {ALL.map((m) => (
          <Toggle key={m} label={`${WEARABLE_METRICS[m].icon}  ${L(WEARABLE_METRICS[m].title)}`} detail={WEARABLE_METRICS[m].detail} value={w.metrics.includes(m)} onChange={(v) => toggleMetric(m, v)} />
        ))}
        <Gap h={8} />
        {!w.enabled ? (
          <Button title="Connect Health Connect" disabled={!available || s.profile.isDemo} onPress={connect} accessibilityHint="Opens Health Connect to choose what to share" />
        ) : (
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button small title="Sync now" loading={busy} onPress={() => sync()} />
            <Button small kind="ghost" title="Stop reading" onPress={stop} />
            {Platform.OS === 'android' && <Button small kind="ghost" title="Open Health Connect" onPress={openHealthSettings} />}
          </Row>
        )}
        {w.lastSync ? (
          <T v="small" soft style={{ marginTop: 8 }}>
            {`Last updated ${formatShort(w.lastSync.slice(0, 10))}`}
          </T>
        ) : null}
        {msg ? (
          <T v="small" muted style={{ marginTop: 6 }} accessibilityLiveRegion="polite">
            {msg}
          </T>
        ) : null}
      </Card>

      {s.wearables.length > 0 && (
        <>
          <SectionTitle>Your last 7 days</SectionTitle>
          <Card>
            <View style={{ gap: 8 }}>
              {sum.avgSleepMinutes !== null && <Stat label="Sleep, on average" value={formatSleep(sum.avgSleepMinutes)} />}
              {sum.avgSteps !== null && <Stat label="Steps, on average" value={num(sum.avgSteps.toLocaleString('en-US'))} />}
              {sum.avgRestingHr !== null && <Stat label="Resting heart rate" value={`${sum.avgRestingHr} bpm`} />}
              {sum.latest?.tempDelta != null && <Stat label="Last night’s temperature" value={`${sum.latest.tempDelta > 0 ? '+' : ''}${num(sum.latest.tempDelta)} °C`} />}
              {sum.days === 0 && <T v="small" muted>No readings in the last week.</T>}
            </View>
            <T v="small" soft style={{ marginTop: 10 }}>
              {`${s.wearables.length} days summarised on this phone.`}
            </T>
          </Card>

          <SectionTitle>What we’ve noticed</SectionTitle>
          {found.length ? (
            <View style={{ gap: 10 }}>
              {found.map((i) => (
                <Card key={i.id}>
                  <T v="h3">{i.title}</T>
                  <T v="small" style={{ marginTop: 4 }}>
                    {i.body}
                  </T>
                  <T v="small" muted style={{ marginTop: 6 }}>
                    {i.how}
                  </T>
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <T v="small" muted>
                Patterns need at least two cycles of readings. They’ll appear here and in Insights.
              </T>
            </Card>
          )}
          <Gap h={10} />
          <Button kind="secondary" title="Open the Prediction Lab" onPress={() => router.push('/lab')} />

          <SectionTitle>Delete</SectionTitle>
          {!confirmDelete ? (
            <Button kind="ghost" title="Delete wearable summaries" onPress={() => setConfirmDelete(true)} />
          ) : (
            <Notice tone="warn" title="Delete all wearable summaries?">
              <T v="small">This removes them from this phone. Nothing in Health Connect is touched.</T>
              <Row style={{ gap: 8, marginTop: 8 }}>
                <Button
                  small
                  title="Delete"
                  onPress={async () => {
                    await s.pruneWearables([]);
                    await setW({ enabled: false, lastSync: null });
                    setConfirmDelete(false);
                    announce('Deleted');
                  }}
                />
                <Button small kind="ghost" title="Cancel" onPress={() => setConfirmDelete(false)} />
              </Row>
            </Notice>
          )}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const L = useLocalize();
  return (
    <Row style={{ justifyContent: 'space-between' }} accessible accessibilityLabel={`${L(label)}: ${L(value)}`}>
      <T v="body" muted>
        {label}
      </T>
      <T v="h3">{value}</T>
    </Row>
  );
}
