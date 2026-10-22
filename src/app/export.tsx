import React, { useState } from 'react';
import { Card, Gap, Notice, Screen, SectionTitle, Segmented, T, Toggle, Button } from '../components/ui';
import { useApp } from '../store/app';
import { useCycle, useToday } from '../store/derived';
import { buildReportData, buildReportHtml, ReportOptions } from '../engines/report';
import { addDays, formatLong } from '../lib/dates';
import { sharePdf } from '../lib/share';

export default function ExportScreen() {
  const today = useToday();
  const { status, periods } = useCycle();
  const s = useApp();
  const [months, setMonths] = useState<'1' | '3' | '6' | '12'>('6');
  const [opts, setOpts] = useState({ includeCycle: true, includePain: true, includeSymptoms: true, includeMood: false, includeNotes: false, includeTrends: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const o: ReportOptions = { from: addDays(today, -Number(months) * 30), to: today, ...opts };
  const data = { profile: s.profile, status, periods, pain: s.pain, moods: s.moods, dayLogs: s.dayLogs };
  const preview = buildReportData(o, data);

  const create = async () => {
    setBusy(true);
    setMsg('');
    try {
      await sharePdf(buildReportHtml(o, data), 'petal-pulse-health-summary.pdf');
      setMsg('Your summary is ready to share.');
    } catch {
      setMsg('Something went wrong creating the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Health summary" eyebrow="For your clinician">
      <T v="body" muted>
        A clear, factual summary of what you’ve recorded. You choose what to include, and it’s only shared if you send it.
      </T>
      <SectionTitle>Time period</SectionTitle>
      <Segmented
        options={[
          { value: '1', label: '1 month' },
          { value: '3', label: '3 months' },
          { value: '6', label: '6 months' },
          { value: '12', label: '12 months' },
        ]}
        value={months}
        onChange={setMonths}
      />
      <T v="small" muted style={{ marginTop: 8 }}>
        {formatLong(o.from)} to {formatLong(o.to)}
      </T>
      <SectionTitle>Include</SectionTitle>
      <Card>
        <Toggle label="Cycle summary" detail={`${preview.cycles.length} cycles`} value={opts.includeCycle} onChange={(v) => setOpts({ ...opts, includeCycle: v })} />
        <Toggle label="Changes over time" detail="Cycle by cycle and month by month, with patterns" value={opts.includeTrends} onChange={(v) => setOpts({ ...opts, includeTrends: v })} />
        <Toggle label="Pain Passport" detail={`${preview.pain.episodes} pain logs`} value={opts.includePain} onChange={(v) => setOpts({ ...opts, includePain: v })} />
        <Toggle label="Symptoms & sleep" value={opts.includeSymptoms} onChange={(v) => setOpts({ ...opts, includeSymptoms: v })} />
        <Toggle label="Mood check-ins" detail="Counts only, no journal text" value={opts.includeMood} onChange={(v) => setOpts({ ...opts, includeMood: v })} />
        <Toggle label="Notes from pain logs" value={opts.includeNotes} onChange={(v) => setOpts({ ...opts, includeNotes: v })} />
      </Card>
      {s.profile.isDemo && (
        <>
          <Gap />
          <Notice tone="warn">This is demo data. The PDF will be clearly marked as synthetic.</Notice>
        </>
      )}
      <Gap h={18} />
      <Button title="Create PDF" onPress={create} loading={busy} />
      {msg ? (
        <T v="small" muted center style={{ marginTop: 10 }} accessibilityLiveRegion="polite">
          {msg}
        </T>
      ) : null}
    </Screen>
  );
}
