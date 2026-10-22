import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { planDictation, VOICE_COPY } from '../engines/voice';
import { useApp } from '../store/app';
import { useLocalize } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { tap } from './ui';

/**
 * Hold-free dictation: tap to start, tap to stop. Partial text streams into
 * the field through `onText`, appended to whatever was already typed.
 */
export function MicButton({ value, onText, onNotice }: { value: string; onText: (text: string) => void; onNotice: (msg: string | null) => void }) {
  const t = useTheme();
  const L = useLocalize();
  const lang = useApp((s) => s.settings.language);
  const allowNetwork = useApp((s) => s.settings.voiceAllowNetwork);
  const [listening, setListening] = useState(false);
  const base = useRef('');

  useSpeechRecognitionEvent('result', (e) => {
    const said = e.results[0]?.transcript ?? '';
    onText(base.current ? `${base.current} ${said}` : said);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error !== 'aborted' && e.error !== 'no-speech') onNotice(L(VOICE_COPY.unavailable));
  });

  const start = async () => {
    let caps = { available: false, onDevice: false, installedLocales: [] as string[] };
    try {
      const onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
      caps = {
        available: ExpoSpeechRecognitionModule.isRecognitionAvailable(),
        onDevice,
        installedLocales: onDevice ? (await ExpoSpeechRecognitionModule.getSupportedLocales({})).installedLocales : [],
      };
    } catch {
      // native module missing (e.g. Expo Go)
    }
    const plan = planDictation(caps, lang, allowNetwork);
    if (!plan.ok) {
      onNotice(L(plan.reason === 'unavailable' ? VOICE_COPY.unavailable : VOICE_COPY.needsConsent));
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;
    onNotice(null);
    base.current = value.trim();
    tap('select');
    ExpoSpeechRecognitionModule.start({
      lang: plan.locale,
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      requiresOnDeviceRecognition: plan.onDevice,
    });
    setListening(true);
  };

  const stop = () => {
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={L(listening ? VOICE_COPY.listening : VOICE_COPY.start)}
      accessibilityState={{ busy: listening }}
      onPress={listening ? stop : start}
      hitSlop={6}
      style={[styles.mic, { backgroundColor: listening ? t.primary : 'transparent', borderColor: listening ? t.primary : t.border }]}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Rect x={9} y={3} width={6} height={11} rx={3} fill={listening ? '#fff' : t.text} />
        <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={listening ? '#fff' : t.text} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mic: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
