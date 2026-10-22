import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Speech from 'expo-speech';
import { Button, Card, Chip, DemoBanner, Gap, IconButton, Notice, Row, T, tap } from '../../components/ui';
import { PetalBloom } from '../../components/PetalCompass';
import { useApp } from '../../store/app';
import { useCycle, useInsights } from '../../store/derived';
import { AI_DISCLOSURE, buildContext, respond } from '../../engines/conversation';
import { describeSharing } from '../../engines/privacy';
import { uid } from '../../lib/dates';
import { useMotionOff, useTheme } from '../../theme/useTheme';
import { fonts } from '../../theme/tokens';
import type { ChatMessage } from '../../data/types';

const STARTERS = [
  'I don’t know why I’m so irritated today.',
  'My stomach hurts so much.',
  'I have an exam tomorrow and my period just started.',
  'I just want someone to listen.',
];

const ACTIONS: Record<string, string> = {
  'Open the pain map': '/pain/log',
  'See my patterns': '/(tabs)/insights',
  'Open Insights': '/(tabs)/insights',
  'Try a calming activity': '/breathe',
  'Just log how I feel': '/mood',
  'Log mood': '/mood',
  'Show support options': '/support',
  'Show care guidance': '/support',
  'When should I see a doctor?': '/support',
  'Easy meal ideas': '/nourish',
  'Something with no cooking': '/nourish',
  'Make a gentle plan': '/checkin',
  'Yes, make a plan': '/checkin',
  'Comfort ideas': '/(tabs)/care',
};

