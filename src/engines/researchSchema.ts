/**
 * The one shape of data that opt-in research may ever receive. Shared by the
 * app (which builds it) and the server (which rejects anything else), so a
 * field can only be added here, in the open, with a new consent version.
 *
 * No names, dates, free text, journal, chat, location, device or install ids.
 * Kept free of runtime imports so the Node server can load it directly.
 */
import type { Symptom } from '../data/types';

export const RESEARCH_SCHEMA = 'petal-research/v1';
export const RESEARCH_CONSENT_VERSION = 1;

export const AGE_BANDS = ['18_24', '25_34', '35_44', '45_plus'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** Symptoms that may be shared as yes/no flags (after randomised response). */
export const RESEARCH_SYMPTOMS: Symptom[] = ['cramps', 'bloating', 'headache', 'fatigue', 'acne', 'tender_breasts', 'back_pain', 'nausea', 'cravings', 'insomnia'];

/** Chance that a symptom flag is replaced by a coin flip before it leaves the phone. */
export const RANDOMIZE_P = 0.25;

export interface Contribution {
  schema: typeof RESEARCH_SCHEMA;
  consentVersion: number;
  ageBand: AgeBand;
  /** Up to 6 completed cycles, oldest first, with no dates. */
  cycles: { length: number; periodLength: number }[];
  /** Average logged pain (0–10, whole number) and days with pain per cycle, rounded. */
  pain: { average: number | null; daysPerCycle: number };
  /** Share of check-ins that were hard moods, in steps of 0.25. */
  hardMoodShare: number | null;
  /** Yes/no per symptom: "logged in at least 2 cycles", after randomised response. */
  symptoms: Record<string, boolean>;
  usesWearable: boolean;
}

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const keysExactly = (o: object, keys: string[]) => {
  const k = Object.keys(o);
  return k.length === keys.length && keys.every((x) => k.includes(x));
};

/** Accepts exactly the Contribution shape and nothing more. */
export function validateContribution(x: unknown): x is Contribution {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const c = x as Record<string, unknown>;
  if (!keysExactly(c, ['schema', 'consentVersion', 'ageBand', 'cycles', 'pain', 'hardMoodShare', 'symptoms', 'usesWearable'])) return false;
  if (c.schema !== RESEARCH_SCHEMA || c.consentVersion !== RESEARCH_CONSENT_VERSION) return false;
  if (!AGE_BANDS.includes(c.ageBand as AgeBand)) return false;
  if (!Array.isArray(c.cycles) || c.cycles.length < 2 || c.cycles.length > 6) return false;
  for (const cy of c.cycles) {
    if (!cy || typeof cy !== 'object' || !keysExactly(cy, ['length', 'periodLength'])) return false;
    if (!isInt(cy.length, 15, 90) || !isInt(cy.periodLength, 1, 15)) return false;
  }
  const p = c.pain as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || !keysExactly(p, ['average', 'daysPerCycle'])) return false;
  if (!(p.average === null || isInt(p.average, 0, 10)) || !isInt(p.daysPerCycle, 0, 31)) return false;
  if (!(c.hardMoodShare === null || [0, 0.25, 0.5, 0.75, 1].includes(c.hardMoodShare as number))) return false;
  const s = c.symptoms as Record<string, unknown> | null;
  if (!s || typeof s !== 'object' || Array.isArray(s) || !keysExactly(s, RESEARCH_SYMPTOMS)) return false;
  if (!Object.values(s).every((v) => typeof v === 'boolean')) return false;
  return typeof c.usesWearable === 'boolean';
}
