import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { T, tap } from './ui';

const COLORS = ['#CADCCB', '#D6E2C8', '#E6E2C0', '#F4DDB8', '#FFD3B5', '#FBC2AE', '#F2ACAA', '#E896A6', '#D97F9E', '#C46790', '#A8507E'];

export const PAIN_WORDS = [
  'No pain',
  'Barely there',
  'Mild',
  'Noticeable',
  'Distracting',
  'Hard to ignore',
  'Interferes with focus',
  'Hard to do daily things',
  'Intense',
  'Severe',
  'Worst imaginable',
];

export function PainScale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Pain intensity, 0 to 10"
      accessibilityValue={{ min: 0, max: 10, now: value ?? undefined, text: value === null ? 'Not selected' : `${value}, ${PAIN_WORDS[value]}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const v = value ?? 0;
        onChange(Math.max(0, Math.min(10, v + (e.nativeEvent.actionName === 'increment' ? 1 : -1))));
      }}
    >
      <View style={styles.row}>
        {COLORS.map((c, i) => {
          const on = value === i;
          const filled = value !== null && i <= value;
          return (
            <Pressable
              key={i}
              onPress={() => {
                tap('select');
                onChange(i);
              }}
              accessibilityLabel={`${i}, ${PAIN_WORDS[i]}`}
              accessibilityRole="button"
              style={[
                styles.seg,
                {
                  backgroundColor: filled ? c : t.dark ? '#3A2D3E' : '#F3ECEF',
                  height: 26 + i * 3.2,
                  borderColor: on ? t.accent : 'transparent',
                },
              ]}
            >
              <T v="small" center style={{ fontSize: 12, color: filled ? '#2E1F30' : t.textMuted, fontWeight: on ? '700' : '400' }}>
                {i}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={{ alignItems: 'center', marginTop: 14, minHeight: 56 }}>
        {value !== null ? (
          <>
            <T v="display" style={{ fontSize: 34, lineHeight: 38 }}>
              {value}
              <T v="h3" muted>
                {' '}
                / 10
              </T>
            </T>
            <T v="bodyMedium" muted>
              {PAIN_WORDS[value]}
            </T>
          </>
        ) : (
          <T v="small" muted>
            Tap a number. There’s no wrong answer.
          </T>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 3 },
  seg: { flex: 1, borderRadius: 10, justifyContent: 'flex-end', paddingBottom: 4, borderWidth: 2, minWidth: 24 },
});
