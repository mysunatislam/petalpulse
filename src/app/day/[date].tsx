import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, ChipGroup, Gap, Notice, Row, Screen, SectionTitle, Stepper, T, tap } from '../../components/ui';
import { useApp } from '../../store/app';
import { EMPTY_DAY_LOG, Flow, Symptom, DayLog } from '../../data/types';
import { formatLong, isValidISODate, todayISO } from '../../lib/dates';
import { FLOW_LABEL, SYMPTOM_LABEL } from '../../lib/labels';
import { useTheme } from '../../theme/useTheme';
import { fonts } from '../../theme/tokens';

const FLOWS: (Flow | 'none')[] = ['none', 'spotting', 'light', 'medium', 'heavy', 'very_heavy'];

export default function DayScreen() {
  const t = useTheme();
  const { date: raw } = useLocalSearchParams<{ date: string }>();
  const date = isValidISODate(raw) ? raw : todayISO();
  const future = date > todayISO();
  const existingFlow = useApp((s) => s.periodDays.find((d) => d.date === date)?.flow ?? null);
  const existingLog = useApp((s) => s.dayLogs.find((d) => d.date === date)) ?? EMPTY_DAY_LOG(date);
  const [flow, setFlow] = useState<Flow | 'none'>(existingFlow ?? 'none');
  const [log, setLog] = useState<DayLog>(existingLog);
  const [showFertility, setShowFertility] = useState(!!(existingLog.bbt || existingLog.lhTest || existingLog.mucus));
  const [saved, setSaved] = useState(false);
  const set = (p: Partial<DayLog>) => {
    setSaved(false);
    setLog((l) => ({ ...l, ...p }));
  };

  const save = async () => {
    if (!future) await useApp.getState().setPeriodDay(date, flow === 'none' ? null : flow);
    await useApp.getState().saveDayLog(log);
    tap('success');
    setSaved(true);
    setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/cycle')), 650);
  };

  return (
    <Screen title={formatLong(date)} eyebrow={date === todayISO() ? 'Today' : 'Day log'}>
      {future ? (
        <Notice tone="calm">This day is in the future. You can add notes, and bleeding can be logged once the day arrives.</Notice>
      ) : (
        <>
          <SectionTitle>Bleeding</SectionTitle>
          <ChipGroup
            options={FLOWS.map((f) => ({ value: f, label: f === 'none' ? 'None' : FLOW_LABEL[f] }))}
            value={flow}
            onChange={(v) => {
              setSaved(false);
              setFlow(v as Flow | 'none');
            }}
          />
          <T v="small" muted style={{ marginTop: 8 }}>
            Spotting alone doesn’t start a new cycle.
          </T>
          {flow === 'very_heavy' && (
            <>
              <Gap h={10} />
              <Notice tone="warn" title="Very heavy bleeding" action="When to get care" onAction={() => router.push('/support')}>
                If you’re soaking through a pad or tampon every hour for a few hours, passing large clots, or feel dizzy or faint, please seek medical care.
              </Notice>
            </>
          )}
        </>
      )}

      <SectionTitle>Body</SectionTitle>
      <ChipGroup
        multi
        options={(Object.keys(SYMPTOM_LABEL) as Symptom[]).filter((s) => s !== 'fainting').map((s) => ({ value: s, label: SYMPTOM_LABEL[s] }))}
        value={log.symptoms}
        onChange={(v) => set({ symptoms: v as Symptom[] })}
      />

      <SectionTitle>Energy</SectionTitle>
      <ChipGroup
        options={[
          { value: '1', label: '1 · Drained' },
          { value: '2', label: '2 · Low' },
          { value: '3', label: '3 · Okay' },
          { value: '4', label: '4 · Good' },
          { value: '5', label: '5 · Bright' },
        ]}
        value={log.energy ? String(log.energy) : null}
        onChange={(v) => set({ energy: Number(v) })}
      />

      <SectionTitle>Sleep last night</SectionTitle>
      <Stepper label="Hours of sleep" value={log.sleepHours} min={0} max={14} step={0.5} format={(v) => `${v} h`} onChange={(v) => set({ sleepHours: v })} />

      <SectionTitle>Movement</SectionTitle>
      <ChipGroup
        options={[
          { value: 'none', label: 'Rest day' },
          { value: 'light', label: 'Light' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'active', label: 'Active' },
        ]}
        value={log.activity}
        onChange={(v) => set({ activity: v as DayLog['activity'] })}
      />

      <SectionTitle action={showFertility ? 'Hide' : 'Show'} onAction={() => setShowFertility(!showFertility)}>
        Optional cycle signs
      </SectionTitle>
      {showFertility ? (
        <Card glass>
          <T v="small" muted>
            For people who want to track these. They can refine estimates, but are never a method of contraception.
          </T>
          <Gap h={12} />
          <T v="label">Basal body temperature (°C)</T>
          <Gap h={6} />
          <Stepper label="Basal body temperature" value={log.bbt} min={35} max={38.5} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => set({ bbt: v === null ? null : Math.round(v * 100) / 100 })} />
          <Gap h={14} />
          <T v="label">LH (ovulation) test</T>
          <Gap h={6} />
          <ChipGroup options={[{ value: 'positive', label: 'Positive' }, { value: 'negative', label: 'Negative' }]} value={log.lhTest} onChange={(v) => set({ lhTest: v as DayLog['lhTest'] })} />
          <Gap h={14} />
          <T v="label">Cervical mucus</T>
          <Gap h={6} />
          <ChipGroup
            options={[
              { value: 'dry', label: 'Dry' },
              { value: 'sticky', label: 'Sticky' },
              { value: 'creamy', label: 'Creamy' },
              { value: 'watery', label: 'Watery' },
              { value: 'egg_white', label: 'Egg-white' },
            ]}
            value={log.mucus}
            onChange={(v) => set({ mucus: v as DayLog['mucus'] })}
          />
        </Card>
      ) : null}

      <SectionTitle>Notes</SectionTitle>
      <TextInput
        value={log.notes}
        onChangeText={(notes) => set({ notes })}
        multiline
        placeholder="Anything you want to remember about today"
        placeholderTextColor={t.textSoft}
        accessibilityLabel="Notes"
        style={{ minHeight: 100, borderRadius: 20, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceGlass, padding: 16, color: t.text, fontFamily: fonts.sans, fontSize: 15, textAlignVertical: 'top' }}
      />
      <Gap h={20} />
      <Button title={saved ? 'Saved 🌸' : 'Save'} onPress={save} />
      <Row style={{ justifyContent: 'center', marginTop: 10 }}>
        <Button kind="ghost" small title="Log pain on the body map" onPress={() => router.push('/pain/log')} />
      </Row>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
