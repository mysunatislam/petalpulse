import type { CareMode, DailyImpact, Flow, MoodTag, PainOnset, PainPattern, PainQuality, Symptom } from '../data/types';

export const SYMPTOM_LABEL: Record<Symptom, string> = {
  cramps: 'Cramps',
  bloating: 'Bloating',
  headache: 'Headache',
  fatigue: 'Tiredness',
  acne: 'Skin changes',
  tender_breasts: 'Tender breasts',
  back_pain: 'Back pain',
  nausea: 'Nausea',
  cravings: 'Cravings',
  insomnia: 'Trouble sleeping',
  dizziness: 'Dizziness',
  fainting: 'Fainting',
  fever: 'Fever',
  diarrhea: 'Diarrhoea',
};

export const FLOW_LABEL: Record<Flow, string> = {
  spotting: 'Spotting',
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
  very_heavy: 'Very heavy',
};

export const FLOW_COLOR: Record<Flow, string> = {
  spotting: '#F7DCE5',
  light: '#F0BFD0',
  medium: '#E3A1B8',
  heavy: '#D07F9C',
  very_heavy: '#B5607F',
};

export const TAG_LABEL: Record<MoodTag, string> = {
  stress: 'Stress',
  family: 'Family',
  relationships: 'Relationships',
  studies: 'Studies',
  work: 'Work',
  sleep: 'Sleep',
  physical: 'Physical discomfort',
  no_reason: 'No particular reason',
};

export const QUALITY_LABEL: Record<PainQuality, string> = {
  sharp: 'Sharp',
  dull: 'Dull',
  cramping: 'Cramping',
  throbbing: 'Throbbing',
  burning: 'Burning',
};

export const ONSET_LABEL: Record<PainOnset, string> = {
  just_now: 'Suddenly, just now',
  few_hours: 'A few hours ago',
  today: 'Earlier today',
  yesterday: 'Yesterday',
  several_days: 'Several days ago',
};

export const PATTERN_LABEL: Record<PainPattern, string> = {
  constant: 'Constant',
  comes_and_goes: 'Comes and goes',
};

export const IMPACT_LABEL: Record<DailyImpact, string> = {
  none: 'Not at all',
  a_little: 'A little',
  a_lot: 'A lot',
  cannot_function: 'I can’t do my usual things',
};

export function modeLabel(m: CareMode | string) {
  return m === 'comfort' ? 'Comfort Mode' : m === 'quiet' ? 'Quiet Mode' : m === 'reflection' ? 'Reflection Mode' : 'Everyday Mode';
}
