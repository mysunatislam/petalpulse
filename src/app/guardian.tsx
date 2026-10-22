import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, ChipGroup, Gap, Notice, Screen, T, Toggle, tap } from '../components/ui';
import { useApp } from '../store/app';
import { GUARDIAN_COPY, GUARDIAN_RELATIONS, isMinor, recordGuardianConsent } from '../engines/privacy';
import { useLocalize } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { fonts } from '../theme/tokens';

/** Parent or guardian agreement before an under-18 turns on cloud AI. */
export default function GuardianConsent() {
  const t = useTheme();
  const L = useLocalize();
  const s = useApp();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    const next = recordGuardianConsent(s.settings, { name, relation });
    if (typeof next === 'string') return setError(next);
    tap('success');
    await s.updateSettings(next);
    router.back();
  };

  return (
    <Screen title={GUARDIAN_COPY.title} eyebrow="Cloud AI for under-18s">
      <T v="body" muted>
        {GUARDIAN_COPY.intro}
      </T>
      <Gap h={14} />
      <Card tint={t.lavender}>
        <T v="label">What cloud AI means</T>
        <Gap h={6} />
        {GUARDIAN_COPY.points.map((p) => (
          <T key={p} v="small" style={{ marginBottom: 6 }}>
            • {p}
          </T>
        ))}
      </Card>
      {!isMinor(s.profile.ageRange) && (
        <>
          <Gap h={12} />
          <Notice tone="info">Your profile says you’re 18 or over, so this step isn’t needed.</Notice>
        </>
      )}
      <Gap h={16} />
      <T v="label">Parent or guardian’s name</T>
      <Gap h={6} />
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError('');
        }}
        placeholder={L('Their name')}
        placeholderTextColor={t.textSoft}
        accessibilityLabel={L('Parent or guardian’s name')}
        autoCapitalize="words"
        style={{ minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceGlass, paddingHorizontal: 14, color: t.text, fontFamily: fonts.sans, fontSize: 15 }}
      />
      <Gap h={14} />
      <T v="label">How they’re related to you</T>
      <Gap h={8} />
      <ChipGroup
        options={GUARDIAN_RELATIONS.map((r) => ({ value: r, label: r }))}
        value={relation}
        onChange={(v) => {
          setRelation(v as string);
          setError('');
        }}
      />
      <Gap h={10} />
      <Toggle label={GUARDIAN_COPY.confirm} value={agreed} onChange={setAgreed} />
      {error ? (
        <View style={{ marginTop: 8 }}>
          <Notice tone="warn">{error}</Notice>
        </View>
      ) : null}
      <Gap h={14} />
      <Button title="Agree and turn on cloud AI" disabled={!agreed} onPress={confirm} />
      <Gap h={10} />
      <Button kind="ghost" title="Not now" onPress={() => router.back()} />
      <Gap h={8} />
      <T v="small" soft>
        {GUARDIAN_COPY.device}
      </T>
    </Screen>
  );
}
