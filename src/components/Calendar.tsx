import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ISODate, monthMatrix, monthName, todayISO } from '../lib/dates';
import { useTheme } from '../theme/useTheme';
import { IconButton, Row, T, tap } from './ui';

export interface DayDecoration {
  fill?: string;
  ring?: string;
  dot?: string;
  dashed?: boolean;
  label?: string; // for screen readers
}

export function MonthCalendar({
  initial,
  selected,
  onSelect,
  decorate,
  maxDate,
  minDate,
}: {
  initial?: ISODate;
  selected?: ISODate | null;
  onSelect: (d: ISODate) => void;
  decorate?: (d: ISODate) => DayDecoration | null;
  maxDate?: ISODate;
  minDate?: ISODate;
}) {
  const t = useTheme();
  const today = todayISO();
  const start = initial ?? today;
  const [ym, setYm] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const rows = monthMatrix(ym.y, ym.m);
  const shift = (d: number) => {
    const m = ym.m + d;
    setYm({ y: ym.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };
  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <IconButton label="Previous month" onPress={() => shift(-1)}>
          <T v="h3">‹</T>
        </IconButton>
        <T v="h2" accessibilityRole="header">
          {monthName(ym.m)} {ym.y}
        </T>
        <IconButton label="Next month" onPress={() => shift(1)}>
          <T v="h3">›</T>
        </IconButton>
      </Row>
      <Row>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <T key={i} v="small" soft center style={{ flex: 1 }} aria-hidden>
            {d}
          </T>
        ))}
      </Row>
      {rows.map((row, ri) => (
        <Row key={ri} style={{ marginTop: 4 }}>
          {row.map((d, ci) => {
            if (!d) return <View key={ci} style={styles.cell} />;
            const deco = decorate?.(d) ?? null;
            const disabled = (maxDate && d > maxDate) || (minDate && d < minDate);
            const isSel = selected === d;
            const isToday = d === today;
            return (
              <Pressable
                key={ci}
                disabled={!!disabled}
                onPress={() => {
                  tap('select');
                  onSelect(d);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel, disabled: !!disabled }}
                accessibilityLabel={`${monthName(ym.m)} ${Number(d.slice(8))}${isToday ? ', today' : ''}${deco?.label ? `, ${deco.label}` : ''}`}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.day,
                    deco?.fill ? { backgroundColor: deco.fill } : null,
                    deco?.ring ? { borderColor: deco.ring, borderWidth: 2, borderStyle: deco.dashed ? 'dashed' : 'solid' } : null,
                    isSel ? { backgroundColor: t.accent } : null,
                  ]}
                >
                  <T
                    v="label"
                    center
                    color={isSel ? t.accentText : disabled ? t.textSoft : deco?.fill ? '#2E1F30' : t.text}
                    style={[isToday && !isSel ? { textDecorationLine: 'underline', fontWeight: '700' } : null, disabled ? { opacity: 0.4 } : null]}
                  >
                    {Number(d.slice(8))}
                  </T>
                </View>
                {deco?.dot ? <View style={[styles.dot, { backgroundColor: deco.dot }]} /> : <View style={styles.dotSpace} />}
              </Pressable>
            );
          })}
        </Row>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', minHeight: 48 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  dotSpace: { height: 7 },
});
