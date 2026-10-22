import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { Mood } from '../data/types';
import { useT } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { T, tap } from './ui';

export const MOODS: Mood[] = ['happy', 'peaceful', 'anxious', 'sad', 'irritated', 'exhausted', 'overwhelmed', 'mixed'];

export const MOOD_STYLE: Record<Mood, { color: string; mouth: string; eyes: 'open' | 'closed' | 'wide' | 'tired'; brow?: string }> = {
  happy: { color: '#FFD9C2', mouth: 'M 12 21 Q 18 27 24 21', eyes: 'open' },
  peaceful: { color: '#CFE3D0', mouth: 'M 13 22 Q 18 25 23 22', eyes: 'closed' },
  anxious: { color: '#E6DDF7', mouth: 'M 13 23 Q 15.5 21 18 23 Q 20.5 25 23 23', eyes: 'wide' },
  sad: { color: '#D9E1F2', mouth: 'M 13 25 Q 18 20 23 25', eyes: 'open', brow: 'M 11 12 L 15 11 M 25 12 L 21 11' },
  irritated: { color: '#F6C9CF', mouth: 'M 13 23 L 23 23', eyes: 'open', brow: 'M 11 11 L 15 13 M 25 11 L 21 13' },
  exhausted: { color: '#E9DFE3', mouth: 'M 14 23 Q 18 22 22 23', eyes: 'tired' },
  overwhelmed: { color: '#EAD3E6', mouth: 'M 15 22 Q 18 27 21 22 Z', eyes: 'wide' },
  mixed: { color: '#F7E3D0', mouth: 'M 12 22 Q 15 25 18 22 Q 21 19 24 22', eyes: 'open' },
};

export function MoodFace({ mood, size = 44 }: { mood: Mood; size?: number }) {
  const s = MOOD_STYLE[mood];
  const ink = '#49364B';
  const eye = (x: number) =>
    s.eyes === 'closed' ? (
      <Path key={x} d={`M ${x - 2.5} 16 Q ${x} 18 ${x + 2.5} 16`} stroke={ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    ) : s.eyes === 'tired' ? (
      <Path key={x} d={`M ${x - 2.5} 16.5 L ${x + 2.5} 16.5`} stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
    ) : (
      <Circle key={x} cx={x} cy={16} r={s.eyes === 'wide' ? 2.1 : 1.6} fill={ink} />
    );
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Circle cx={18} cy={18} r={17} fill={s.color} />
      {eye(13)}
      {eye(23)}
      {s.brow ? <Path d={s.brow} stroke={ink} strokeWidth={1.4} strokeLinecap="round" /> : null}
      <Path d={s.mouth} stroke={ink} strokeWidth={1.6} fill={mood === 'overwhelmed' ? ink : 'none'} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MoodPicker({ value, onChange, compact }: { value: Mood | null; onChange: (m: Mood) => void; compact?: boolean }) {
  const t = useTheme();
  const tr = useT();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {MOODS.map((m) => {
        const on = value === m;
        return (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tr(`mood.${m}`)}
            onPress={() => {
              tap('select');
              onChange(m);
            }}
            style={({ pressed }) => [
              styles.item,
              { borderColor: on ? t.primary : 'transparent', backgroundColor: on ? t.blush : 'transparent' },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <MoodFace mood={m} size={compact ? 38 : 46} />
            <T v="small" center style={{ marginTop: 4, fontSize: 11.5, letterSpacing: -0.2 }} numberOfLines={2}>
              {tr(`mood.${m}`)}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  item: { width: '24.5%', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 1, borderRadius: 18, borderWidth: 1.5 },
});
