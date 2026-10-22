import React, { useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Fraunces_400Regular_Italic, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { NotoSansBengali_400Regular, NotoSansBengali_500Medium, NotoSansBengali_600SemiBold } from '@expo-google-fonts/noto-sans-bengali';
import { NotoSerifBengali_600SemiBold } from '@expo-google-fonts/noto-serif-bengali';
import { useApp } from '../store/app';
import { useTheme } from '../theme/useTheme';
import { LockScreen } from '../components/LockScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    NotoSansBengali_400Regular,
    NotoSansBengali_500Medium,
    NotoSansBengali_600SemiBold,
    NotoSerifBengali_600SemiBold,
  });
  const ready = useApp((s) => s.ready);
  const unlocked = useApp((s) => s.unlocked);
  const appLock = useApp((s) => s.settings.appLock);
  const t = useTheme();
  const bgAt = useRef<number | null>(null);

  useEffect(() => {
    useApp.getState().load().catch((e) => console.error('Failed to load data', e));
  }, []);

  useEffect(() => {
    if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, ready]);

  // Re-lock after 60 seconds in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') bgAt.current = Date.now();
      if (s === 'active' && bgAt.current && Date.now() - bgAt.current > 60_000 && useApp.getState().settings.appLock !== 'off') {
        useApp.getState().setUnlocked(false);
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded || !ready) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {appLock !== 'off' && !unlocked ? (
        <LockScreen />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: 'fade_from_bottom' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="pain/log" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checkin" options={{ presentation: 'modal' }} />
        </Stack>
      )}
    </SafeAreaProvider>
  );
}
