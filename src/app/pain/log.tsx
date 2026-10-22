import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { BodyMap } from '../../components/BodyMap';
import { PainScale } from '../../components/PainScale';
import { Button, Card, ChipGroup, Gap, Notice, Row, Screen, T, Toggle, tap } from '../../components/ui';
import { useApp } from '../../store/app';
import { useToday } from '../../store/derived';
import type { BodyRegion, DailyImpact, PainEpisode, PainOnset, PainPattern, PainQuality, Symptom } from '../../data/types';
import { IMPACT_LABEL, ONSET_LABEL, PATTERN_LABEL, QUALITY_LABEL } from '../../lib/labels';
import { uid } from '../../lib/dates';
import { useT, useLocalize } from '../../i18n';
import { useMotionOff, useTheme } from '../../theme/useTheme';
import { fonts } from '../../theme/tokens';

export default function PainLog() {
  const L = useLocalize();
  const t = useTheme();
  const tr = useT();
  const today = useToday();
  const motionOff = useMotionOff();
  const [step, setStep] = useState(0);
  const [regions, setRegions] = useState<BodyRegion[]>([]);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [qualities, setQualities] = useState<PainQuality[]>([]);
  const [onset, setOnset] = useState<PainOnset | null>(null);
  const [pattern, setPattern] = useState<PainPattern | null>(null);
  const [impact, setImpact] = useState<DailyImpact | null>(null);
  const [other, setOther] = useState<Symptom[]>([]);
  const [heavy, setHeavy] = useState(false);
  const [pregnancy, setPregnancy] = useState<'yes' | 'no' | 'unsure' | null>(null);
  const [notes, setNotes] = useState('');

  const toggle = (r: BodyRegion) => setRegions((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const save = async () => {
    const ep: PainEpisode = {
      id: uid('pain'),
      date: today,
      createdAt: new Date().toISOString(),
      regions,
      intensity: intensity ?? 0,
      qualities,
      onset,
      pattern,
      impact,
      otherSymptoms: other,
      heavyBleeding: heavy,
      tried: [],
      helped: [],
      notes,
    };
    await useApp.getState().addPain(ep);
    tap('success');
    router.replace({ pathname: '/pain/comfort', params: { id: ep.id, preg: pregnancy === 'yes' || pregnancy === 'unsure' ? '1' : '0' } });
  };

  const enter = motionOff ? undefined : FadeInRight.duration(320);

  return (
    <Screen title="Pain Passport" eyebrow={`Step ${step + 1} of 3`}>
      {step === 0 && (
        <Animated.View entering={enter}>
          <T v="h2">Where do you feel it?</T>
          <T v="small" muted style={{ marginTop: 4, marginBottom: 12 }}>
            Tap the body or the labels below. Choose as many as you need.
          </T>
          <BodyMap selected={regions} onToggle={toggle} />
          <Gap h={20} />
          <Button title="Continue" disabled={regions.length === 0} onPress={() => setStep(1)} />
        </Animated.View>
      )}

      {step === 1 && (
        <Animated.View entering={enter}>
          <T v="h2">{tr('pain.intensity')}</T>
          <Gap h={20} />
          <Card glass>
            <PainScale value={intensity} onChange={setIntensity} />
          </Card>
          <Gap h={20} />
          <Row style={{ gap: 10 }}>
            <Button kind="ghost" title="Previous" onPress={() => setStep(0)} style={{ flex: 1 }} />
            <Button title="Continue" disabled={intensity === null} onPress={() => setStep(2)} style={{ flex: 2 }} />
          </Row>
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View entering={enter}>
          <T v="h2">A few optional details</T>
          <T v="small" muted style={{ marginTop: 4 }}>
            Skip anything you like. These help your Pain Passport and safety checks.
          </T>
          <Q title="What does it feel like?">
            <ChipGroup multi options={(Object.keys(QUALITY_LABEL) as PainQuality[]).map((q) => ({ value: q, label: QUALITY_LABEL[q] }))} value={qualities} onChange={(v) => setQualities(v as PainQuality[])} />
          </Q>
          <Q title="When did it start?">
            <ChipGroup options={(Object.keys(ONSET_LABEL) as PainOnset[]).map((q) => ({ value: q, label: ONSET_LABEL[q] }))} value={onset} onChange={(v) => setOnset(v as PainOnset)} />
          </Q>
          <Q title="Is it constant or does it come and go?">
            <ChipGroup options={(Object.keys(PATTERN_LABEL) as PainPattern[]).map((q) => ({ value: q, label: PATTERN_LABEL[q] }))} value={pattern} onChange={(v) => setPattern(v as PainPattern)} />
          </Q>
          <Q title="Is it affecting your daily activities?">
            <ChipGroup options={(Object.keys(IMPACT_LABEL) as DailyImpact[]).map((q) => ({ value: q, label: IMPACT_LABEL[q] }))} value={impact} onChange={(v) => setImpact(v as DailyImpact)} />
          </Q>
          <Q title="Any other symptoms?">
            <ChipGroup
              multi
              options={[
                { value: 'nausea', label: 'Nausea' },
                { value: 'diarrhea', label: 'Diarrhoea' },
                { value: 'headache', label: 'Headache' },
                { value: 'dizziness', label: 'Dizziness' },
                { value: 'fainting', label: 'Fainted' },
                { value: 'fever', label: 'Fever' },
                { value: 'fatigue', label: 'Tiredness' },
              ]}
              value={other}
              onChange={(v) => setOther(v as Symptom[])}
            />
          </Q>
          <Card glass style={{ marginTop: 16 }}>
            <Toggle label="Very heavy bleeding" detail="Soaking a pad or tampon every hour or less" value={heavy} onChange={setHeavy} />
            <Gap h={6} />
            <T v="label">Could you be pregnant? (optional)</T>
            <T v="small" muted style={{ marginBottom: 8 }}>
              Only used to check whether this pain needs urgent care. Never stored.
            </T>
            <ChipGroup
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Possibly' },
                { value: 'unsure', label: 'Not sure' },
              ]}
              value={pregnancy}
              onChange={(v) => setPregnancy(v as 'yes' | 'no' | 'unsure')}
            />
          </Card>
          <Q title="Notes">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder={L('Anything else worth remembering')}
              placeholderTextColor={t.textSoft}
              accessibilityLabel="Pain notes"
              style={{ minHeight: 80, borderRadius: 18, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceGlass, padding: 14, color: t.text, fontFamily: fonts.sans, fontSize: 15, textAlignVertical: 'top' }}
            />
          </Q>
          {other.includes('fainting') && (
            <>
              <Gap h={14} />
              <Notice tone="danger" title="Fainting needs medical attention">
                Please contact a doctor or emergency services (999) now, especially if you are bleeding heavily or in severe pain.
              </Notice>
            </>
          )}
          <Gap h={20} />
          <Row style={{ gap: 10 }}>
            <Button kind="ghost" title="Previous" onPress={() => setStep(1)} style={{ flex: 1 }} />
            <Button title="Save & see comfort ideas" onPress={save} style={{ flex: 2 }} />
          </Row>
        </Animated.View>
      )}
      <View style={{ height: 30 }} />
    </Screen>
  );
}

function Q({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <T v="h3" style={{ marginBottom: 8 }}>
        {title}
      </T>
      {children}
    </View>
  );
}
