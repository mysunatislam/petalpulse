import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MicButton } from '../components/MicButton';
import { Button, Card, Chip, ChipGroup, Gap, Notice, Row, Screen, SectionTitle, T, tap } from '../components/ui';
import { MoodFace, MoodPicker, MOOD_STYLE } from '../components/Mood';
import { useApp } from '../store/app';
import { useCycle, useInsights, useToday } from '../store/derived';
import { moodMirror } from '../engines/patterns';
import { MoodMirrorCard } from '../components/MoodMirrorCard';
import { suggestThemes } from '../engines/personalization';
import { screenText } from '../engines/safety';
import { addDays, formatShort, uid } from '../lib/dates';
import { TAG_LABEL } from '../lib/labels';
import { useT, useLocalize } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { fonts } from '../theme/tokens';
import type { Mood, MoodTag } from '../data/types';

export default function MoodMirror() {
  const L = useLocalize();
  const t = useTheme();
  const tr = useT();
  const today = useToday();
  const moods = useApp((s) => s.moods);
  const consent = useApp((s) => s.settings.journalThemeConsent);
  const { visible } = useInsights();
  const { periods } = useCycle();
  const mirror = useMemo(() => moodMirror(moods, periods), [moods, periods]);
  const [mood, setMood] = useState<Mood | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [tags, setTags] = useState<MoodTag[]>([]);
  const [text, setText] = useState('');
  const [themes, setThemes] = useState<string[] | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const risk = text.length > 8 ? screenText(text) : 'none';

  const last14 = useMemo(() => {
    const out: { date: string; mood: Mood | null }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i);
      const m = [...moods].reverse().find((x) => x.date === d);
      out.push({ date: d, mood: m?.mood ?? null });
    }
    return out;
  }, [moods, today]);

  const save = async () => {
    if (!mood) return;
    await useApp.getState().addMood({ id: uid('mood'), date: today, createdAt: new Date().toISOString(), mood, intensity, tags, text: text.trim(), confirmedThemes: confirmed });
    tap('success');
    setSaved(true);
    setMood(null);
    setTags([]);
    setText('');
    setThemes(null);
    setConfirmed([]);
    setIntensity(3);
  };

  const recent = [...moods].reverse().slice(0, 12);
  const moodInsights = visible.filter((i) => i.relatesTo.includes('mood') || i.relatesTo.includes('stress'));

  return (
    <Screen title="Mood Mirror" eyebrow="Your emotional journal">
      <Card glass>
        <T v="label" muted>
          Your last two weeks
        </T>
        <LinearGradient colors={['#FFDCCB', '#F7DCE5', '#E9E1F8', '#CADCCB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 6, borderRadius: 3, marginTop: 10, marginBottom: 10 }} />
        <Row style={{ justifyContent: 'space-between' }} accessibilityLabel={`Moods over the last 14 days: ${last14.filter((d) => d.mood).map((d) => `${formatShort(d.date)} ${d.mood}`).join(', ') || 'none logged'}`}>
          {last14.map((d) => (
            <View key={d.date} style={{ alignItems: 'center', width: `${100 / 14}%` }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: d.mood ? MOOD_STYLE[d.mood].color : t.border, borderWidth: d.date === today ? 2 : 0, borderColor: t.accent }} />
            </View>
          ))}
        </Row>
      </Card>

      <SectionTitle>How are you, really?</SectionTitle>
      {saved && (
        <Notice tone="calm" title="Saved to your journal 🌸">
          Thank you for taking a moment for yourself.
        </Notice>
      )}
      <Card style={{ marginTop: saved ? 12 : 0 }}>
        <MoodPicker
          value={mood}
          onChange={(m) => {
            setSaved(false);
            setMood(m);
          }}
        />
        {mood && (
          <>
            <Gap h={14} />
            <T v="label">How strong is it?</T>
            <Gap h={8} />
            <ChipGroup
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: ['A little', 'Some', 'Moderate', 'Strong', 'Very strong'][n - 1] }))}
              value={String(intensity)}
              onChange={(v) => setIntensity(Number(v))}
            />
            <Gap h={14} />
            <T v="label">{tr('mood.weighing')}</T>
            <Gap h={8} />
            <ChipGroup multi options={(Object.keys(TAG_LABEL) as MoodTag[]).map((k) => ({ value: k, label: TAG_LABEL[k] }))} value={tags} onChange={(v) => setTags(v as MoodTag[])} />
            <Gap h={14} />
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="label">Write it out (optional)</T>
              <MicButton
                value={text}
                onText={(v) => {
                  setText(v);
                  setThemes(null);
                }}
                onNotice={setVoiceNote}
              />
            </Row>
            {voiceNote && (
              <>
                <Gap h={8} />
                <Notice tone="calm" action="OK" onAction={() => setVoiceNote(null)}>
                  {voiceNote}
                </Notice>
              </>
            )}
            <Gap h={8} />
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                setThemes(null);
              }}
              multiline
              placeholder={L('No rules. A word, a sentence, or a page.')}
              placeholderTextColor={t.textSoft}
              accessibilityLabel="Journal entry"
              style={{ minHeight: 110, borderRadius: 20, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg, padding: 16, color: t.text, fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 23, textAlignVertical: 'top' }}
            />
            {risk === 'crisis' && (
              <>
                <Gap h={10} />
                <Notice tone="danger" title="You don’t have to carry this alone" action="See support options" onAction={() => router.push('/support')}>
                  If you’re thinking about hurting yourself, please reach out now: call 999 in an emergency, or talk to someone you trust.
                </Notice>
              </>
            )}
            {consent && text.trim().length > 15 && themes === null && (
              <Button small kind="soft" title="✿ Suggest possible themes" onPress={() => setThemes(suggestThemes(text))} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            )}
            {themes && (
              <View style={{ marginTop: 12 }}>
                <T v="small" muted>
                  {themes.length ? 'Possible themes. Tap the ones that feel true; ignore the rest.' : 'No clear themes stood out, and that’s okay.'}
                </T>
                <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {themes.map((th) => (
                    <Chip key={th} label={th} selected={confirmed.includes(th)} onPress={() => setConfirmed(confirmed.includes(th) ? confirmed.filter((x) => x !== th) : [...confirmed, th])} />
                  ))}
                </Row>
              </View>
            )}
            {!consent && (
              <T v="small" soft style={{ marginTop: 8 }}>
                Theme suggestions are off. You can enable them in Settings › Privacy.
              </T>
            )}
            <Gap h={16} />
            <Button title="Save to my journal" onPress={save} />
          </>
        )}
      </Card>

      {mirror && (
        <>
          <Gap h={16} />
          <MoodMirrorCard mirror={mirror} />
        </>
      )}

      {moodInsights.length > 0 && (
        <>
          <SectionTitle action="All patterns" onAction={() => router.push('/(tabs)/insights')}>
            What your mirror shows
          </SectionTitle>
          {moodInsights.map((i) => (
            <Card key={i.id} tint={t.lavender} style={{ marginBottom: 10 }}>
              <T v="h3">{i.title}</T>
              <T v="small" muted>
                {i.body}
              </T>
            </Card>
          ))}
        </>
      )}

      <SectionTitle>Recent entries</SectionTitle>
      <View style={{ gap: 8 }}>
        {recent.map((m) => (
          <Card key={m.id} style={{ paddingVertical: 12 }}>
            <Row style={{ gap: 12, alignItems: 'flex-start' }}>
              <MoodFace mood={m.mood} size={36} />
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="bodyMedium">{tr(`mood.${m.mood}`)}</T>
                  <T v="small" soft>
                    {formatShort(m.date)}
                  </T>
                </Row>
                {m.tags.length > 0 && (
                  <T v="small" muted>
                    {m.tags.map((x) => TAG_LABEL[x]).join(' · ')}
                  </T>
                )}
                {m.text ? (
                  <T v="small" style={{ fontFamily: fonts.serifItalic, marginTop: 4 }}>
                    “{m.text}”
                  </T>
                ) : null}
                {m.confirmedThemes.length > 0 && (
                  <T v="small" soft style={{ marginTop: 2 }}>
                    Themes: {m.confirmedThemes.join(', ')}
                  </T>
                )}
              </View>
              <Button small kind="ghost" title="Delete" onPress={() => useApp.getState().deleteMood(m.id)} accessibilityHint="Deletes this journal entry" />
            </Row>
          </Card>
        ))}
        {recent.length === 0 && (
          <T v="small" muted>
            Your entries will appear here.
          </T>
        )}
      </View>
    </Screen>
  );
}
