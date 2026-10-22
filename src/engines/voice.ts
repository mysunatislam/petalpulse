/**
 * Voice input policy. Speech is turned into text on the phone whenever the
 * phone can do that offline. Online recognition (Android's speech service,
 * usually Google) sends audio off the device, so it needs the person's
 * explicit permission. No audio is ever recorded or kept by the app.
 */
export interface VoiceCaps {
  available: boolean;
  onDevice: boolean;
  /** Locales installed for offline recognition, e.g. ["en-US", "bn-BD"]. */
  installedLocales: string[];
}

export type VoicePlan =
  | { ok: true; onDevice: boolean; locale: string }
  | { ok: false; reason: 'unavailable' | 'needs-network-consent' };

export function voiceLocale(lang: 'en' | 'bn'): string {
  return lang === 'bn' ? 'bn-BD' : 'en-US';
}

function hasLocale(installed: string[], locale: string): boolean {
  const base = locale.split('-')[0].toLowerCase();
  return installed.some((l) => l.toLowerCase() === locale.toLowerCase() || l.toLowerCase().split(/[-_]/)[0] === base);
}

export function planDictation(caps: VoiceCaps, lang: 'en' | 'bn', allowNetwork: boolean): VoicePlan {
  const locale = voiceLocale(lang);
  if (!caps.available) return { ok: false, reason: 'unavailable' };
  if (caps.onDevice && hasLocale(caps.installedLocales, locale)) return { ok: true, onDevice: true, locale };
  if (allowNetwork) return { ok: true, onDevice: false, locale };
  return { ok: false, reason: 'needs-network-consent' };
}

export const VOICE_COPY = {
  unavailable: 'Voice typing isn’t available on this phone. You can still type.',
  needsConsent:
    'Your phone can’t turn speech into text offline in this language. You can allow online speech recognition in Settings › Petal AI & privacy. Your audio would go to your phone’s speech service, not to us.',
  networkToggle: 'Allow online speech recognition',
  networkDetail:
    'Used only if your phone can’t recognise speech offline. Audio goes to your phone’s speech service (usually Google), not to Petal & Pulse. Nothing is recorded or saved.',
  listening: 'Listening… tap again to stop',
  start: 'Speak instead of typing',
};
