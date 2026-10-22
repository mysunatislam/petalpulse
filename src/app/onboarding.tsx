import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Button, Card, ChipGroup, Gap, Notice, Row, Segmented, Stepper, T, Toggle, tap } from '../components/ui';
import { MonthCalendar } from '../components/Calendar';
import { PetalBloom } from '../components/PetalCompass';
import { useApp } from '../store/app';
import { useT } from '../i18n';
import { useMotionOff, useTheme } from '../theme/useTheme';
import { addDays, formatLong, todayISO } from '../lib/dates';
import type { Allergy, DietPref, Goal, NotificationStyle, PredictionCaveat, Profile, Regularity, Symptom } from '../data/types';
import { fonts } from '../theme/tokens';
import { isMinor } from '../engines/privacy';

const GOALS: { value: Goal; label: string; icon: string }[] = [
  { value: 'cycle', label: 'Understand my cycle', icon: '🌙' },
  { value: 'pain', label: 'Manage period pain', icon: '🤍' },
  { value: 'moods', label: 'Understand my moods', icon: '🌷' },
  { value: 'selfcare', label: 'Improve my self-care', icon: '🫖' },
  { value: 'irregular', label: 'Track irregular periods', icon: '🌀' },
  { value: 'everything', label: 'A little of everything', icon: '✿' },
];

const SYMPTOMS: { value: Symptom; label: string }[] = [
  { value: 'cramps', label: 'Cramps' },
  { value: 'bloating', label: 'Bloating' },
  { value: 'headache', label: 'Headaches' },
  { value: 'fatigue', label: 'Tiredness' },
  { value: 'tender_breasts', label: 'Tender breasts' },
  { value: 'back_pain', label: 'Back pain' },
  { value: 'acne', label: 'Skin changes' },
  { value: 'nausea', label: 'Nausea' },
  { value: 'cravings', label: 'Cravings' },
  { value: 'insomnia', label: 'Trouble sleeping' },
];

const CAVEATS: { value: PredictionCaveat; label: string }[] = [
  { value: 'hormonal_contraception', label: 'Hormonal contraception' },
  { value: 'recent_stop_contraception', label: 'Recently stopped contraception' },
  { value: 'postpartum', label: 'Recently gave birth' },
  { value: 'breastfeeding', label: 'Breastfeeding' },
  { value: 'pcos', label: 'PCOS' },
  { value: 'perimenopause', label: 'Perimenopause' },
];

const STEPS = ['hello', 'goal', 'about', 'period', 'rhythm', 'body', 'food', 'prefs', 'bloom'] as const;

