import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { announce, Button, Card, Gap, Notice, Row, Screen, SectionTitle, T, Toggle, tap } from '../components/ui';
import { useApp } from '../store/app';
import { useCycle } from '../store/derived';
import {
  buildContribution,
  describeContribution,
  giveResearchConsent,
  hasResearchConsent,
  RESEARCH_COPY,
  researchEligible,
  withdrawResearchConsent,
} from '../engines/research';
import type { Contribution } from '../engines/researchSchema';
import { deleteContribution, RESEARCH_URL, sendContribution } from '../lib/research';
import { formatShort } from '../lib/dates';
import { useTheme } from '../theme/useTheme';
import { fonts } from '../theme/tokens';

export default function Research() {
  const t = useTheme();
  const s = useApp();
  const { periods } = useCycle();
  const { settings, profile } = s;
  const [agree, setAgree] = useState(false);
  const [preview, setPreview] = useState<Contribution | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const elig = researchEligible(profile);
  const consented = hasResearchConsent(settings);
  const receipts = settings.research.receipts;
  const draft = useMemo(
    () => (consented ? buildContribution({ profile, settings, periods, dayLogs: s.dayLogs, moods: s.moods, pain: s.pain }) : null),
    [consented, profile, settings, periods, s.dayLogs, s.moods, s.pain],
  );

  const send = async () => {
    if (!preview) return;
    setBusy(true);
    const r = await sendContribution(RESEARCH_URL, preview);
    setBusy(false);
    if (!r) return setMsg('Couldn’t send right now. Nothing was shared. Please try again later.');
    tap('success');
    await s.updateSettings({ research: { ...settings.research, receipts: [...receipts, r] } });
    setPreview(null);
    setMsg('Thank you. Your summary was sent.');
    announce('Sent');
  };

  const deleteAll = async () => {
    setBusy(true);
    const left = [];
    for (const r of receipts) if (!(await deleteContribution(r))) left.push(r);
    setBusy(false);
    await s.updateSettings({ research: { ...useApp.getState().settings.research, receipts: left } });
    setMsg(left.length ? `${left.length} could not be deleted yet. Try again later.` : 'Everything you sent has been deleted.');
  };

  return (
    <Screen title={RESEARCH_COPY.title} eyebrow="Opt-in research">
      <T v="body" muted>
        {RESEARCH_COPY.intro}
      </T>

      <SectionTitle>What would be shared</SectionTitle>
      <Card>
        {RESEARCH_COPY.shared.map((p) => (
          <T key={p} v="small" style={{ marginBottom: 4 }}>
            ✓ {p}
          </T>
        ))}
        <Gap h={8} />
        <T v="label">Never shared</T>
        <Gap h={4} />
        {RESEARCH_COPY.never.map((p) => (
          <T key={p} v="small" style={{ marginBottom: 4 }}>
            ✕ {p}
          </T>
        ))}
      </Card>
      <Gap h={10} />
      <Notice tone="calm">{RESEARCH_COPY.noise}</Notice>
      <Gap h={10} />
      <T v="small" muted>
        {RESEARCH_COPY.withdraw}
      </T>

      <SectionTitle>Take part</SectionTitle>
      {!elig.ok ? (
        <Notice tone="info">{elig.reason}</Notice>
      ) : !RESEARCH_URL && !consented ? (
        <Notice tone="info">{RESEARCH_COPY.noEndpoint}</Notice>
      ) : !consented ? (
        <Card>
          <Toggle label={RESEARCH_COPY.consent} value={agree} onChange={setAgree} />
          <Gap h={8} />
          <Button title="Agree" disabled={!agree} onPress={() => s.updateSettings(giveResearchConsent(settings))} />
        </Card>
      ) : (
        <Card>
          <T v="small" muted>
            {`You agreed on ${formatShort((settings.research.consentedAt ?? '').slice(0, 10))}.`}
          </T>
          <Gap h={10} />
          {!preview ? (
            draft && 'error' in draft ? (
              <Notice tone="info">{draft.error}</Notice>
            ) : (
              <Button title="Prepare a summary to review" onPress={() => draft && !('error' in draft) && setPreview(draft)} disabled={!RESEARCH_URL} />
            )
          ) : (
            <View>
              <T v="h3">This is exactly what would be sent</T>
              <Gap h={6} />
              {describeContribution(preview).map((l) => (
                <T key={l} v="small" style={{ marginBottom: 3 }}>
                  • {l}
                </T>
              ))}
              <Toggle label="Show the raw data" value={showRaw} onChange={setShowRaw} />
              {showRaw && (
                <T v="small" style={{ fontFamily: fonts.sans, backgroundColor: t.surfaceGlass, padding: 10, borderRadius: 12 }} selectable>
                  {JSON.stringify(preview, null, 2)}
                </T>
              )}
              <Row style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Button small title="Send" loading={busy} onPress={send} />
                <Button small kind="ghost" title="Don’t send" onPress={() => setPreview(null)} />
              </Row>
            </View>
          )}
          {!RESEARCH_URL && (
            <T v="small" soft style={{ marginTop: 8 }}>
              {RESEARCH_COPY.noEndpoint}
            </T>
          )}
          <Gap h={12} />
          <Button kind="ghost" title="Stop taking part" onPress={() => s.updateSettings(withdrawResearchConsent(settings))} />
        </Card>
      )}

      {receipts.length > 0 && (
        <>
          <SectionTitle>What you’ve sent</SectionTitle>
          <Card>
            {receipts.map((r) => (
              <T key={r.id} v="small" style={{ marginBottom: 4 }}>
                {`• ${formatShort(r.sentAt.slice(0, 10))}`}
              </T>
            ))}
            <Gap h={8} />
            <Button small kind="ghost" title="Delete everything I sent" loading={busy} onPress={deleteAll} />
            <T v="small" soft style={{ marginTop: 6 }}>
              {`${receipts.length} sent · delete keys are kept only on this phone`}
            </T>
          </Card>
        </>
      )}
      {msg ? (
        <T v="small" muted style={{ marginTop: 10 }} accessibilityLiveRegion="polite">
          {msg}
        </T>
      ) : null}
    </Screen>
  );
}
