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

export function isMinor(ageRange: string | null): boolean {
  return ageRange === 'under_16' || ageRange === '16_17';
}

/** Under-18s need a parent or guardian's agreement before anything goes to cloud AI. */
export function needsGuardian(s: Pick<Settings, 'guardianConsent'>, ageRange: string | null): boolean {
  return isMinor(ageRange) && !s.guardianConsent;
}

/** Whether messages may go to the cloud right now. Checked again at send time. */
export function cloudAllowed(s: Pick<Settings, 'aiEnabled' | 'aiCloudConsent' | 'guardianConsent'>, ageRange: string | null): boolean {
  return s.aiEnabled && s.aiCloudConsent && !needsGuardian(s, ageRange);
}

/**
 * Turning off a parent consent also turns off the things that depend on it.
 * A minor can't turn cloud AI on here: that goes through the guardian step.
 */
export function applyConsentChange(s: Settings, key: ConsentKey | 'aiEnabled', value: boolean, ageRange: string | null = null): Settings {
  if (key === 'aiCloudConsent' && value && needsGuardian(s, ageRange)) return s;
  const next: Settings = { ...s, [key]: value };
  if (key === 'aiEnabled' && !value) {
    next.aiCloudConsent = false;
  }
  return next;
}

export const GUARDIAN_RELATIONS = ['Mother', 'Father', 'Legal guardian', 'Other trusted adult'] as const;

export function recordGuardianConsent(s: Settings, guardian: { name: string; relation: string }, now = new Date()): Settings | string {
  const name = guardian.name.trim();
  if (name.length < 2) return 'Please add the parent or guardian’s name.';
  if (!guardian.relation) return 'Please choose how they’re related to you.';
  return { ...s, guardianConsent: { name: name.slice(0, 60), relation: guardian.relation, at: now.toISOString() }, aiCloudConsent: true };
}

/** Withdrawing guardian agreement switches cloud AI off straight away. */
export function withdrawGuardianConsent(s: Settings): Settings {
  return { ...s, guardianConsent: null, aiCloudConsent: false };
}

export const GUARDIAN_COPY = {
  title: 'Ask a parent or guardian',
  intro: 'Because you’re under 18, a parent or guardian needs to agree before Petal uses cloud AI. Please read this together.',
  points: [
    'Petal is an AI companion, not a doctor, nurse or counsellor.',
    'With cloud AI on, the messages you type to Petal are sent securely to our AI service to write replies. They aren’t sold or used for ads.',
    'Cycle, mood and pain details are only shared if you also turn those switches on.',
    'Journal entries, contacts and location are never sent.',
    'If a message sounds like someone may be in danger, Petal shows emergency and support contacts.',
    'You can switch cloud AI off at any time, and Petal keeps working on this phone.',
  ],
  confirm: 'I’m the parent or guardian. I’ve read this with them and I agree to cloud AI.',
  device: 'Not now? Petal still works fully on this phone without cloud AI.',
};

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
