import type { ISODate } from '../lib/dates';

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy' | 'very_heavy';

export type Mood =
  | 'happy'
  | 'peaceful'
  | 'anxious'
  | 'sad'
  | 'irritated'
  | 'exhausted'
  | 'overwhelmed'
  | 'mixed';

export type MoodTag =
  | 'stress'
  | 'family'
  | 'relationships'
  | 'studies'
  | 'work'
  | 'sleep'
  | 'physical'
  | 'no_reason';

export type BodyRegion =
  | 'lower_abdomen'
  | 'left_pelvis'
  | 'right_pelvis'
  | 'lower_back'
  | 'upper_back'
  | 'legs'
  | 'breasts'
  | 'head';

export type PainQuality = 'sharp' | 'dull' | 'cramping' | 'throbbing' | 'burning';
export type PainOnset = 'just_now' | 'few_hours' | 'today' | 'yesterday' | 'several_days';
export type PainPattern = 'constant' | 'comes_and_goes';
export type DailyImpact = 'none' | 'a_little' | 'a_lot' | 'cannot_function';

export type Symptom =
  | 'cramps'
  | 'bloating'
  | 'headache'
  | 'fatigue'
  | 'acne'
  | 'tender_breasts'
  | 'back_pain'
  | 'nausea'
  | 'cravings'
  | 'insomnia'
  | 'dizziness'
  | 'fainting'
  | 'fever'
  | 'diarrhea';

export type Goal = 'cycle' | 'pain' | 'moods' | 'selfcare' | 'irregular' | 'everything';
export type Regularity = 'regular' | 'somewhat' | 'irregular' | 'unsure';
export type Language = 'en' | 'bn';
export type NotificationStyle = 'gentle' | 'discreet' | 'minimal' | 'none';
export type CareMode = 'everyday' | 'comfort' | 'quiet' | 'reflection';
export type DietPref = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'halal';
export type Allergy = 'nuts' | 'dairy' | 'eggs' | 'gluten' | 'fish' | 'soy';
export type ThemePref = 'system' | 'light' | 'dark';
export type TextScale = 1 | 1.15 | 1.3 | 1.5;
export type WearableMetric = 'sleep' | 'steps' | 'restingHr' | 'temperature';

/** Situations that make calendar-based phase estimates unreliable. */
export type PredictionCaveat =
  | 'hormonal_contraception'
  | 'postpartum'
  | 'breastfeeding'
  | 'pcos'
  | 'perimenopause'
  | 'recent_stop_contraception';

export interface Profile {
  name: string;
  ageRange: 'under_16' | '16_17' | '18_24' | '25_34' | '35_44' | '45_plus' | 'unsure' | null;
  goal: Goal;
  lastPeriodStart: ISODate | null;
  typicalCycleLength: number | null;
  typicalPeriodLength: number | null;
  regularity: Regularity;
  commonSymptoms: Symptom[];
  conditions: string[];
  caveats: PredictionCaveat[];
  diet: DietPref;
  allergies: Allergy[];
  foodRegion: 'bangladeshi' | 'international' | 'both';
  onboardedAt: string | null;
  isDemo: boolean;
}

export interface Settings {
  language: Language;
  theme: ThemePref;
  reduceMotion: boolean;
  haptics: boolean;
  notificationStyle: NotificationStyle;
  checkinReminderTime: string | null; // HH:mm
  quietHoursStart: string; // HH:mm
  quietHoursEnd: string;
  periodHeadsUp: boolean;
  careMode: CareMode;
  /** Consent flags — each one is independent and revocable. */
  aiEnabled: boolean;
  aiCloudConsent: boolean; // send messages to the remote AI service
  aiUseCycleContext: boolean;
  aiUseMoodPainContext: boolean;
  aiMemory: boolean; // keep conversation history
  journalThemeConsent: boolean; // let AI suggest themes from journal text
  aiResponseLength: 'short' | 'medium' | 'long';
  aiSpeak: boolean;
  aiEndpoint: string;
  appLock: 'off' | 'pin' | 'biometric';
  /** Speech-to-text may use the phone's online recognizer when offline recognition isn't available. */
  voiceAllowNetwork: boolean;
  /** Under-18s need a parent or guardian's agreement before cloud AI can be turned on. */
  guardianConsent: { name: string; relation: string; at: string } | null;
  /** Accessibility: extra text size on top of the phone's setting, stronger colours, bigger touch areas. */
  textScale: TextScale;
  highContrast: boolean;
  largeTargets: boolean;
  /** Wearables via Health Connect: read only, each metric opted into separately. */
  wearables: { enabled: boolean; metrics: WearableMetric[]; lastSync: string | null };
  /** Prediction Lab: shows experimental estimates next to the standard one. */
  predictionLab: boolean;
  /** Opt-in research: off by default, adults only, consent tied to a consent text version. */
  research: { consentVersion: number | null; consentedAt: string | null; receipts: ResearchReceipt[] };
}

