import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { PetalBloom } from '../components/PetalCompass';
import { Button, T } from '../components/ui';
import { useApp } from '../store/app';
import { useMotionOff } from '../theme/useTheme';
import { fonts } from '../theme/tokens';

export default function Welcome() {
  const motionOff = useMotionOff();
  const [loading, setLoading] = useState(false);
  const scale = useSharedValue(motionOff ? 1 : 0.3);
  const rot = useSharedValue(motionOff ? 0 : -40);

  useEffect(() => {
    if (motionOff) return;
    scale.value = withSpring(1, { damping: 10, stiffness: 60 });
    rot.value = withTiming(0, { duration: 1600 });
  }, [motionOff, scale, rot]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${rot.value}deg` }] }));
  const enter = (d: number) => (motionOff ? undefined : FadeInDown.delay(d).duration(700));

  const demo = async () => {
    setLoading(true);
    await useApp.getState().loadDemo();
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <LinearGradient colors={['#FFF9F5', '#F7DCE5', '#E9E1F8']} style={{ flex: 1 }} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
      <SafeAreaView style={styles.root}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={style}>
            <PetalBloom phase="luteal" size={230} />
          </Animated.View>
          <Animated.View entering={enter(400)} style={{ alignItems: 'center', marginTop: 18 }}>
            <T v="display" center color="#49364B" accessibilityRole="header" style={{ fontSize: 44, lineHeight: 50 }}>
              Petal & Pulse
            </T>
            <T v="serifItalic" center color="#6E5A70" style={{ marginTop: 6 }}>
              More than your cycle. All of you.
            </T>
          </Animated.View>
        </View>
        <Animated.View entering={enter(900)} style={{ gap: 12 }}>
          <Button title="Begin, at my pace" onPress={() => router.push('/onboarding')} style={{ backgroundColor: '#49364B' }} />
          <Button kind="secondary" title="Explore the demo" onPress={demo} loading={loading} accessibilityHint="Loads a fictional user's synthetic sample data" />
          <T v="small" center color="#6E5A70" style={{ marginTop: 6, fontFamily: fonts.sans }}>
            No account needed. Your data stays on this phone, encrypted.
          </T>
        </Animated.View>
        {!motionOff && <Animated.View entering={FadeIn.delay(1400)} />}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, paddingBottom: 28 },
});
