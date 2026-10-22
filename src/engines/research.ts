/**
 * Opt-in research (Stage 3)
 *
 * Off by default. Adults only, never demo data, and only after the person has
 * read and agreed to the current consent text. Before anything is sent the
 * person sees the exact contribution, and each one carries a delete key that
 * stays on the phone so it can be removed later. Contributions are not linked
 * to each other or to the AI token: no install id, no account.
 *
 * Privacy steps on the phone (data minimisation first, then noise):
 *  - only summaries: cycle and period lengths without dates, rounded pain,
 *    a coarse share of hard moods, an age band;
 *  - symptom flags go through randomised response: with probability
 *    RANDOMIZE_P a flag is replaced by a coin flip, so no single answer can be
 *    taken at face value (local differential privacy, ε = ln 7 ≈ 1.95);
 *  - nothing from the journal, chat, notes, wearables or settings.
 */
import type { DayLog, MoodEntry, PainEpisode, Profile, Settings } from '../data/types';
import { buildCycles, Period } from './cycle';
import { isMinor } from './privacy';
import { SYMPTOM_LABEL } from '../lib/labels';
import { AgeBand, AGE_BANDS, Contribution, RANDOMIZE_P, RESEARCH_CONSENT_VERSION, RESEARCH_SCHEMA, RESEARCH_SYMPTOMS } from './researchSchema';

export { RESEARCH_CONSENT_VERSION };

export const RESEARCH_COPY = {
  title: 'Help menstrual health research',
  intro:
    'Very little research looks at everyday cycles, pain and moods, especially in South Asia. If you choose to, you can share a small, de-identified summary to help change that.',
  shared: [
    'Your age band (for example 18–24)',
    'Up to 6 cycle and period lengths, without dates',
    'Average pain and days with pain per cycle, rounded',
    'Roughly what share of your check-ins were hard days',
    'Which common symptoms come back, with random noise added on this phone',
    'Whether you use a wearable (yes or no)',
  ],
  never: [
    'Your name, dates, journal, chats, notes or exact readings',
    'Wearable data, location, contacts or anything that identifies your phone',
    'Anything at all until you look at it and press Send',
  ],
  noise: 'Before it leaves your phone, each symptom answer has a 1 in 4 chance of being replaced by a coin flip. Researchers can still see patterns across many people, but no single answer can be trusted to be yours.',
  withdraw: 'You can stop at any time. Each contribution comes with a delete key kept only on this phone, so you can also ask for everything you sent to be deleted.',
  adults: 'Research is for adults 18 and over.',
  demo: 'Demo data can’t be contributed. Leave demo mode to take part.',
  unsureAge: 'Add your age range in Settings first. Research is for adults 18 and over.',
  notEnough: 'Log at least two full cycles first, so there is something to share.',
  noEndpoint: 'Research isn’t open yet. When a study is ready it will appear here.',
  consent: 'I’ve read what is shared and what isn’t, and I agree to share de-identified summaries for menstrual health research.',
};

export type Eligibility = { ok: true; band: AgeBand } | { ok: false; reason: string };

export function researchEligible(profile: Pick<Profile, 'ageRange' | 'isDemo'>): Eligibility {
  if (profile.isDemo) return { ok: false, reason: RESEARCH_COPY.demo };
  if (!profile.ageRange || profile.ageRange === 'unsure') return { ok: false, reason: RESEARCH_COPY.unsureAge };
  if (isMinor(profile.ageRange)) return { ok: false, reason: RESEARCH_COPY.adults };
  const band = profile.ageRange as AgeBand;
  return AGE_BANDS.includes(band) ? { ok: true, band } : { ok: false, reason: RESEARCH_COPY.adults };
}

export function hasResearchConsent(s: Pick<Settings, 'research'>): boolean {
  return s.research.consentVersion === RESEARCH_CONSENT_VERSION;
}

export function giveResearchConsent(s: Settings, now = new Date()): Settings {
  return { ...s, research: { ...s.research, consentVersion: RESEARCH_CONSENT_VERSION, consentedAt: now.toISOString() } };
}

