import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';
import type { BodyRegion } from '../data/types';
import { useTheme } from '../theme/useTheme';
import { Segmented, T, tap } from './ui';

export const REGION_LABEL: Record<BodyRegion, string> = {
  lower_abdomen: 'Lower abdomen',
  left_pelvis: 'Left pelvic area',
  right_pelvis: 'Right pelvic area',
  lower_back: 'Lower back',
  upper_back: 'Upper back',
  legs: 'Legs',
  breasts: 'Breasts / chest',
  head: 'Head',
};

type Side = 'front' | 'back';

/** Hit areas in a 200×400 viewBox. Left/right are the user's own sides. */
const AREAS: Record<
  Side,
  {
    region: BodyRegion;
    shape: { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number } | { type: 'rect'; x: number; y: number; w: number; h: number };
  }[]
> = {
  front: [
    {
      region: 'head',
      shape: { type: 'ellipse', cx: 100, cy: 42, rx: 26, ry: 30 },
    },
    { region: 'breasts', shape: { type: 'rect', x: 62, y: 104, w: 76, h: 40 } },
    {
      region: 'lower_abdomen',
      shape: { type: 'ellipse', cx: 100, cy: 196, rx: 26, ry: 22 },
    },
    {
      region: 'right_pelvis',
      shape: { type: 'ellipse', cx: 72, cy: 214, rx: 16, ry: 18 },
    },
    {
      region: 'left_pelvis',
      shape: { type: 'ellipse', cx: 128, cy: 214, rx: 16, ry: 18 },
    },
    { region: 'legs', shape: { type: 'rect', x: 66, y: 252, w: 68, h: 130 } },
  ],
  back: [
    {
      region: 'head',
      shape: { type: 'ellipse', cx: 100, cy: 42, rx: 26, ry: 30 },
    },
    {
      region: 'upper_back',
      shape: { type: 'rect', x: 64, y: 100, w: 72, h: 54 },
    },
    {
      region: 'lower_back',
      shape: { type: 'rect', x: 68, y: 162, w: 64, h: 50 },
    },
    { region: 'legs', shape: { type: 'rect', x: 66, y: 252, w: 68, h: 130 } },
  ],
};

const SILHOUETTE =
  'M100 10 C 84 10 74 24 74 42 C 74 58 82 70 92 74 L 92 84 C 70 88 56 96 50 110 C 44 126 40 170 36 210 C 34 222 44 224 46 212 L 56 140 L 60 196 C 58 220 60 236 64 250 L 66 384 C 66 394 86 394 88 384 L 96 270 L 104 270 L 112 384 C 114 394 134 394 134 384 L 136 250 C 140 236 142 220 140 196 L 144 140 L 154 212 C 156 224 166 222 164 210 C 160 170 156 126 150 110 C 144 96 130 88 108 84 L 108 74 C 118 70 126 58 126 42 C 126 24 116 10 100 10 Z';

export function BodyMap({ selected, onToggle }: { selected: BodyRegion[]; onToggle: (r: BodyRegion) => void }) {
  const t = useTheme();
  const [side, setSide] = useState<Side>('front');
  const fillFor = (r: BodyRegion) => (selected.includes(r) ? 'rgba(217,146,170,0.75)' : t.dark ? 'rgba(247,220,229,0.10)' : 'rgba(217,146,170,0.14)');
  return (
    <View>
      <Segmented
        options={[
          { value: 'front', label: 'Front' },
          { value: 'back', label: 'Back' },
        ]}
        value={side}
        onChange={setSide}
      />
      <View style={styles.wrap}>
        <View aria-hidden importantForAccessibility="no-hide-descendants">
          <Svg width={200} height={400} viewBox="0 0 200 400">
            <Path d={SILHOUETTE} fill={t.dark ? '#3A2D3E' : '#FBEFF2'} stroke={t.primary} strokeWidth={1.5} />
            <G>
              {AREAS[side].map(({ region, shape }) =>
                shape.type === 'ellipse' ? (
                  <Ellipse
                    key={region + side}
                    cx={shape.cx}
                    cy={shape.cy}
                    rx={shape.rx}
                    ry={shape.ry}
                    fill={fillFor(region)}
                    stroke={selected.includes(region) ? t.primary : 'transparent'}
                    strokeWidth={2}
                    onPress={() => {
                      tap('select');
                      onToggle(region);
                    }}
                  />
                ) : (
                  <Rect
                    key={region + side}
                    x={shape.x}
                    y={shape.y}
                    width={shape.w}
                    height={shape.h}
                    rx={18}
                    fill={fillFor(region)}
                    stroke={selected.includes(region) ? t.primary : 'transparent'}
                    strokeWidth={2}
                    onPress={() => {
                      tap('select');
                      onToggle(region);
                    }}
                  />
                ),
              )}
            </G>
          </Svg>
        </View>
        {side === 'front' && (
          <>
            <T v="small" soft style={[styles.side, { left: 4 }]}>
              Your right
            </T>
            <T v="small" soft style={[styles.side, { right: 4 }]}>
              Your left
            </T>
          </>
        )}
      </View>
      {/* Accessible list mirrors the map so the feature works without sight or precise taps */}
      <View style={styles.list}>
        {AREAS[side].map(({ region }) => {
          const on = selected.includes(region);
          return (
            <Pressable
              key={region}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={REGION_LABEL[region]}
              onPress={() => {
                tap('select');
                onToggle(region);
              }}
              style={[
                styles.tag,
                {
                  backgroundColor: on ? t.primary : t.surfaceGlass,
                  borderColor: on ? t.primary : t.border,
                },
              ]}
            >
              <T v="label" color={on ? '#2E1F30' : t.text}>
                {on ? '● ' : ''}
                {REGION_LABEL[region]}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 12 },
  side: { position: 'absolute', top: 200 },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 14,
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
});
