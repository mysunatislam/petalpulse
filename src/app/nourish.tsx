import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, ChipGroup, Gap, Notice, Pill, Row, Screen, Segmented, T, tap } from '../components/ui';
import { useApp } from '../store/app';
import { useCycle, useTodayEntries } from '../store/derived';
import { MealPick, recommendMeals } from '../engines/personalization';
import { MEALS, mealAllowed } from '../data/meals';
import type { Symptom } from '../data/types';
import { useTheme } from '../theme/useTheme';

export default function Nourish() {
  const t = useTheme();
  const profile = useApp((s) => s.profile);
  const lang = useApp((s) => s.settings.language);
  const favorites = useApp((s) => s.favorites);
  const { status } = useCycle();
  const { log } = useTodayEntries();
  const [energy, setEnergy] = useState<string | null>(log?.energy ? String(log.energy) : null);
  const [appetite, setAppetite] = useState<'low' | 'normal' | 'high' | null>(null);
  const [symptoms, setSymptoms] = useState<Symptom[]>(log?.symptoms?.filter((s) => ['cramps', 'bloating', 'nausea', 'fatigue'].includes(s)) ?? []);
  const [tab, setTab] = useState<'today' | 'saved' | 'all'>('today');
  const [open, setOpen] = useState<string | null>(null);

  const picks = useMemo(
    () =>
      recommendMeals({
        profile,
        symptoms,
        bleeding: status.phase === 'menstrual',
        energy: energy ? Number(energy) : null,
        appetite,
        favorites: favorites.map((f) => f.id),
      }),
    [profile, symptoms, status.phase, energy, appetite, favorites],
  );
  const favIds = favorites.map((f) => f.id);
  const allowed = MEALS.filter((m) => mealAllowed(m, profile.diet, profile.allergies));
  const list: MealPick[] =
    tab === 'today'
      ? picks
      : (tab === 'saved' ? allowed.filter((m) => favIds.includes(m.id)) : allowed).map((meal) => ({ meal, reason: '', score: 0 }));

  const lowEnergy = energy !== null && Number(energy) <= 2;

  return (
    <Screen title="Nourish Me" eyebrow="Food that cares for you">
      <Card tint={t.dark ? t.peach : '#FFF0E8'}>
        <T v="h2">{lowEnergy ? 'Feeling low on energy?' : 'A little inspiration for today'}</T>
        <T v="small" muted style={{ marginTop: 4 }}>
          {lowEnergy ? 'Here are three simple meal ideas that might feel manageable today.' : 'Ideas shaped by how you feel, your preferences, and foods that are easy to find.'}
        </T>
        <Gap h={12} />
        <T v="label">Energy</T>
        <Gap h={6} />
        <ChipGroup options={[{ value: '1', label: 'Drained' }, { value: '2', label: 'Low' }, { value: '3', label: 'Okay' }, { value: '4', label: 'Good' }]} value={energy} onChange={(v) => setEnergy(v as string)} />
        <Gap h={10} />
        <T v="label">Appetite</T>
        <Gap h={6} />
        <ChipGroup options={[{ value: 'low', label: 'Small' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Hungry' }]} value={appetite} onChange={(v) => setAppetite(v as 'low' | 'normal' | 'high')} />
        <Gap h={10} />
        <T v="label">Today I have</T>
        <Gap h={6} />
        <ChipGroup multi options={[{ value: 'cramps', label: 'Cramps' }, { value: 'bloating', label: 'Bloating' }, { value: 'nausea', label: 'Nausea' }, { value: 'fatigue', label: 'Tiredness' }]} value={symptoms} onChange={(v) => setSymptoms(v as Symptom[])} />
      </Card>

      <Gap h={16} />
      <Segmented
        options={[
          { value: 'today', label: 'For today' },
          { value: 'saved', label: `Saved (${favorites.length})` },
          { value: 'all', label: 'All ideas' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Gap h={14} />
      <View style={{ gap: 14 }}>
        {list.map(({ meal, reason }) => {
          const fav = favIds.includes(meal.id);
          const expanded = open === meal.id;
          return (
            <Card key={meal.id} style={{ padding: 0, overflow: 'hidden' }}>
              <LinearGradient colors={t.dark ? [t.blush, t.lavender] : meal.palette} style={{ height: 110, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontSize: 54 }} aria-hidden>
                  {meal.emoji}
                </T>
              </LinearGradient>
              <View style={{ padding: 16 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <T v="h3">{meal.name}</T>
                    {lang === 'bn' && meal.nameBn ? <T v="small" muted>{meal.nameBn}</T> : null}
                  </View>
                  <Pill>{meal.minutes} min</Pill>
                </Row>
                {reason ? (
                  <T v="small" color={t.primaryText} style={{ marginTop: 4 }}>
                    {reason}
                  </T>
                ) : null}
                <T v="small" muted style={{ marginTop: 6 }}>
                  {meal.ingredients.join(' · ')}
                </T>
                {expanded && (
                  <Notice tone="calm" title="Why this may help">
                    <T v="small">{meal.why}</T>
                    <T v="small" soft style={{ marginTop: 4 }}>
                      Source: {meal.source}
                    </T>
                  </Notice>
                )}
                <Row style={{ gap: 8, marginTop: 12 }}>
                  <Button small kind="soft" title={expanded ? 'Hide' : 'Why this may help'} onPress={() => setOpen(expanded ? null : meal.id)} />
                  <Button
                    small
                    kind={fav ? 'primary' : 'secondary'}
                    title={fav ? '♥ Saved' : '♡ Save'}
                    onPress={() => {
                      tap('success');
                      useApp.getState().toggleFavorite(meal.id);
                    }}
                  />
                </Row>
              </View>
            </Card>
          );
        })}
        {list.length === 0 && (
          <T v="small" muted>
            {tab === 'saved' ? 'Tap ♡ on any idea to keep it here.' : 'No ideas match your preferences yet. You can adjust them in Settings.'}
          </T>
        )}
      </View>
      <Gap h={16} />
      <T v="small" soft>
        General nutrition ideas, not medical or dietary prescriptions. No restrictive diets, no required supplements. If you have a health condition, a doctor or dietitian can advise you personally.
      </T>
    </Screen>
  );
}
