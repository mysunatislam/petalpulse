import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Button, Card, ChipGroup, Gap, Row, Screen, T, tap } from '../components/ui';
import { MOODS, MoodPicker } from '../components/Mood';
import { PetalBloom } from '../components/PetalCompass';
import { useApp } from '../store/app';
import { useCycle, useToday, useTodayEntries } from '../store/derived';
import { gentlePlan } from '../engines/personalization';
import { useT } from '../i18n';
import { useMotionOff, useTheme } from '../theme/useTheme';
import type { DayLog, Mood, Symptom } from '../data/types';
import { uid } from '../lib/dates';

const BODY = [
  { value: '1', label: 'Rough', icon: '🥀' },
  { value: '2', label: 'Uncomfortable', icon: '🌧️' },
  { value: '3', label: 'Okay', icon: '🌤️' },
  { value: '4', label: 'Good', icon: '🌸' },
  { value: '5', label: 'Great', icon: '🌞' },
];

const NEEDS: { value: NonNullable<DayLog['need']>; label: string; icon: string }[] = [
  { value: 'rest', label: 'Rest', icon: '☁️' },
  { value: 'nourish', label: 'Nourishment', icon: '🍲' },
  { value: 'connection', label: 'Connection', icon: '🤍' },
  { value: 'movement', label: 'Movement', icon: '🌿' },
  { value: 'quiet', label: 'Quiet', icon: '🕯️' },
  { value: 'focus', label: 'Focus', icon: '📚' },
];

export default function CheckIn() {
  const t = useTheme();
  const tr = useT();
  const motionOff = useMotionOff();
  const today = useToday();
  const { status } = useCycle();
  const { pain, log } = useTodayEntries();
  // Home passes the mood that was just logged, so it isn't asked (or saved) twice.
  const params = useLocalSearchParams<{ mood?: string }>();
  const preset = MOODS.find((m) => m === params.mood) ?? null;
  const [step, setStep] = useState(preset ? 1 : 0);
  const [mood, setMood] = useState<Mood | null>(preset);
  const [body, setBody] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<Symptom[]>(log?.symptoms ?? []);
  const [need, setNeed] = useState<DayLog['need']>(null);
  const [plan, setPlan] = useState<string[] | null>(null);
  const [checked, setChecked] = useState<number[]>([]);

  const finish = async () => {
    if (mood && mood !== preset) {
      await useApp.getState().addMood({ id: uid('mood'), date: today, createdAt: new Date().toISOString(), mood, intensity: 3, tags: [], text: '', confirmedThemes: [] });
    }
    await useApp.getState().saveDayLog({ date: today, need, symptoms, energy: body ? Number(body) : log?.energy ?? null });
    setPlan(gentlePlan({ mood, bodyScore: body ? Number(body) : null, need, painIntensity: pain?.intensity ?? null, phase: status.phase }));
    tap('success');
  };

  const enter = motionOff ? undefined : FadeInRight.duration(320);

  if (plan) {
    return (
      <Screen title={tr('checkin.plan')} eyebrow="One Minute for Me">
        <Animated.View entering={motionOff ? undefined : FadeInDown.duration(600)}>
          <Card tint={t.lavender} style={{ alignItems: 'center' }}>
            <PetalBloom phase={status.phase} size={120} />
            <T v="serifItalic" center style={{ marginTop: 6 }}>
              You showed up for yourself today. That counts.
            </T>
          </Card>
          <Gap h={14} />
          <Card>
            {plan.map((p, i) => {
              const on = checked.includes(i);
              return (
                <Row key={i} style={{ paddingVertical: 10, gap: 12 }}>
                  <Button
                    small
                    kind={on ? 'primary' : 'secondary'}
                    title={on ? '✓' : ' '}
                    onPress={() => setChecked(on ? checked.filter((x) => x !== i) : [...checked, i])}
                    style={{ width: 44, paddingHorizontal: 0 }}
                    accessibilityHint={`Mark "${p}" as done`}
                  />
                  <T v="body" style={{ flex: 1, textDecorationLine: on ? 'line-through' : 'none', opacity: on ? 0.6 : 1 }}>
                    {p}
                  </T>
                </Row>
              );
            })}
            <T v="small" muted style={{ marginTop: 6 }}>
              Optional and flexible. Change anything that doesn’t fit your day.
            </T>
          </Card>
          <Gap h={16} />
          <Button title={tr('common.done')} onPress={() => router.back()} />
          <Gap h={8} />
          <Button kind="ghost" title="Talk it through with Petal" onPress={() => router.replace('/(tabs)/petal')} />
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen title="One Minute for Me" eyebrow={`${step + 1} of 3`}>
      {step === 0 && (
        <Animated.View entering={enter}>
          <T v="h2">{tr('checkin.feel')}</T>
          <Gap h={14} />
          <MoodPicker value={mood} onChange={setMood} />
          <Gap h={20} />
          <Button title={tr('common.continue')} onPress={() => setStep(1)} />
        </Animated.View>
      )}
      {step === 1 && (
        <Animated.View entering={enter}>
          <T v="h2">{tr('checkin.body')}</T>
          <Gap h={14} />
          <ChipGroup options={BODY} value={body} onChange={(v) => setBody(v as string)} />
          <Gap h={18} />
          <T v="label" muted>
            Anything you notice? (optional)
          </T>
          <Gap h={8} />
          <ChipGroup
            multi
            options={[
              { value: 'cramps', label: 'Cramps' },
              { value: 'bloating', label: 'Bloating' },
              { value: 'headache', label: 'Headache' },
              { value: 'fatigue', label: 'Tired' },
              { value: 'tender_breasts', label: 'Tender breasts' },
              { value: 'nausea', label: 'Nausea' },
            ]}
            value={symptoms}
            onChange={(v) => setSymptoms(v as Symptom[])}
          />
          <Gap h={20} />
          <Row style={{ gap: 10 }}>
            <Button kind="ghost" title="Previous" onPress={() => setStep(0)} style={{ flex: 1 }} />
            <Button title={tr('common.continue')} onPress={() => setStep(2)} style={{ flex: 2 }} />
          </Row>
        </Animated.View>
      )}
      {step === 2 && (
        <Animated.View entering={enter}>
          <T v="h2">{tr('checkin.need')}</T>
          <Gap h={14} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {NEEDS.map((n) => (
              <Card
                key={n.value}
                onPress={() => setNeed(n.value)}
                accessibilityLabel={n.label}
                tint={need === n.value ? t.blush : undefined}
                style={{ width: '47%', alignItems: 'center', paddingVertical: 16, borderColor: need === n.value ? t.primary : t.border, borderWidth: need === n.value ? 2 : 1 }}
              >
                <T style={{ fontSize: 26 }}>{n.icon}</T>
                <T v="bodyMedium" style={{ marginTop: 4 }}>
                  {n.label}
                </T>
              </Card>
            ))}
          </View>
          <Gap h={20} />
          <Row style={{ gap: 10 }}>
            <Button kind="ghost" title="Previous" onPress={() => setStep(1)} style={{ flex: 1 }} />
            <Button title="Make my gentle plan" onPress={finish} style={{ flex: 2 }} />
          </Row>
        </Animated.View>
      )}
    </Screen>
  );
}