export interface ResearchReceipt {
  id: string;
  /** Lets this phone ask the server to delete the contribution later. Never sent with the data. */
  deleteKey: string;
  sentAt: string;
  endpoint: string;
}

export interface PeriodDay {
  date: ISODate;
  flow: Flow;
}

export interface DayLog {
  date: ISODate;
  symptoms: Symptom[];
  energy: number | null; // 1-5
  sleepHours: number | null;
  activity: 'none' | 'light' | 'moderate' | 'active' | null;
  need: 'rest' | 'nourish' | 'connection' | 'movement' | 'quiet' | 'focus' | null;
  bbt: number | null; // optional °C
  lhTest: 'positive' | 'negative' | null;
  mucus: 'dry' | 'sticky' | 'creamy' | 'watery' | 'egg_white' | null;
  notes: string;
}

export interface MoodEntry {
  id: string;
  date: ISODate;
  createdAt: string;
  mood: Mood;
  intensity: number; // 1-5
  tags: MoodTag[];
  text: string;
  confirmedThemes: string[];
}

export interface PainEpisode {
  id: string;
  date: ISODate;
  createdAt: string;
  regions: BodyRegion[];
  intensity: number; // 0-10
  qualities: PainQuality[];
  onset: PainOnset | null;
  pattern: PainPattern | null;
  impact: DailyImpact | null;
  otherSymptoms: Symptom[];
  heavyBleeding: boolean; // soaking a pad/tampon every hour or less
  tried: string[];
  helped: string[];
  notes: string;
}

export interface ChatMessage {
  id: string;
  createdAt: string;
  role: 'user' | 'assistant';
  text: string;
  safety?: 'crisis' | 'urgent' | 'medical' | null;
  suggestions?: string[];
}

export interface InsightFeedback {
  id: string;
  status: 'dismissed' | 'helpful';
  updatedAt: string;
}

/** One day of wearable data, summarised on the phone. Raw readings are never stored. */
export interface WearableDay {
  date: ISODate;
  sleepMinutes: number | null;
  steps: number | null;
  restingHr: number | null;
  /** Night-time skin temperature difference from the device's baseline, °C. */
  tempDelta: number | null;
  /** Basal body temperature from a thermometer app, °C. */
  bbt: number | null;
  source: 'health_connect' | 'demo';
}

export interface Favorite {
  id: string; // meal id
  createdAt: string;
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  ageRange: null,
  goal: 'everything',
  lastPeriodStart: null,
  typicalCycleLength: null,
  typicalPeriodLength: null,
  regularity: 'unsure',
  commonSymptoms: [],
  conditions: [],
  caveats: [],
  diet: 'none',
  allergies: [],
  foodRegion: 'both',
  onboardedAt: null,
  isDemo: false,
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'system',
  reduceMotion: false,
  haptics: true,
  notificationStyle: 'discreet',
  checkinReminderTime: null,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  periodHeadsUp: true,
  careMode: 'everyday',
  aiEnabled: true,
  aiCloudConsent: false,
  aiUseCycleContext: true,
  aiUseMoodPainContext: true,
  aiMemory: true,
  journalThemeConsent: false,
  aiResponseLength: 'medium',
  aiSpeak: false,
  aiEndpoint: '',
  voiceAllowNetwork: false,
  guardianConsent: null,
  appLock: 'off',
  textScale: 1,
  highContrast: false,
  largeTargets: false,
  wearables: { enabled: false, metrics: [], lastSync: null },
  predictionLab: false,
  research: { consentVersion: null, consentedAt: null, receipts: [] },
};

export const EMPTY_DAY_LOG = (date: ISODate): DayLog => ({
  date,
  symptoms: [],
  energy: null,
  sleepHours: null,
  activity: null,
  need: null,
  bbt: null,
  lhTest: null,
  mucus: null,
  notes: '',
});
