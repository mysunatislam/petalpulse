import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, cancelAnimation } from 'react-native-reanimated';
import { Button, Gap, Screen, T, tap } from '../components/ui';
import { PetalBloom } from '../components/PetalCompass';
import { useMotionOff } from '../theme/useTheme';

const STEPS = [
  { label: 'Breathe in', secs: 4, to: 1.25 },
  { label: 'Hold', secs: 4, to: 1.25 },
  { label: 'Breathe out', secs: 6, to: 0.85 },
] as const;

export default function Breathe() {
  const motionOff = useMotionOff();
  const [running, setRunning] = useState(false);
  const [i, setI] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [left, setLeft] = useState<number>(STEPS[0].secs);
  const scale = useSharedValue(0.85);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    const step = STEPS[i];
    tap('light');
    if (!motionOff) scale.value = withTiming(step.to, { duration: step.secs * 1000, easing: Easing.inOut(Easing.quad) });
    timer.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    const next = setTimeout(() => {
      if (i === STEPS.length - 1) {
        setRounds(rounds + 1);
        if (rounds + 1 >= 5) {
          setRunning(false);
          return;
        }
      }
      const n = (i + 1) % STEPS.length;
      setLeft(STEPS[n].secs);
      setI(n);
    }, step.secs * 1000);
    return () => {
      clearTimeout(next);
      if (timer.current) clearInterval(timer.current);
    };
  }, [running, i, rounds, motionOff, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Screen title="Breathe with me" eyebrow="A calming minute" calm>
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Animated.View style={style}>
          <PetalBloom phase="ovulatory" size={220} />
        </Animated.View>
        <Gap h={24} />
        <T v="h1" center accessibilityLiveRegion="polite">
          {running ? STEPS[i].label : rounds >= 5 ? 'Well done 🌸' : 'Ready when you are'}
        </T>
        <T v="h2" muted center>
          {running ? left : ' '}
        </T>
        <Gap h={10} />
        <T v="body" muted center>
          {rounds >= 5 && !running ? 'Notice how your body feels now. Nothing needs to be different.' : 'In for 4, hold for 4, out for 6. Let your shoulders soften.'}
        </T>
        <Gap h={24} />
        <Button
          title={running ? 'Pause' : rounds > 0 ? 'Begin again' : 'Begin'}
          onPress={() => {
            if (running) {
              cancelAnimation(scale);
              setRunning(false);
            } else {
              if (rounds >= 5) setRounds(0);
              setI(0);
              setLeft(STEPS[0].secs);
              setRunning(true);
            }
          }}
          style={{ alignSelf: 'stretch' }}
        />
        <T v="small" soft center style={{ marginTop: 10 }}>
          Round {Math.min(rounds + (running ? 1 : 0), 5)} of 5
        </T>
      </View>
    </Screen>
  );
}
