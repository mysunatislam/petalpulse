import React from 'react';
import { View } from 'react-native';
import { Card, Gap, Notice, Row, Screen, T, tap } from '../components/ui';
import { useApp } from '../store/app';
import type { CareMode } from '../data/types';
import { useTheme } from '../theme/useTheme';

const MODES: { mode: CareMode; icon: string; title: string; when: string; does: string[] }[] = [
  { mode: 'everyday', icon: '🌷', title: 'Everyday Mode', when: 'For normal days', does: ['Cycle dashboard', 'Daily check-in', 'Food and self-care ideas'] },
  { mode: 'comfort', icon: '🤍', title: 'Comfort Mode', when: 'When you’re in strong discomfort', does: ['Less on screen', 'Pain map and comfort first', 'Medical guidance one tap away'] },
  { mode: 'quiet', icon: '🕯️', title: 'Quiet Mode', when: 'When you feel overwhelmed', does: ['Calm, simplified home', 'Fewer prompts', 'Quiet breathing and journaling'] },
  { mode: 'reflection', icon: '🔮', title: 'Reflection Mode', when: 'When you want to understand patterns', does: ['Insights on your home', 'Journaling prompts', 'Historical comparisons'] },
];

export default function CareModeScreen() {
  const t = useTheme();
  const current = useApp((s) => s.settings.careMode);
  return (
    <Screen title="My Care Mode" eyebrow="You’re in control">
      <T v="body" muted>
        Choose how Petal & Pulse feels right now. You can switch back anytime. Petal may suggest a mode, but it never changes it without you.
      </T>
      <Gap h={16} />
      <View style={{ gap: 12 }}>
        {MODES.map((m) => {
          const on = current === m.mode;
          return (
            <Card
              key={m.mode}
              tint={on ? t.blush : undefined}
              style={{ borderWidth: on ? 2 : 1, borderColor: on ? t.primary : t.border }}
              onPress={() => {
                tap('success');
                useApp.getState().updateSettings({ careMode: m.mode, ...(m.mode === 'quiet' ? {} : {}) });
              }}
              accessibilityLabel={`${m.title}. ${m.when}.${on ? ' Currently active.' : ''}`}
            >
              <Row style={{ gap: 12, alignItems: 'flex-start' }}>
                <T style={{ fontSize: 28 }}>{m.icon}</T>
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="h3">{m.title}</T>
                    {on && <T v="label" color={t.primaryText}>Active</T>}
                  </Row>
                  <T v="small" muted>
                    {m.when}
                  </T>
                  <T v="small" style={{ marginTop: 6 }}>
                    {m.does.map((d) => `• ${d}`).join('\n')}
                  </T>
                </View>
              </Row>
            </Card>
          );
        })}
      </View>
      {current === 'quiet' && (
        <>
          <Gap h={14} />
          <Notice tone="calm">Quiet Mode pauses non-essential reminders while it’s on.</Notice>
        </>
      )}
    </Screen>
  );
}