export default function Onboarding() {
  const t = useTheme();
  const tr = useT();
  const motionOff = useMotionOff();
  const settings = useApp((s) => s.settings);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(useApp.getState().profile);
  const [lpUnsure, setLpUnsure] = useState(false);
  const [notif, setNotif] = useState<NotificationStyle>(settings.notificationStyle);
  const today = todayISO();
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const key = STEPS[step];

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = async () => {
    await useApp.getState().updateProfile({ ...p, onboardedAt: new Date().toISOString(), isDemo: false });
    await useApp.getState().updateSettings({ notificationStyle: notif });
    tap('success');
    router.replace('/(tabs)');
  };

  const enter = motionOff ? undefined : FadeInRight.duration(380);

  return (
    <LinearGradient colors={t.gradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {key !== 'bloom' && (
          <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${STEPS.length - 1}`}>
            {STEPS.slice(0, -1).map((_, i) => (
              <View key={i} style={[styles.bar, { backgroundColor: i <= step ? t.primary : t.border }]} />
            ))}
          </View>
        )}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Animated.View key={key} entering={enter}>
              {key === 'hello' && (
                <View style={{ paddingTop: 30 }}>
                  <PetalBloom phase="follicular" size={120} />
                  <Gap h={18} />
                  <T v="h1" accessibilityRole="header">{tr('onb.hi')}</T>
                  <Gap h={14} />
                  <T v="serifItalic" muted>{tr('onb.pace')}</T>
                  <Gap h={28} />
                  <T v="label" muted>Language · ভাষা</T>
                  <Gap h={8} />
                  <Segmented
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'bn', label: 'বাংলা' },
                    ]}
                    value={settings.language}
                    onChange={(v) => useApp.getState().updateSettings({ language: v })}
                  />
                  <Gap h={12} />
                  <T v="small" muted>
                    Takes about a minute. Every question is optional, and you can change answers later.
                  </T>
                </View>
              )}

              {key === 'goal' && (
                <View>
                  <T v="h1" accessibilityRole="header">What would you like help with first?</T>
                  <Gap h={18} />
                  <View style={{ gap: 10 }}>
                    {GOALS.map((g) => (
                      <Card
                        key={g.value}
                        glass
                        onPress={() => set({ goal: g.value })}
                        accessibilityLabel={g.label}
                        style={[styles.goal, p.goal === g.value && { borderColor: t.primary, borderWidth: 2, backgroundColor: t.blush }]}
                      >
                        <Row>
                          <T style={{ fontSize: 22, marginRight: 14 }}>{g.icon}</T>
                          <T v="bodyMedium">{g.label}</T>
                        </Row>
                      </Card>
                    ))}
                  </View>
                </View>
              )}

              {key === 'about' && (
                <View>
                  <T v="h1" accessibilityRole="header">What should we call you?</T>
                  <Gap h={14} />
                  <TextInput
                    value={p.name}
                    onChangeText={(name) => set({ name: name.slice(0, 40) })}
                    placeholder="Your preferred name (optional)"
                    placeholderTextColor={t.textSoft}
                    accessibilityLabel="Preferred name"
                    style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.surfaceGlass, fontFamily: fonts.sans }]}
                  />
                  <Gap h={22} />
                  <T v="h3">Age range</T>
                  <Gap h={8} />
                  <ChipGroup
                    options={[
                      { value: 'under_16', label: 'Under 16' },
                      { value: '16_17', label: '16–17' },
                      { value: '18_24', label: '18–24' },
                      { value: '25_34', label: '25–34' },
                      { value: '35_44', label: '35–44' },
                      { value: '45_plus', label: '45+' },
                      { value: 'unsure', label: 'Prefer not to say' },
                    ]}
                    value={p.ageRange}
                    onChange={(v) => set({ ageRange: v as Profile['ageRange'] })}
                  />
                  {isMinor(p.ageRange) && (
                    <>
                      <Gap h={14} />
                      <Notice tone="calm" title="Extra care for younger users">
                        Cloud AI stays off by default and your data never leaves this phone unless you choose otherwise. Talking with a trusted adult or school nurse about periods can really help too.
                      </Notice>
                    </>
                  )}
                </View>
              )}

              {key === 'period' && (
                <View>
                  <T v="h1" accessibilityRole="header">When did your last period start?</T>
                  <T v="body" muted style={{ marginTop: 6 }}>
                    An approximate date is fine.
                  </T>
                  <Gap h={14} />
                  <Card glass>
                    <MonthCalendar
                      selected={p.lastPeriodStart}
                      maxDate={today}
                      minDate={addDays(today, -120)}
                      onSelect={(d) => {
                        setLpUnsure(false);
                        set({ lastPeriodStart: d });
                      }}
                    />
                  </Card>
                  <Gap h={10} />
                  <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                    <ChipGroup
                      options={[{ value: 'unsure', label: tr('common.notSure') }]}
                      value={lpUnsure ? 'unsure' : null}
                      onChange={() => {
                        setLpUnsure(true);
                        set({ lastPeriodStart: null });
                      }}
                    />
                  </Row>
                  {p.lastPeriodStart && (
                    <T v="small" muted style={{ marginTop: 10 }}>
                      Selected: {formatLong(p.lastPeriodStart)}
                    </T>
                  )}
                </View>
              )}

              {key === 'rhythm' && (
                <View>
                  <T v="h1" accessibilityRole="header">Your usual rhythm</T>
                  <T v="body" muted style={{ marginTop: 6 }}>
                    If you don’t know, that’s completely fine. We’ll learn together.
                  </T>
                  <Gap h={20} />
                  <T v="h3">Typical cycle length</T>
                  <Gap h={8} />
                  <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <Stepper label="Cycle length in days" value={p.typicalCycleLength} min={15} max={60} format={(v) => `${v} days`} onChange={(v) => set({ typicalCycleLength: v })} />
                    <ChipGroup options={[{ value: 'unsure', label: tr('common.notSure') }]} value={p.typicalCycleLength === null ? 'unsure' : null} onChange={() => set({ typicalCycleLength: null })} />
                  </Row>
                  <Gap h={20} />
                  <T v="h3">Typical bleeding days</T>
                  <Gap h={8} />
                  <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <Stepper label="Bleeding days" value={p.typicalPeriodLength} min={1} max={10} format={(v) => `${v} days`} onChange={(v) => set({ typicalPeriodLength: v })} />
                    <ChipGroup options={[{ value: 'unsure', label: tr('common.notSure') }]} value={p.typicalPeriodLength === null ? 'unsure' : null} onChange={() => set({ typicalPeriodLength: null })} />
                  </Row>
                  <Gap h={20} />
                  <T v="h3">How regular are your cycles?</T>
                  <Gap h={8} />
                  <ChipGroup
                    options={[
                      { value: 'regular', label: 'Pretty regular' },
                      { value: 'somewhat', label: 'Somewhat' },
                      { value: 'irregular', label: 'Irregular' },
                      { value: 'unsure', label: tr('common.notSure') },
                    ]}
                    value={p.regularity}
                    onChange={(v) => set({ regularity: v as Regularity })}
                  />
                </View>
              )}

              {key === 'body' && (
                <View>
                  <T v="h1" accessibilityRole="header">What do you often notice?</T>
                  <Gap h={14} />
                  <ChipGroup multi options={SYMPTOMS} value={p.commonSymptoms} onChange={(v) => set({ commonSymptoms: v as Symptom[] })} />
                  <Gap h={26} />
                  <T v="h3">Anything that affects your cycle? (optional)</T>
                  <T v="small" muted style={{ marginTop: 4 }}>
                    This helps us avoid misleading estimates. Shared only with you.
                  </T>
                  <Gap h={10} />
                  <ChipGroup multi options={CAVEATS} value={p.caveats} onChange={(v) => set({ caveats: v as PredictionCaveat[] })} />
                </View>
              )}

              {key === 'food' && (
                <View>
                  <T v="h1" accessibilityRole="header">Food that feels like you</T>
                  <Gap h={16} />
                  <T v="h3">Eating style</T>
                  <Gap h={8} />
                  <ChipGroup
                    options={[
                      { value: 'none', label: 'No preference' },
                      { value: 'halal', label: 'Halal' },
                      { value: 'vegetarian', label: 'Vegetarian' },
                      { value: 'vegan', label: 'Vegan' },
                      { value: 'pescatarian', label: 'Pescatarian' },
                    ]}
                    value={p.diet}
                    onChange={(v) => set({ diet: v as DietPref })}
                  />
                  <Gap h={18} />
                  <T v="h3">Allergies or foods to avoid</T>
                  <Gap h={8} />
                  <ChipGroup
                    multi
                    options={[
                      { value: 'nuts', label: 'Nuts' },
                      { value: 'dairy', label: 'Dairy' },
                      { value: 'eggs', label: 'Eggs' },
                      { value: 'gluten', label: 'Gluten' },
                      { value: 'fish', label: 'Fish' },
                      { value: 'soy', label: 'Soy' },
                    ]}
                    value={p.allergies}
                    onChange={(v) => set({ allergies: v as Allergy[] })}
                  />
                  <Gap h={18} />
                  <T v="h3">Meal ideas from</T>
                  <Gap h={8} />
                  <ChipGroup
                    options={[
                      { value: 'bangladeshi', label: 'Bangladeshi kitchen' },
                      { value: 'international', label: 'International' },
                      { value: 'both', label: 'Both' },
                    ]}
                    value={p.foodRegion}
                    onChange={(v) => set({ foodRegion: v as Profile['foodRegion'] })}
                  />
                </View>
              )}

              {key === 'prefs' && (
                <View>
                  <T v="h1" accessibilityRole="header">Gentle reminders, your way</T>
                  <Gap h={14} />
                  <ChipGroup
                    options={[
                      { value: 'discreet', label: 'Fully discreet' },
                      { value: 'gentle', label: 'Gentle & warm' },
                      { value: 'minimal', label: 'Minimal' },
                      { value: 'none', label: 'No notifications' },
                    ]}
                    value={notif}
                    onChange={(v) => setNotif(v as NotificationStyle)}
                  />
                  <T v="small" muted style={{ marginTop: 8 }}>
                    Discreet reminders never mention periods, pain or moods on your lock screen.
                  </T>
                  <Gap h={22} />
                  <Card glass>
                    <T v="h3">Your privacy, simply</T>
                    <Gap h={6} />
                    <T v="small" muted>
                      • Guest mode: no account, no email.{'\n'}• Your records are stored on this phone, encrypted.{'\n'}• Petal AI runs on your phone unless you choose cloud AI in settings.{'\n'}• We never sell health data or use ad trackers.
                    </T>
                    <Toggle label="Reduce motion" detail="Calmer screens with fewer animations" value={settings.reduceMotion} onChange={(v) => useApp.getState().updateSettings({ reduceMotion: v })} />
                  </Card>
                </View>
              )}

              {key === 'bloom' && <Finale name={p.name} onDone={finish} />}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
        {key !== 'bloom' && (
          <Row style={styles.footer}>
            {step > 0 ? <Button kind="ghost" title="Back" onPress={back} small /> : <View />}
            <Row style={{ gap: 8 }}>
              {step > 0 && step < STEPS.length - 2 && <Button kind="ghost" title={tr('common.skip')} onPress={next} small />}
              <Button title={step === 0 ? 'Let’s begin' : tr('common.continue')} onPress={next} small style={{ paddingHorizontal: 26 }} />
            </Row>
          </Row>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Finale({ name, onDone }: { name: string; onDone: () => void }) {
  const tr = useT();
  const motionOff = useMotionOff();
  const s = useSharedValue(motionOff ? 1 : 0.1);
  useEffect(() => {
    tap('success');
    if (!motionOff) s.value = withSpring(1, { damping: 9, stiffness: 50 });
  }, [motionOff, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={{ alignItems: 'center', paddingTop: 50 }}>
      <Animated.View style={style}>
        <PetalBloom phase="ovulatory" size={240} />
      </Animated.View>
      <Animated.View entering={motionOff ? undefined : FadeInDown.delay(700).duration(700)} style={{ alignItems: 'center' }}>
        {name ? (
          <T v="eyebrow" soft style={{ marginTop: 20 }}>
            For you, {name}
          </T>
        ) : null}
        <T v="h1" center style={{ marginTop: 10 }} accessibilityRole="header">
          {tr('onb.story')}
        </T>
      </Animated.View>
      <Animated.View entering={motionOff ? undefined : FadeIn.delay(1400)} style={{ width: '100%', marginTop: 36 }}>
        <Button title="Open my space" onPress={onDone} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 40 },
  progress: { flexDirection: 'row', gap: 5, paddingHorizontal: 22, paddingTop: 10 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  goal: { paddingVertical: 16, borderWidth: 1 },
  input: { minHeight: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, fontSize: 16 },
  footer: { justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, paddingTop: 8 },
});