export default function PetalAI() {
  const t = useTheme();
  const motionOff = useMotionOff();
  const s = useApp();
  const { status } = useCycle();
  const { visible: insights } = useInsights();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [suggestQuiet, setSuggestQuiet] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { settings, chat } = s;

  const ctx = useMemo(
    () =>
      buildContext(settings, {
        name: s.profile.name,
        status,
        moods: s.moods.map((m) => ({ date: m.date, mood: m.mood, tags: m.tags })),
        pain: s.pain.map((p) => ({ date: p.date, intensity: p.intensity, regions: p.regions })),
        sleep: s.dayLogs.slice(-14).filter((l) => l.sleepHours != null).map((l) => l.sleepHours as number),
        insights,
      }),
    [settings, s.profile.name, status, s.moods, s.pain, s.dayLogs, insights],
  );

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: !motionOff }), 50);
  }, [chat.length, motionOff]);

  const send = async (raw: string) => {
    const msg = raw.trim();
    if (!msg || busy) return;
    if (ACTIONS[msg]) {
      router.push(ACTIONS[msg] as never);
      return;
    }
    tap();
    setText('');
    const user: ChatMessage = { id: uid('m'), createdAt: new Date().toISOString(), role: 'user', text: msg };
    await useApp.getState().addChat(user);
    setBusy(true);
    if (/overwhelm/i.test(msg) && settings.careMode !== 'quiet') setSuggestQuiet(true);
    const history = useApp.getState().chat;
    const reply = await respond(msg, history, ctx, { settings });
    // a small pause so replies don't feel mechanical
    await new Promise((r) => setTimeout(r, reply.source === 'device' ? 500 : 0));
    const bot: ChatMessage = { id: uid('m'), createdAt: new Date().toISOString(), role: 'assistant', text: reply.text, safety: reply.safety, suggestions: reply.suggestions };
    await useApp.getState().addChat(bot);
    setBusy(false);
    if (settings.aiSpeak) Speech.speak(reply.text, { language: settings.language === 'bn' ? 'bn-BD' : 'en-US', rate: 0.95 });
  };

  if (!settings.aiEnabled) {
    return (
      <LinearGradient colors={t.gradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
          <PetalBloom phase="unknown" size={130} />
          <T v="h1" center style={{ marginTop: 10 }}>
            Petal AI is off
          </T>
          <T v="body" muted center style={{ marginTop: 8 }}>
            Everything else in the app works without it. You can turn Petal on anytime.
          </T>
          <Gap h={20} />
          <Button title="Turn on Petal AI" onPress={() => s.updateSettings({ aiEnabled: true })} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const last = chat[chat.length - 1];
  const chips = !busy && last?.role === 'assistant' ? last.suggestions ?? [] : [];

  return (
    <LinearGradient colors={t.gradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {s.profile.isDemo && <DemoBanner />}
        <Row style={styles.header}>
          <PetalBloom phase={status.phase} size={44} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <T v="h3">Petal</T>
            <T v="small" muted>
              AI companion · {settings.aiCloudConsent && settings.aiEndpoint ? 'cloud, with your consent' : 'on this phone'}
            </T>
          </View>
          <IconButton label="What Petal can see" onPress={() => setShowInfo(!showInfo)}>
            <T v="h3">i</T>
          </IconButton>
        </Row>
        {showInfo && (
          <View style={{ paddingHorizontal: 18, marginBottom: 6 }}>
            <Card glass>
              <T v="small">{AI_DISCLOSURE}</T>
              <Gap h={8} />
              <T v="label">Shared right now:</T>
              {describeSharing(settings).map((x) => (
                <T key={x} v="small" muted>
                  • {x}
                </T>
              ))}
              <Row style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Button small kind="soft" title="Privacy settings" onPress={() => router.push('/settings')} />
                {chat.length > 0 && <Button small kind="ghost" title="Clear conversation" onPress={() => s.clearChat()} />}
              </Row>
            </Card>
          </View>
        )}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <FlatList
            ref={listRef}
            data={chat}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 18, paddingBottom: 12, flexGrow: 1 }}
            ListHeaderComponent={
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <T v="small" soft center style={{ maxWidth: 300 }}>
                  {AI_DISCLOSURE}
                </T>
              </View>
            }
            ListEmptyComponent={
              <View style={{ marginTop: 10 }}>
                <T v="h2" center>
                  Hi{s.profile.name ? ` ${s.profile.name}` : ''}, I’m here.
                </T>
                <T v="body" muted center style={{ marginTop: 6 }}>
                  Talk to me about your body, your feelings, or your day. You can start anywhere.
                </T>
                <View style={{ gap: 8, marginTop: 18 }}>
                  {STARTERS.map((st) => (
                    <Pressable key={st} onPress={() => send(st)} accessibilityRole="button" style={[styles.starter, { backgroundColor: t.surfaceGlass, borderColor: t.border }]}>
                      <T v="body">{st}</T>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => <Bubble m={item} />}
            ListFooterComponent={
              <>
                {busy && (
                  <View style={[styles.bubble, styles.bot, { backgroundColor: t.surface }]}>
                    <T v="body" muted>
                      Petal is thinking…
                    </T>
                  </View>
                )}
                {suggestQuiet && (
                  <Notice tone="calm" title="Would Quiet Mode help?">
                    <T v="small">It makes the app calmer and simpler. Only if you want to.</T>
                    <Row style={{ gap: 8, marginTop: 8 }}>
                      <Button small title="Switch to Quiet Mode" onPress={() => { s.updateSettings({ careMode: 'quiet' }); setSuggestQuiet(false); }} />
                      <Button small kind="ghost" title="No thanks" onPress={() => setSuggestQuiet(false)} />
                    </Row>
                  </Notice>
                )}
              </>
            }
          />
          {chips.length > 0 && (
            <Row style={{ flexWrap: 'wrap', gap: 8, paddingHorizontal: 18, paddingBottom: 8 }}>
              {chips.map((c) => (
                <Chip key={c} label={c} onPress={() => send(c)} />
              ))}
            </Row>
          )}
          <Row style={[styles.inputRow, { borderColor: t.border, backgroundColor: t.surface }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Tell Petal what’s on your mind…"
              placeholderTextColor={t.textSoft}
              multiline
              accessibilityLabel="Message to Petal"
              style={{ flex: 1, color: t.text, fontFamily: fonts.sans, fontSize: 15.5, maxHeight: 120, paddingVertical: 10 }}
              onSubmitEditing={() => send(text)}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!text.trim() || busy} onPress={() => send(text)} style={[styles.send, { backgroundColor: text.trim() ? t.accent : t.border }]}>
              <T v="h3" color={t.accentText}>
                ↑
              </T>
            </Pressable>
          </Row>
          <View style={{ height: 96 }} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const t = useTheme();
  const motionOff = useMotionOff();
  const mine = m.role === 'user';
  const danger = m.safety === 'crisis' || m.safety === 'urgent';
  return (
    <Animated.View entering={motionOff ? undefined : FadeInUp.duration(300)} style={[styles.bubble, mine ? styles.me : styles.bot, { backgroundColor: mine ? t.accent : danger ? t.dangerBg : t.surface }]}>
      <T v="body" color={mine ? t.accentText : t.text} accessibilityLabel={`${mine ? 'You' : 'Petal'}: ${m.text}`}>
        {m.text}
      </T>
      {danger && (
        <Button small kind="danger" title="Get support now" onPress={() => router.push('/support')} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingVertical: 10 },
  bubble: { maxWidth: '86%', padding: 14, borderRadius: 22, marginBottom: 10 },
  me: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  bot: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  starter: { borderRadius: 20, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  inputRow: { marginHorizontal: 14, borderRadius: 28, borderWidth: 1, paddingLeft: 18, paddingRight: 6, paddingVertical: 4, alignItems: 'flex-end' },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
});
