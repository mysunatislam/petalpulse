import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { T } from './ui';

export interface Series {
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

/** Delicate line chart; x and y domains are fixed so comparisons stay honest. */
export function LineChart({
  series,
  xMax,
  yMax,
  yMin = 0,
  height = 170,
  width = 320,
  xLabel,
  bands,
}: {
  series: Series[];
  xMax: number;
  yMax: number;
  yMin?: number;
  height?: number;
  width?: number;
  xLabel?: string;
  bands?: { from: number; to: number; color: string }[];
}) {
  const t = useTheme();
  const pad = { l: 26, r: 10, t: 10, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const sx = (x: number) => pad.l + ((x - 1) / Math.max(1, xMax - 1)) * w;
  const sy = (y: number) => pad.t + h - ((y - yMin) / (yMax - yMin)) * h;
  const smooth = (pts: { x: number; y: number }[]) => {
    if (!pts.length) return '';
    let d = `M ${sx(pts[0].x)} ${sy(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const mx = (sx(p0.x) + sx(p1.x)) / 2;
      d += ` C ${mx} ${sy(p0.y)}, ${mx} ${sy(p1.y)}, ${sx(p1.x)} ${sy(p1.y)}`;
    }
    return d;
  };
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  return (
    <View>
      <View aria-hidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {bands?.map((b, i) => (
            <Rect key={i} x={sx(b.from)} y={pad.t} width={Math.max(2, sx(b.to) - sx(b.from))} height={h} fill={b.color} opacity={0.45} rx={6} />
          ))}
          {ticks.map((v) => (
            <React.Fragment key={v}>
              <Line x1={pad.l} x2={width - pad.r} y1={sy(v)} y2={sy(v)} stroke={t.border} strokeDasharray="3 5" />
              <SvgText x={pad.l - 6} y={sy(v) + 4} fontSize={10} fill={t.textSoft} textAnchor="end">
                {Number.isInteger(v) ? v : v.toFixed(1)}
              </SvgText>
            </React.Fragment>
          ))}
          {[1, Math.round(xMax / 2), xMax].map((x) => (
            <SvgText key={x} x={sx(x)} y={height - 6} fontSize={10} fill={t.textSoft} textAnchor="middle">
              {x}
            </SvgText>
          ))}
          {series.map((s) => (
            <React.Fragment key={s.label}>
              <Path d={smooth(s.points)} stroke={s.color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
              {s.points.map((p, i) => (
                <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.6} fill={s.color} />
              ))}
            </React.Fragment>
          ))}
        </Svg>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 14,
          marginTop: 4,
        }}
      >
        {series.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: s.color,
              }}
            />
            <T v="small" muted>
              {s.label}
            </T>
          </View>
        ))}
        {xLabel ? (
          <T v="small" soft>
            {xLabel}
          </T>
        ) : null}
      </View>
    </View>
  );
}

/** Petal bars: each bar is a rounded petal, height = value. */
export function PetalBars({ data, max, color, height = 140 }: { data: { label: string; value: number }[]; max: number; color: string; height?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        height: height + 22,
      }}
      accessibilityRole="summary"
    >
      {data.map((d) => (
        <View key={d.label} style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${d.label}: ${d.value}`}>
          <View
            style={{
              width: '70%',
              maxWidth: 34,
              height: Math.max(6, (d.value / Math.max(1, max)) * height),
              backgroundColor: color,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderBottomLeftRadius: 6,
              borderBottomRightRadius: 6,
            }}
          />
          <T v="small" soft style={{ fontSize: 11, marginTop: 4 }} numberOfLines={1}>
            {d.label}
          </T>
        </View>
      ))}
      {data.length === 0 && (
        <T v="small" muted>
          Nothing logged yet.
        </T>
      )}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 21,
          height: 1,
          backgroundColor: t.border,
        }}
      />
    </View>
  );
}

/** Scatter for comparing two measures (e.g. sleep vs energy). */
export function Scatter({
  points,
  xLabel,
  yLabel,
  xDomain,
  yDomain,
  color,
  width = 320,
  height = 180,
}: {
  points: { x: number; y: number }[];
  xLabel: string;
  yLabel: string;
  xDomain: [number, number];
  yDomain: [number, number];
  color: string;
  width?: number;
  height?: number;
}) {
  const t = useTheme();
  const pad = { l: 30, r: 10, t: 10, b: 28 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const sx = (x: number) => pad.l + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * w;
  const sy = (y: number) => pad.t + h - ((y - yDomain[0]) / (yDomain[1] - yDomain[0])) * h;
  return (
    <View>
      <View aria-hidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + h} stroke={t.border} />
          <Line x1={pad.l} x2={pad.l + w} y1={pad.t + h} y2={pad.t + h} stroke={t.border} />
          {points.map((p, i) => (
            <Circle key={i} cx={sx(p.x) + ((i % 3) - 1) * 1.5} cy={sy(p.y) + ((i % 5) - 2) * 1.2} r={4} fill={color} opacity={0.55} />
          ))}
          <SvgText x={pad.l + w / 2} y={height - 6} fontSize={10.5} fill={t.textSoft} textAnchor="middle">
            {xLabel}
          </SvgText>
          <SvgText x={10} y={pad.t + h / 2} fontSize={10.5} fill={t.textSoft} textAnchor="middle" rotation={-90} originX={10} originY={pad.t + h / 2}>
            {yLabel}
          </SvgText>
          {[xDomain[0], xDomain[1]].map((x) => (
            <SvgText key={x} x={sx(x)} y={pad.t + h + 13} fontSize={10} fill={t.textSoft} textAnchor="middle">
              {x}
            </SvgText>
          ))}
          {[yDomain[0], yDomain[1]].map((y) => (
            <SvgText key={y} x={pad.l - 6} y={sy(y) + 4} fontSize={10} fill={t.textSoft} textAnchor="end">
              {y}
            </SvgText>
          ))}
        </Svg>
      </View>
    </View>
  );
}
