import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button, Card, Gap, IconButton, Notice, Pill, Row, Screen, T, tap } from '../../components/ui';
import { PetalCompass } from '../../components/PetalCompass';
import { MoodFace, MoodPicker } from '../../components/Mood';
import { useApp } from '../../store/app';
import { useCycle, useInsights, useToday, useTodayEntries } from '../../store/derived';
import { PHASE_COPY } from '../../engines/cycle';
import { comfortOfTheDay, recommendMeals, suggestCareMode } from '../../engines/personalization';
import { useT } from '../../i18n';
import { useMotionOff, useTheme } from '../../theme/useTheme';
import { formatRange, uid } from '../../lib/dates';
import type { Mood } from '../../data/types';
import { REGION_LABEL } from '../../components/BodyMap';
import { modeLabel } from '../../lib/labels';

const HEAVY_MOODS: Mood[] = ['exhausted', 'overwhelmed', 'sad', 'anxious', 'irritated'];

function greetingKey(h: number) {
  return h < 12 ? 'greet.morning' : h < 17 ? 'greet.afternoon' : 'greet.evening';
}

export default function Home() {
  const t = useTheme();
  const tr = useT();
  const motionOff = useMotionOff();
  const profile = useApp((s) => s.profile);
  const settings = useApp((s) => s.settings);
  const favorites = useApp((s) => s.favorites);
  const { status } = useCycle();
  const { visible: insights } = useInsights();
  const today = useToday();
  const { mood: todayMood, pain: todayPain, log } = useTodayEntries();
  const [justSaved, setJustSaved] = useState<Mood | null>(null);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const mode = settings.careMode;

  const copy = PHASE_COPY[status.phase];
  const comfort = comfortOfTheDay(status.phase, todayMood?.mood ?? null);
  const meal = useMemo(
    () =>
      recommendMeals({
        profile,
        symptoms: log?.symptoms ?? [],
        bleeding: status.phase === 'menstrual',
        energy: log?.energy ?? null,
        appetite: null,
        favorites: favorites.map((f) => f.id),
        phase: status.phase,
      })[0],
    [profile, log, status.phase, favorites],
  );
  const suggestion = dismissedSuggestion ? null : suggestCareMode(todayPain?.intensity ?? null, todayMood?.mood ?? null, mode);

  const saveMood = async (m: Mood) => {
    await useApp.getState().addMood({
      id: uid('mood'),
      date: today,
      createdAt: new Date().toISOString(),
      mood: m,
      intensity: 3,
      tags: [],
      text: '',
      confirmedThemes: [],
    });
    tap('success');
    setJustSaved(m);
  };

  const hour = new Date().getHours();
  const greet = `${tr(greetingKey(hour))}, ${profile.name || tr('greet.soul')}`;
  const enter = (d: number) => (motionOff ? undefined : FadeInDown.delay(d).duration(500));
  const quiet = mode === 'quiet';
  const comfortMode = mode === 'comfort';

  return (
    <View style={{ flex: 1 }}>
      <Screen back={false} calm={quiet} contentStyle={{ paddingBottom: 190 }}>
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <T v="eyebrow" soft>
              {modeLabel(mode)}
            </T>
            <T v="h1" accessibilityRole="header" style={{ marginTop: 4 }}>
              {greet}
            </T>
          </View>
          <IconButton label="Profile and settings" onPress={() => router.push('/settings')}>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Circle cx={12} cy={8} r={4} stroke={t.text} strokeWidth={1.8} fill="none" />
              <Path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke={t.text} strokeWidth={1.8} fill="none" strokeLinecap="round" />
            </Svg>
          </IconButton>
        </Row>

        {suggestion && (
          <Animated.View entering={enter(100)} style={{ marginTop: 14 }}>
            <Notice tone="calm" title={`Try ${modeLabel(suggestion.mode)}?`}>
              <T v="small">{suggestion.reason}</T>
              <Row style={{ gap: 8, marginTop: 10 }}>
                <Button small title="Switch" onPress={() => useApp.getState().updateSettings({ careMode: suggestion.mode })} />
                <Button small kind="ghost" title="Not now" onPress={() => setDismissedSuggestion(true)} />
              </Row>
            </Notice>
          </Animated.View>
        )}

        {comfortMode && (
          <Animated.View entering={enter(120)} style={{ marginTop: 14, gap: 10 }}>
            <Card tint={t.blush} onPress={() => router.push('/pain/log')} accessibilityLabel="Log pain on the body map">
              <T v="h3">Where does it hurt?</T>
              <T v="small" muted>Open the body map and get comfort ideas</T>
            </Card>
            <Notice tone="warn" title="When to get care" action="See care guidance" onAction={() => router.push('/support')}>
              Sudden severe pain, fainting, or soaking a pad every hour needs urgent medical care. Call 999 in an emergency.
            </Notice>
          </Animated.View>
        )}

        <Animated.View entering={motionOff ? undefined : FadeIn.duration(900)} style={{ marginTop: 18 }}>
          <Card glass style={{ paddingVertical: 22 }}>
            <PetalCompass status={status} size={quiet ? 240 : 290} />
            <Gap h={14} />
            <T v="h2" center>
              {copy.line}
            </T>
            {!quiet && (
              <T v="body" muted center style={{ marginTop: 6 }}>
                {status.phaseLimited && status.limitReason && status.phase === 'unknown' ? status.limitReason : copy.detail}
              </T>
            )}
            <Row style={{ justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {status.prediction && (
                <Pill>
                  Next period · {formatRange(status.prediction.nextStartEarliest, status.prediction.nextStartLatest)}
                </Pill>
              )}
              <Pill color={confidenceColor(status.confidence, t)}>
                {status.confidence === 'insufficient' ? 'Still learning' : `${cap(status.confidence)} confidence`}
              </Pill>
            </Row>
            <Row style={{ justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <Button small kind="soft" title={status.phase === 'menstrual' ? 'Log today’s flow' : 'Period started?'} onPress={() => router.push(`/day/${today}`)} />
              <Button small kind="ghost" title="How is this estimated?" onPress={() => router.push('/(tabs)/cycle')} />
            </Row>
          </Card>
        </Animated.View>

        <Animated.View entering={enter(200)}>
          <Card style={{ marginTop: 16 }}>
            <T v="h2" accessibilityRole="header">
              {tr('home.heart')}
            </T>
            <Gap h={12} />
            {justSaved || todayMood ? (
              <Row style={{ gap: 12 }}>
                <MoodFace mood={(justSaved ?? todayMood?.mood) as Mood} size={52} />
                <View style={{ flex: 1 }}>
                  <T v="bodyMedium">Thank you for checking in 🌸</T>
                  <T v="small" muted>
                    Noticing how you feel is a form of care.
                  </T>
                </View>
              </Row>
            ) : (
              <MoodPicker value={null} onChange={saveMood} compact />
            )}
            {(justSaved || todayMood) && (
              <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {HEAVY_MOODS.includes((justSaved ?? todayMood?.mood) as Mood) && (
                  <Button small title="A gentle plan for today" onPress={() => router.push({ pathname: '/checkin', params: { mood: justSaved ?? todayMood?.mood } })} />
                )}
                <Button small kind="soft" title="Reflect in Mood Mirror" onPress={() => router.push('/mood')} />
                <Button small kind="ghost" title="Log another" onPress={() => setJustSaved(null)} />
              </Row>
            )}
          </Card>
        </Animated.View>

        {!quiet && (
          <Animated.View entering={enter(260)}>
            <Card style={{ marginTop: 14 }} tint={t.lavender} onPress={() => router.push('/checkin')} accessibilityLabel="One Minute for Me, a daily check-in">
              <Row>
                <View style={{ flex: 1 }}>
                  <T v="eyebrow" soft>
                    Daily ritual
                  </T>
                  <T v="h2">{tr('home.ritual')}</T>
                  <T v="small" muted style={{ marginTop: 2 }}>
                    {log?.need ? 'Your gentle plan is ready. Tap to revisit.' : 'Three gentle questions, then a plan just for today.'}
                  </T>
                </View>
                <T style={{ fontSize: 34 }}>⏱️</T>
              </Row>
            </Card>
          </Animated.View>
        )}

        <View style={{ gap: 12, marginTop: 14 }}>
          {!comfortMode && (
            <Animated.View entering={enter(320)}>
              <Card onPress={() => router.push('/pain/log')} accessibilityLabel="My Body. Any pain or discomfort today?">
                <T v="eyebrow" soft>
                  {tr('home.body.title')}
                </T>
                <T v="h3" style={{ marginTop: 4 }}>
                  {tr('home.body.q')}
                </T>
                <T v="small" muted style={{ marginTop: 4 }}>
                  {todayPain
                    ? `Logged ${todayPain.intensity}/10 · ${todayPain.regions.map((r) => REGION_LABEL[r]).join(', ')}`
                    : 'Tap the body map to show where it hurts.'}
                </T>
              </Card>
            </Animated.View>
          )}
          <Animated.View entering={enter(380)}>
            <Card tint={t.dark ? t.sage : '#EEF5EE'} onPress={() => (comfort.id === 'breathing' ? router.push('/breathe') : router.push('/(tabs)/care'))} accessibilityLabel={`My Comfort. ${comfort.title}`}>
              <T v="eyebrow" soft>
                {tr('home.comfort.title')}
              </T>
              <T v="small" muted style={{ marginTop: 2 }}>
                {tr('home.comfort.q')}
              </T>
              <Row style={{ marginTop: 8, gap: 10 }}>
                <T style={{ fontSize: 26 }}>{comfort.icon}</T>
                <View style={{ flex: 1 }}>
                  <T v="h3">{comfort.title}</T>
                  <T v="small" muted>
                    {comfort.detail}
                  </T>
                </View>
              </Row>
            </Card>
          </Animated.View>
          {!quiet && meal && (
            <Animated.View entering={enter(440)}>
              <Card tint={t.dark ? t.peach : '#FFF0E8'} onPress={() => router.push('/nourish')} accessibilityLabel={`My Nourishment. ${meal.meal.name}`}>
                <T v="eyebrow" soft>
                  {tr('home.nourish.title')}
                </T>
                <T v="small" muted style={{ marginTop: 2 }}>
                  {tr('home.nourish.q')}
                </T>
                <Row style={{ marginTop: 8, gap: 10 }}>
                  <T style={{ fontSize: 30 }}>{meal.meal.emoji}</T>
                  <View style={{ flex: 1 }}>
                    <T v="h3">{meal.meal.name}</T>
                    <T v="small" muted>
                      {meal.reason} · {meal.meal.minutes} min
                    </T>
                  </View>
                </Row>
              </Card>
            </Animated.View>
          )}
          {mode === 'reflection' && insights[0] && (
            <Card tint={t.blush} onPress={() => router.push('/(tabs)/insights')}>
              <T v="eyebrow" soft>
                From your Pattern Garden
              </T>
              <T v="h3" style={{ marginTop: 4 }}>
                {insights[0].title}
              </T>
              <T v="small" muted>
                {insights[0].body}
              </T>
            </Card>
          )}
          {quiet && (
            <Card onPress={() => router.push('/breathe')} accessibilityLabel="Breathe with me">
              <T v="h3">Breathe with me</T>
              <T v="small" muted>A quiet minute, nothing to fill in.</T>
            </Card>
          )}
        </View>
      </Screen>
      <AskPetal />
    </View>
  );
}

function AskPetal() {
  const t = useTheme();
  const tr = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tr('home.askPetal')}, your AI companion`}
      onPress={() => {
        tap();
        router.push('/(tabs)/petal');
      }}
      style={({ pressed }) => [styles.fab, { backgroundColor: t.accent, shadowColor: t.shadow }, pressed && { transform: [{ scale: 0.96 }] }]}
    >
      <T style={{ fontSize: 16 }} color={t.accentText}>✿</T>
      <T v="label" color={t.accentText}>
        {tr('home.askPetal')}
      </T>
    </Pressable>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function confidenceColor(c: string, t: ReturnType<typeof useTheme>) {
  return c === 'high' ? t.sage : c === 'medium' ? t.peach : t.lavender;
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 50,
    borderRadius: 25,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 8,
  },
});
