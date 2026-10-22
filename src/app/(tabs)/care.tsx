import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Card, Gap, Row, Screen, SectionTitle, T } from '../../components/ui';
import { useApp } from '../../store/app';
import { useCycle, useTodayEntries } from '../../store/derived';
import { comfortPath, COMFORT_ITEMS, whatHelps } from '../../engines/personalization';
import { modeLabel } from '../../lib/labels';
import { useTheme } from '../../theme/useTheme';

export default function Care() {
  const t = useTheme();
  const mode = useApp((s) => s.settings.careMode);
  const pain = useApp((s) => s.pain);
  const { status } = useCycle();
  const { pain: todayPain } = useTodayEntries();
  const ideas = todayPain ? comfortPath(todayPain, pain.filter((p) => p.id !== todayPain.id)) : [COMFORT_ITEMS.heat, COMFORT_ITEMS.breathing, COMFORT_ITEMS.fluids];
  const helps = whatHelps(pain);

  const tiles = [
    { title: 'Pain Passport', detail: 'Body map, timeline & monthly summary', icon: '🗺️', tint: t.blush, go: '/pain/passport' },
    { title: 'Log pain', detail: 'Show where it hurts', icon: '🤍', tint: t.peach, go: '/pain/log' },
    { title: 'Mood Mirror', detail: 'Journal and notice patterns', icon: '🪞', tint: t.lavender, go: '/mood' },
    { title: 'Nourish Me', detail: 'Meal ideas for today', icon: '🍲', tint: t.dark ? t.peach : '#FFF0E8', go: '/nourish' },
    { title: 'Breathe', detail: 'One calm minute', icon: '🫧', tint: t.sage, go: '/breathe' },
    { title: 'One Minute for Me', detail: 'Check-in & gentle plan', icon: '⏱️', tint: t.blush, go: '/checkin' },
  ] as const;

  return (
    <Screen back={false} title="My Care" eyebrow="Comfort, nourishment & support">
      <Card onPress={() => router.push('/care-mode')} tint={t.lavender} accessibilityLabel={`My Care Mode, currently ${modeLabel(mode)}`}>
        <Row>
          <View style={{ flex: 1 }}>
            <T v="eyebrow" soft>
              My Care Mode
            </T>
            <T v="h2">{modeLabel(mode)}</T>
            <T v="small" muted>
              Change how the app feels, based on what you need.
            </T>
          </View>
          <T v="h2">›</T>
        </Row>
      </Card>

      <Gap h={14} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((x) => (
          <Card key={x.title} tint={x.tint} onPress={() => router.push(x.go)} accessibilityLabel={`${x.title}. ${x.detail}`} style={{ width: '47.8%', minHeight: 132 }}>
            <T style={{ fontSize: 28 }}>{x.icon}</T>
            <T v="h3" style={{ marginTop: 8 }}>
              {x.title}
            </T>
            <T v="small" muted>
              {x.detail}
            </T>
          </Card>
        ))}
      </View>

      <SectionTitle>{todayPain ? 'Your Comfort Path today' : status.phase === 'menstrual' ? 'For your period days' : 'Gentle comfort ideas'}</SectionTitle>
      <View style={{ gap: 10 }}>
        {ideas.slice(0, 4).map((c) => (
          <Card key={c.id} onPress={c.id === 'breathing' ? () => router.push('/breathe') : undefined}>
            <Row style={{ gap: 12, alignItems: 'flex-start' }}>
              <T style={{ fontSize: 24 }}>{c.icon}</T>
              <View style={{ flex: 1 }}>
                <T v="h3">{c.title}</T>
                <T v="small" muted>
                  {c.detail}
                </T>
                {c.note ? (
                  <T v="small" color={t.primaryText} style={{ marginTop: 4 }}>
                    {c.note}
                  </T>
                ) : null}
              </View>
            </Row>
          </Card>
        ))}
      </View>
      {helps.length > 0 && (
        <>
          <Gap h={12} />
          <Card tint={t.sage} accessibilityLabel="What tends to help you">
            <T v="label">What tends to help you</T>
            <Gap h={6} />
            {helps.map((h) => (
              <T key={h.item.id} v="small">
                {h.item.icon} {`${h.item.title} (helped ${h.helped}/${h.tried})`}
              </T>
            ))}
            <T v="small" soft style={{ marginTop: 6 }}>
              Learned from what you marked in your Comfort Path.
            </T>
          </Card>
        </>
      )}

      <SectionTitle>Support</SectionTitle>
      <Card onPress={() => router.push('/support')} tint={t.warnBg} accessibilityLabel="When to seek care, and support lines">
        <T v="h3">When to seek care</T>
        <T v="small" muted>
          Signs that need a doctor, and people you can talk to.
        </T>
      </Card>
      <Gap h={10} />
      <Card onPress={() => router.push('/export')}>
        <T v="h3">Health summary for your clinician</T>
        <T v="small" muted>
          Create a PDF of your cycles, pain and symptoms.
        </T>
      </Card>
    </Screen>
  );
}
