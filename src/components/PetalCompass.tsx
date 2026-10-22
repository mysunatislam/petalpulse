import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import type { CycleStatus, Phase } from '../engines/cycle';
import { num } from '../lib/dates';
import { PHASE_PETALS } from '../theme/tokens';
import { useMotionOff, useTheme } from '../theme/useTheme';
import { T } from './ui';

const petalPath = (len: number, width: number) =>
  `M 0 0 C ${-width} ${-len * 0.35}, ${-width * 0.85} ${-len * 0.88}, 0 ${-len} C ${width * 0.85} ${-len * 0.88}, ${width} ${-len * 0.35}, 0 0 Z`;

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/** The signature bloom. Phase colours are a visual metaphor, not hormone readings. */
export function PetalBloom({ phase, size = 220, openness = 1 }: { phase: Phase; size?: number; openness?: number }) {
  const colors = PHASE_PETALS[phase];
  const c = size / 2;
  const outerLen = size * 0.4 * openness;
  const innerLen = size * 0.27 * openness;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="core" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFF9F5" stopOpacity={1} />
          <Stop offset="1" stopColor={colors.core} stopOpacity={1} />
        </RadialGradient>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.glow} stopOpacity={0.9} />
          <Stop offset="1" stopColor={colors.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={size * 0.49} fill="url(#glow)" />
      <G transform={`translate(${c} ${c})`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <G key={`o${i}`} transform={`rotate(${i * 45})`}>
            <Path d={petalPath(outerLen, outerLen * 0.42)} fill={colors.petals[i % 2]} opacity={0.88} />
          </G>
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <G key={`i${i}`} transform={`rotate(${i * 45 + 22.5})`}>
            <Path d={petalPath(innerLen, innerLen * 0.45)} fill={colors.petals[2]} opacity={0.95} />
          </G>
        ))}
        <Circle r={size * 0.095} fill="url(#core)" />
      </G>
    </Svg>
  );
}

export function PetalCompass({ status, size = 300 }: { status: CycleStatus; size?: number }) {
  const t = useTheme();
  const motionOff = useMotionOff();
  const phase = status.phase;
  const scale = useSharedValue(motionOff ? 1 : 0.7);
  const rot = useSharedValue(0);
  const breathe = useSharedValue(1);

  useEffect(() => {
    if (motionOff) {
      scale.value = 1;
      rot.value = 0;
      breathe.value = 1;
      return;
    }
    scale.value = 0.82;
    scale.value = withSpring(1, { damping: 12, stiffness: 90 });
    rot.value = withRepeat(withTiming(360, { duration: 120000, easing: Easing.linear }), -1);
    breathe.value = withDelay(600, withRepeat(withSequence(withTiming(1.035, { duration: 2600 }), withTiming(1, { duration: 2600 })), -1));
  }, [phase, motionOff, scale, rot, breathe]);

  const bloomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * breathe.value }, { rotate: `${rot.value}deg` }],
  }));

  const ring = useMemo(() => {
    const L = Math.max(21, Math.round(status.stats.median ?? 28));
    const day = status.cycleDay;
    const per = Math.round(status.lastPeriod?.length ?? 5);
    const segs: { from: number; to: number; color: string }[] = [];
    if (status.phaseLimited || !status.ovulationWindow || !status.lastPeriod) {
      segs.push({ from: 0, to: per, color: PHASE_PETALS.menstrual.petals[1] });
      segs.push({ from: per, to: L, color: t.dark ? '#4A3B4D' : '#EADDE5' });
    } else {
      const start = status.lastPeriod.start;
      const ovS = Math.round((Date.parse(status.ovulationWindow.start) - Date.parse(start)) / 86400000);
      const ovE = Math.round((Date.parse(status.ovulationWindow.end) - Date.parse(start)) / 86400000) + 1;
      segs.push({ from: 0, to: per, color: PHASE_PETALS.menstrual.petals[1] });
      segs.push({ from: per, to: Math.max(per, ovS), color: PHASE_PETALS.follicular.petals[1] });
      segs.push({ from: Math.max(per, ovS), to: ovE, color: PHASE_PETALS.ovulatory.petals[1] });
      segs.push({ from: ovE, to: L, color: PHASE_PETALS.luteal.petals[1] });
    }
    return { L, day, segs };
  }, [status, t.dark]);

  const c = size / 2;
  const r = size / 2 - 10;
  const gap = 0.025;
  const markerAngle = ring.day ? (Math.min(ring.day, ring.L) - 0.5) / ring.L * Math.PI * 2 : null;

  const label = status.cycleDay
    ? `Cycle day ${status.cycleDay}. ${status.phaseLimited && phase === 'unknown' ? 'Phase estimate not shown yet.' : `Estimated phase: ${phase}.`}`
    : 'No cycle data yet.';

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }} accessible accessibilityRole="image" accessibilityLabel={`Petal Compass. ${label}`}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {ring.segs.map((s, i) =>
          s.to > s.from ? (
            <Path
              key={i}
              d={arc(c, c, r, (s.from / ring.L) * Math.PI * 2 + gap, (s.to / ring.L) * Math.PI * 2 - gap)}
              stroke={s.color}
              strokeWidth={7}
              strokeLinecap="round"
              fill="none"
            />
          ) : null,
        )}
        {markerAngle !== null && (
          <>
            <Circle cx={c + r * Math.sin(markerAngle)} cy={c - r * Math.cos(markerAngle)} r={11} fill={t.surface} stroke={t.accent} strokeWidth={3} />
            <Circle cx={c + r * Math.sin(markerAngle)} cy={c - r * Math.cos(markerAngle)} r={4} fill={t.accent} />
          </>
        )}
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: 30, top: 30 }, bloomStyle]}>
        <PetalBloom phase={phase} size={size - 60} />
      </Animated.View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
        <View style={{ backgroundColor: t.dark ? 'rgba(44,33,48,0.86)' : 'rgba(255,249,245,0.9)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 }}>
          <T v="eyebrow" soft center>
            {status.cycleDay ? 'Cycle day' : 'Begin'}
          </T>
          <T v="display" center style={{ fontSize: 42, lineHeight: 46 }}>
            {status.cycleDay ? num(status.cycleDay) : '✿'}
          </T>
        </View>
      </View>
    </View>
  );
}
