import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../store/app';
import { useTheme } from '../theme/useTheme';
import { biometricUnlock, checkPin } from '../lib/secure';
import { PetalBloom } from './PetalCompass';
import { Button, T, tap } from './ui';

export function LockScreen() {
  const t = useTheme();
  const mode = useApp((s) => s.settings.appLock);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const tryBio = async () => {
    if (await biometricUnlock()) useApp.getState().setUnlocked(true);
  };

  useEffect(() => {
    if (mode === 'biometric') tryBio();
  }, [mode]);

  const press = async (d: string) => {
    tap('select');
    const next = (pin + d).slice(0, 6);
    setPin(next);
    setError('');
    if (next.length >= 4) {
      const ok = await checkPin(next);
      if (ok) useApp.getState().setUnlocked(true);
      else if (next.length === 6) {
        setAttempts((a) => a + 1);
        setPin('');
        setError('That PIN didn’t match. Try again.');
      }
    }
  };

  return (
    <LinearGradient colors={t.gradient} style={styles.root}>
      <PetalBloom phase="unknown" size={140} />
      <T v="h1" center style={{ marginTop: 8 }}>
        Welcome back
      </T>
      <T v="body" muted center style={{ marginBottom: 20 }}>
        Enter your PIN to open your space
      </T>
      <View style={styles.dots} accessibilityLabel={`${pin.length} digits entered`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < pin.length ? t.primary : t.border }]} />
        ))}
      </View>
      {error ? (
        <T v="small" color={t.danger} accessibilityRole="alert">
          {error}
        </T>
      ) : (
        <T v="small"> </T>
      )}
      <View style={styles.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === '⌫' ? 'Delete' : k}
              onPress={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : press(k))}
              style={({ pressed }) => [styles.key, { backgroundColor: pressed ? t.blush : t.surfaceGlass }]}
            >
              <T v="h2">{k}</T>
            </Pressable>
          ),
        )}
      </View>
      {mode === 'biometric' && <Button kind="ghost" title="Use fingerprint or face" onPress={tryBio} />}
      {attempts >= 3 && (
        <T v="small" muted center style={{ marginTop: 10, maxWidth: 300 }}>
          Forgot your PIN? For your privacy it can’t be recovered. You can reinstall the app, which permanently deletes your data.
        </T>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dots: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 264, gap: 12, justifyContent: 'center', marginVertical: 16 },
  key: { width: 76, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
