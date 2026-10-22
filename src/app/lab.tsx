import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Card, Gap, Notice, Pill, Row, Screen, SectionTitle, T, Toggle } from '../components/ui';
import { useApp } from '../store/app';
import { useCycle, useToday } from '../store/derived';
import { LAB_COPY, METHOD_COPY, predictionLab } from '../engines/prediction';
import { formatRange, formatShort } from '../lib/dates';
import { useTheme } from '../theme/useTheme';

/** Prediction Lab: experimental estimates, scored on the person's own past cycles. */
export default function Lab() {
  const t = useTheme();
  const s = useApp();
  const today = useToday();
  const { periods, status } = useCycle();
  const on = s.settings.predictionLab;
  const wearOn = s.settings.wearables.enabled;
  const lab = useMemo(() => predictionLab({ periods, dayLogs: s.dayLogs, wearables: wearOn ? s.wearables : [], today }), [periods, s.dayLogs, s.wearables, wearOn, today]);
  const caveat = s.profile.caveats.length > 0;

  return (
    <Screen title="Prediction Lab" eyebrow="Research preview">
      <T v="body" muted>
        {LAB_COPY.intro}
      </T>
      <Gap h={12} />
      <Notice tone="warn">{LAB_COPY.never}</Notice>
      <Gap h={8} />
      <Card>
        <Toggle label="Show the Prediction Lab" detail="Adds a Lab line under your prediction in My Cycle." value={on} onChange={(v) => s.updateSettings({ predictionLab: v })} />
      </Card>

      {caveat && (
        <>
          <Gap h={12} />
          <Notice tone="calm">You’ve told us about something that changes how cycles work (for example hormonal contraception or PCOS). The Lab’s estimates may be even less reliable for you.</Notice>
        </>
      )}

      {on && (
        <>
          <SectionTitle>This cycle</SectionTitle>
          {lab.estimates.length ? (
            <View style={{ gap: 10 }}>
              {lab.estimates.map((e) => (
                <Card key={e.method} tint={lab.best === e.method ? t.lavender : undefined}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="h3">{METHOD_COPY[e.method].title}</T>
                    {lab.best === e.method && <Pill color={t.surface}>Closest for you so far</Pill>}
                  </Row>
                  <T v="h2" style={{ marginTop: 4 }}>
                    {formatRange(e.earliest, e.latest)}
                  </T>
                  <T v="small" muted>
                    {`Most likely around ${formatShort(e.likely)}`}
                  </T>
                  <T v="small" style={{ marginTop: 6 }}>
                    {e.method === 'temperature' && lab.current?.shift
                      ? `Your ${lab.current.shift.source === 'bbt' ? 'temperature' : 'night-time skin temperature'} rose on ${formatShort(lab.current.shift.riseDate)}, so ovulation probably happened around ${formatShort(lab.current.shift.ovulation)}.`
                      : e.pastError !== null
                        ? `On your past cycles this was off by ${e.pastError} days on average.`
                        : 'Not enough past cycles yet to check this one.'}
                  </T>
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <T v="small" muted>
                Log at least three periods to compare methods.
              </T>
            </Card>
          )}
          {!lab.current?.shift && (
            <>
              <Gap h={10} />
              <Notice tone="info">
                {!lab.readings
                  ? LAB_COPY.needsTemp
                  : lab.best === 'temperature'
                    ? 'The temperature method has been closest for you so far. It will add an estimate once this cycle’s rise shows up, usually a day or two after ovulation.'
                    : 'No temperature rise found in this cycle yet. It usually shows up a day or two after ovulation.'}
              </Notice>
            </>
          )}

          <SectionTitle>How each method did on your past cycles</SectionTitle>
          <Card>
            {lab.scores.map((sc) => (
              <View key={sc.method} style={{ paddingVertical: 8 }} accessible>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="bodyMedium">{METHOD_COPY[sc.method].title}</T>
                  <T v="label">{sc.meanError === null ? 'not checked yet' : `± ${sc.meanError} days`}</T>
                </Row>
                <T v="small" muted>
                  {METHOD_COPY[sc.method].detail}
                </T>
                {sc.tested > 0 && sc.within2 !== null && (
                  <T v="small" soft>
                    {`Within 2 days: ${Math.round(sc.within2 * 100)}% of ${sc.tested} cycles`}
                  </T>
                )}
              </View>
            ))}
            <T v="small" soft style={{ marginTop: 6 }}>
              Each method is checked as if it were made at the time, using only the cycles before. The temperature method can only be checked on cycles where a rise was found, and it is made later in the cycle, so it has an advantage.
            </T>
          </Card>

          {lab.cycles.some((c) => c.shift) && (
            <>
              <SectionTitle>Temperature, cycle by cycle</SectionTitle>
              <Card>
                {lab.cycles
                  .filter((c) => c.shift)
                  .map((c) => (
                    <Row key={c.start} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                      <T v="body">{formatShort(c.start)}</T>
                      <T v="small" muted>
                        {`Rise on day ${(Date.parse(c.shift!.riseDate) - Date.parse(c.start)) / 86400000 + 1}${c.luteal ? ` · luteal ${c.luteal} days` : ''}`}
                      </T>
                    </Row>
                  ))}
                {lab.lutealMedian !== null && (
                  <T v="small" soft style={{ marginTop: 6 }}>
                    {`Your usual luteal length: ${lab.lutealMedian} days`}
                  </T>
                )}
              </Card>
            </>
          )}

          <SectionTitle>Standard estimate</SectionTitle>
          <Card onPress={() => router.push('/(tabs)/cycle')}>
            <T v="small" muted>
              {status.prediction
                ? `The rest of the app still shows ${formatRange(status.prediction.nextStartEarliest, status.prediction.nextStartLatest)}.`
                : 'The rest of the app still uses the standard estimate.'}
            </T>
          </Card>
        </>
      )}
    </Screen>
  );
}
