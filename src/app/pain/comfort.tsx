import React, { useMemo } from 'react';
import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Gap, Notice, Row, Screen, SectionTitle, T, tap } from '../../components/ui';
import { useApp } from '../../store/app';
import { assessPain } from '../../engines/safety';
import { comfortPath } from '../../engines/personalization';
import { REGION_LABEL } from '../../components/BodyMap';
import { PAIN_WORDS } from '../../components/PainScale';
import { useTheme } from '../../theme/useTheme';

export default function ComfortPath() {
  const t = useTheme();
  const { id, preg } = useLocalSearchParams<{ id: string; preg?: string }>();
  const pain = useApp((s) => s.pain);
  const ep = pain.find((p) => p.id === id) ?? pain[pain.length - 1];
  const history = useMemo(() => pain.filter((p) => p.id !== ep?.id), [pain, ep]);
  const helpedBefore = useMemo(() => [...new Set(history.flatMap((h) => h.helped))], [history]);

  if (!ep) {
    return (
      <Screen title="Comfort Path">
        <T v="body">No pain log found yet.</T>
        <Gap />
        <Button title="Log pain" onPress={() => router.replace('/pain/log')} />
      </Screen>
    );
  }

  const safety = assessPain(ep, { history, possiblePregnancy: preg === '1' });
  const ideas = comfortPath(ep, helpedBefore);

  const mark = async (key: string, field: 'tried' | 'helped') => {
    const cur = useApp.getState().pain.find((p) => p.id === ep.id);
    if (!cur) return;
    const list = cur[field].includes(key) ? cur[field].filter((x) => x !== key) : [...cur[field], key];
    const tried = field === 'helped' && !cur.tried.includes(key) ? [...cur.tried, key] : field === 'tried' ? list : cur.tried;
    await useApp.getState().updatePain({ ...cur, [field]: list, tried });
    tap('select');
  };

  return (
    <Screen title="Your Comfort Path" eyebrow="Pain Passport">
      <Card glass>
        <T v="eyebrow" soft>
          Saved to your Pain Passport
        </T>
        <T v="h2" style={{ marginTop: 4 }}>
          {ep.intensity}/10 · {PAIN_WORDS[ep.intensity]}
        </T>
        <T v="small" muted>
          {ep.regions.map((r) => REGION_LABEL[r]).join(', ')}
        </T>
      </Card>

      {safety.level !== 'none' && (
        <>
          <Gap h={14} />
          <Notice tone={safety.level === 'appointment' ? 'warn' : 'danger'} title={safety.headline}>
            <T v="small" color={safety.level === 'appointment' ? t.text : t.danger}>
              {safety.guidance}
            </T>
            <Gap h={6} />
            {safety.reasons.map((r) => (
              <T key={r} v="small" color={safety.level === 'appointment' ? t.textMuted : t.danger}>
                • {r}
              </T>
            ))}
            {safety.level === 'emergency' && (
              <Button kind="danger" title="Call 999" onPress={() => Linking.openURL('tel:999')} style={{ marginTop: 12 }} />
            )}
          </Notice>
        </>
      )}

      <SectionTitle>Gentle things you could try</SectionTitle>
      <T v="small" muted style={{ marginBottom: 10 }}>
        These may help you feel more comfortable. They don’t cure pain, and strong or unusual pain deserves medical attention.
        {helpedBefore.length ? ' Things that helped you before are shown first.' : ''}
      </T>
      <View style={{ gap: 10 }}>
        {ideas.map((c) => {
          const tried = ep.tried.includes(c.id);
          const helped = ep.helped.includes(c.id);
          return (
            <Card key={c.id}>
              <Row style={{ gap: 12, alignItems: 'flex-start' }}>
                <T style={{ fontSize: 26 }}>{c.icon}</T>
                <View style={{ flex: 1 }}>
                  <T v="h3">{c.title}</T>
                  <T v="small" muted>
                    {c.detail}
                  </T>
                  <Row style={{ gap: 8, marginTop: 10 }}>
                    <Button small kind={tried ? 'primary' : 'secondary'} title={tried ? '✓ Tried' : 'I tried this'} onPress={() => mark(c.id, 'tried')} />
                    <Button small kind={helped ? 'primary' : 'ghost'} title={helped ? '♥ Helped' : 'It helped'} onPress={() => mark(c.id, 'helped')} />
                  </Row>
                </View>
              </Row>
            </Card>
          );
        })}
      </View>
      <Gap h={16} />
      <Row style={{ gap: 10 }}>
        <Button style={{ flex: 1 }} kind="soft" title="Breathe with me" onPress={() => router.push('/breathe')} />
        <Button style={{ flex: 1 }} kind="secondary" title="Talk to Petal" onPress={() => router.push('/(tabs)/petal')} />
      </Row>
      <Gap h={10} />
      <Button kind="ghost" title="View my Pain Passport" onPress={() => router.push('/pain/passport')} />
      <Gap h={10} />
      <Button kind="ghost" title="When to seek care" onPress={() => router.push('/support')} />
    </Screen>
  );
}