/** Stops future sharing. Receipts stay so past contributions can still be deleted. */
export function withdrawResearchConsent(s: Settings): Settings {
  return { ...s, research: { ...s.research, consentVersion: null, consentedAt: null } };
}

const BAND_LABEL: Record<AgeBand, string> = { '18_24': '18–24', '25_34': '25–34', '35_44': '35–44', '45_plus': '45 and over' };

const LOW = ['irritated', 'anxious', 'sad', 'exhausted', 'overwhelmed'];

export interface ResearchInput {
  profile: Pick<Profile, 'ageRange' | 'isDemo'>;
  settings: Pick<Settings, 'research' | 'wearables'>;
  periods: Period[];
  dayLogs: DayLog[];
  moods: MoodEntry[];
  pain: PainEpisode[];
}

/**
 * Builds the contribution, or explains why there is none. `random` is
 * injectable so tests can check the randomised response.
 */
export function buildContribution(input: ResearchInput, random: () => number = Math.random): Contribution | { error: string } {
  const elig = researchEligible(input.profile);
  if (!elig.ok) return { error: elig.reason };
  if (!hasResearchConsent(input.settings)) return { error: 'Agree to the research consent first.' };
  const cycles = buildCycles(input.periods).filter((c) => c.length !== null && !c.excluded).slice(-6);
  if (cycles.length < 2) return { error: RESEARCH_COPY.notEnough };

  const from = cycles[0].start;
  const to = cycles[cycles.length - 1].nextStart as string;
  const inRange = (d: string) => d >= from && d < to;
  const eps = input.pain.filter((e) => inRange(e.date));
  const painDays = new Set(eps.map((e) => e.date)).size;
  const moods = input.moods.filter((m) => inRange(m.date));

  // Symptom flag: logged in at least 2 of these cycles.
  const truth: Record<string, boolean> = {};
  for (const sym of RESEARCH_SYMPTOMS) {
    const hits = cycles.filter((c) => input.dayLogs.some((l) => l.date >= c.start && l.date < (c.nextStart as string) && l.symptoms.includes(sym))).length;
    truth[sym] = hits >= 2;
  }
  const symptoms: Record<string, boolean> = {};
  for (const sym of RESEARCH_SYMPTOMS) symptoms[sym] = random() < RANDOMIZE_P ? random() < 0.5 : truth[sym];

  return {
    schema: RESEARCH_SCHEMA,
    consentVersion: RESEARCH_CONSENT_VERSION,
    ageBand: elig.band,
    cycles: cycles.map((c) => ({ length: c.length as number, periodLength: Math.min(15, Math.max(1, c.periodLength)) })),
    pain: {
      average: eps.length ? Math.round(eps.reduce((a, e) => a + e.intensity, 0) / eps.length) : null,
      daysPerCycle: Math.round(painDays / cycles.length),
    },
    hardMoodShare: moods.length >= 8 ? Math.round((moods.filter((m) => LOW.includes(m.mood)).length / moods.length) * 4) / 4 : null,
    symptoms,
    usesWearable: input.settings.wearables.enabled,
  };
}

/** What the person sees before sending: the contribution in plain words. */
export function describeContribution(c: Contribution): string[] {
  const on = Object.entries(c.symptoms).filter(([, v]) => v).map(([k]) => SYMPTOM_LABEL[k as keyof typeof SYMPTOM_LABEL].toLowerCase());
  return [
    `Age band: ${BAND_LABEL[c.ageBand]}`,
    `Cycle lengths: ${c.cycles.map((x) => x.length).join(', ')} days`,
    `Period lengths: ${c.cycles.map((x) => x.periodLength).join(', ')} days`,
    c.pain.average === null ? 'Pain: none logged' : `Pain: about ${c.pain.average}/10 on average, about ${c.pain.daysPerCycle} days per cycle`,
    c.hardMoodShare === null ? 'Moods: not enough check-ins to share' : `Hard days: about ${Math.round(c.hardMoodShare * 100)}% of check-ins`,
    `Symptoms that come back (with noise): ${on.length ? on.join(', ') : 'none'}`,
    `Uses a wearable: ${c.usesWearable ? 'yes' : 'no'}`,
  ];
}
