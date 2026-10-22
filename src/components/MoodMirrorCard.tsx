import React from 'react';
import { View } from 'react-native';
import { Card, Row, T } from './ui';
import { MoodFace } from './Mood';
import { MIRROR_PART_LABEL, MoodMirror } from '../engines/patterns';
import { useLocalize, useT } from '../i18n';
import { num } from '../lib/dates';
import { useTheme } from '../theme/useTheme';

/** Moods across the parts of the cycle: the most common mood, and how many check-ins were hard ones. */
export function MoodMirrorCard({ mirror }: { mirror: MoodMirror }) {
  const t = useTheme();
  const L = useLocalize();
  const tr = useT();
  return (
    <Card tint={t.lavender}>
      <T v="h3">Your Mood Mirror</T>
      <T v="small" muted>
        {`How your check-ins sit across your cycle, from ${mirror.checkIns} check-ins over ${mirror.cycles} cycles.`}
      </T>
      <View style={{ gap: 12, marginTop: 12 }}>
        {mirror.rows.map((r) => {
          const pct = Math.round(r.lowShare * 100);
          const label = L(MIRROR_PART_LABEL[r.part]);
          const mood = r.topMood ? tr(`mood.${r.topMood}`).toLowerCase() : '';
          return (
            <View
              key={r.part}
              accessible
              accessibilityLabel={r.n ? `${label}: ${L('mostly')} ${mood}. ${num(pct)}% ${L('hard days')}, ${num(r.n)} ${L('check-ins')}.` : `${label}: ${L('no check-ins yet')}`}
            >
              <Row style={{ gap: 10 }}>
                {r.topMood ? <MoodFace mood={r.topMood} size={30} /> : <View style={{ width: 30 }} />}
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="bodyMedium">{MIRROR_PART_LABEL[r.part]}</T>
                    <T v="small" soft>
                      {r.n ? `${num(pct)}% ${L('hard days')}` : L('no check-ins yet')}
                    </T>
                  </Row>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: t.surface, marginTop: 4, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: 8, backgroundColor: t.primary }} />
                  </View>
                  {r.n ? (
                    <T v="small" muted style={{ marginTop: 2 }}>
                      {`${L('mostly')} ${mood}`}
                    </T>
                  ) : null}
                </View>
              </Row>
            </View>
          );
        })}
      </View>
      {mirror.reflection ? (
        <T v="small" style={{ marginTop: 12 }}>
          {mirror.reflection}
        </T>
      ) : null}
      <T v="small" soft style={{ marginTop: 6 }}>
        Hard days means feeling anxious, sad, irritated, exhausted or overwhelmed.
      </T>
    </Card>
  );
}
