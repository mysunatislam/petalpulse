/**
 * Privacy & Consent Engine (pure logic). Platform pieces (keystore, file
 * sharing, biometrics) live in src/lib/secure.ts and src/lib/share.ts.
 */
import type { Settings } from '../data/types';

export type ConsentKey =
  | 'aiCloudConsent'
  | 'aiUseCycleContext'
  | 'aiUseMoodPainContext'
  | 'aiMemory'
  | 'journalThemeConsent';

export const CONSENT_COPY: Record<ConsentKey, { title: string; detail: string }> = {
  aiCloudConsent: {
    title: 'Use cloud AI for Petal',
    detail:
      'Your messages are sent securely to our protected AI service to generate replies. They are not used for advertising or sold. Off means Petal runs simpler replies entirely on this phone.',
  },
  aiUseCycleContext: {
    title: 'Let Petal see my cycle summary',
    detail: 'Shares only your cycle day, estimated phase and prediction window, never the full calendar.',
  },
  aiUseMoodPainContext: {
    title: 'Let Petal see recent moods, pain & sleep',
    detail: 'Shares your last 7 mood check-ins, last 5 pain logs, and average sleep so replies can be more personal.',
  },
  aiMemory: {
    title: 'Remember our conversations',
    detail: 'Keeps chat history on this phone and sends recent messages for context. Off means each chat starts fresh and history is cleared.',
  },
  journalThemeConsent: {
    title: 'Suggest themes from my journal',
    detail: 'Petal may suggest possible themes from your written reflections. You always confirm or correct them.',
  },
};

/** What would be sent to an AI service right now, in plain language. */
export function describeSharing(s: Pick<Settings, ConsentKey | 'aiEnabled'>): string[] {
  if (!s.aiEnabled) return ['Petal AI is turned off. Nothing is shared.'];
  if (!s.aiCloudConsent) return ['Petal replies on this phone only. Nothing leaves your device.'];
  const out = ['The message you type'];
  if (s.aiMemory) out.push('Your last 12 chat messages');
  if (s.aiUseCycleContext) out.push('Your cycle day, estimated phase and next-period window');
  if (s.aiUseMoodPainContext) out.push('Recent moods, pain logs and average sleep');
  out.push('Never: your name in full records, contact details, location, or journal entries');
  return out;
}

/** Turning off a parent consent also turns off the things that depend on it. */
export function applyConsentChange(s: Settings, key: ConsentKey | 'aiEnabled', value: boolean): Settings {
  const next: Settings = { ...s, [key]: value };
  if (key === 'aiEnabled' && !value) {
    next.aiCloudConsent = false;
  }
  return next;
}

export function isMinor(ageRange: string | null): boolean {
  return ageRange === 'under_16' || ageRange === '16_17';
}

/* PIN handling: never stored in plain text. */
export function validatePin(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return 'Use 4 to 6 digits.';
  if (/^(\d)\1+$/.test(pin)) return 'Avoid repeating the same digit.';
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'Avoid simple sequences.';
  return null;
}

export const DATA_PROMISES = [
  'Your data lives on this phone first, encrypted at rest.',
  'No account needed. Guest mode is the default.',
  'We never sell personal health data.',
  'No advertising trackers can access your reproductive health information.',
  'You can export everything or delete everything, anytime.',
];
