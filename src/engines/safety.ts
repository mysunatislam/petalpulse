/**
 * Safety Engine
 *
 * Rule-based and deterministic on purpose: safety decisions never depend on
 * a language model. These rules follow widely published patient guidance
 * (e.g. NHS, ACOG, WHO) for when menstrual pain or bleeding needs care.
 * They MUST be reviewed by a licensed clinician before public launch — see
 * docs/SAFETY.md.
 */
import type { PainEpisode, Symptom } from '../data/types';

export type CareLevel = 'emergency' | 'urgent' | 'appointment' | 'none';

export interface SafetyResult {
  level: CareLevel;
  reasons: string[];
  headline: string;
  guidance: string;
}

const LEVEL_RANK: Record<CareLevel, number> = { none: 0, appointment: 1, urgent: 2, emergency: 3 };

function max(a: CareLevel, b: CareLevel): CareLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

const COPY: Record<CareLevel, { headline: string; guidance: string }> = {
  emergency: {
    headline: 'Please get medical help now',
    guidance:
      'What you’ve described can need urgent care. Call your local emergency number (999 in Bangladesh) or go to the nearest emergency department. If you can, ask someone to stay with you.',
  },
  urgent: {
    headline: 'Please see a doctor today',
    guidance:
      'This is worth getting checked soon, ideally today. Contact a doctor, a clinic, or an urgent care service. If it gets worse or you feel faint, seek emergency care.',
  },
  appointment: {
    headline: 'Worth talking to a health professional',
    guidance:
      'Pain that affects your daily life is not something you simply have to endure. Consider booking an appointment. Your Pain Passport can help you explain what’s been happening.',
  },
  none: { headline: '', guidance: '' },
};

export interface PainContext {
  /** Previous episodes, most recent last, used to spot worsening trends. */
  history?: PainEpisode[];
  possiblePregnancy?: boolean;
}

export function assessPain(ep: Pick<PainEpisode, 'intensity' | 'onset' | 'impact' | 'otherSymptoms' | 'heavyBleeding' | 'regions' | 'qualities'>, ctx: PainContext = {}): SafetyResult {
  let level: CareLevel = 'none';
  const reasons: string[] = [];
  const sym = new Set<Symptom>(ep.otherSymptoms);
  const pelvic = ep.regions.some((r) => r === 'lower_abdomen' || r === 'left_pelvis' || r === 'right_pelvis');
  const oneSided = ep.regions.includes('left_pelvis') !== ep.regions.includes('right_pelvis');

  if (sym.has('fainting')) {
    level = max(level, 'emergency');
    reasons.push('Fainting together with pain or bleeding');
  }
  if (pelvic && ep.intensity >= 8 && ep.onset === 'just_now') {
    level = max(level, 'emergency');
    reasons.push('Sudden, severe pelvic pain');
  }
  if (pelvic && oneSided && ep.intensity >= 7 && ctx.possiblePregnancy) {
    level = max(level, 'emergency');
    reasons.push('Severe one-sided pelvic pain when pregnancy is possible');
  }
  if (ep.heavyBleeding && (sym.has('dizziness') || ep.intensity >= 8)) {
    level = max(level, 'emergency');
    reasons.push('Very heavy bleeding with dizziness or severe pain');
  } else if (ep.heavyBleeding) {
    level = max(level, 'urgent');
    reasons.push('Very heavy bleeding (soaking a pad or tampon every hour)');
  }
  if (pelvic && sym.has('fever')) {
    level = max(level, 'urgent');
    reasons.push('Pelvic pain with fever');
  }
  if (ep.intensity >= 9) {
    level = max(level, 'urgent');
    reasons.push('Pain rated 9 or 10');
  }
  if (sym.has('dizziness') && ep.intensity >= 7) {
    level = max(level, 'urgent');
    reasons.push('Dizziness with strong pain');
  }
  if (ep.impact === 'cannot_function') {
    level = max(level, 'appointment');
    reasons.push('Pain stopping you from doing everyday things');
  }
  if (ep.intensity >= 7) {
    level = max(level, 'appointment');
    if (!reasons.length) reasons.push('Strong pain (7 or more out of 10)');
  }
  const hist = ctx.history ?? [];
  if (isWorsening(hist.concat([ep as PainEpisode]))) {
    level = max(level, 'appointment');
    reasons.push('Pain that seems to be getting worse over time');
  }

  return { level, reasons, ...COPY[level] };
}

/**
 * Worsening = the average intensity of the latest three episodes is at least
 * 2 points higher than the three before, with at least six episodes.
 */
export function isWorsening(episodes: Pick<PainEpisode, 'intensity'>[]): boolean {
  if (episodes.length < 6) return false;
  const last = episodes.slice(-3).map((e) => e.intensity);
  const prev = episodes.slice(-6, -3).map((e) => e.intensity);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return avg(last) - avg(prev) >= 2;
}

/* ------------------------------------------------------------------ */
/* Free-text checks for the companion and journal                      */
/* ------------------------------------------------------------------ */

export type TextRisk = 'crisis' | 'urgent_medical' | 'none';

const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm|cut)\s+(myself|my self)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend\s+(my|it all|my life)\b/i,
  /\b(want|wanna|going)\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be alive|exist|wake up)\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living|go on)\b/i,
  /\bbetter\s+off\s+(dead|without me)\b/i,
  /\bself[-\s]?harm/i,
  /\boverdose\b/i,
  /\b(someone|he|she|they|partner|husband|boyfriend)\s+(is\s+)?(hurting|hitting|beating|abusing)\s+me\b/i,
  // Bangla
  /আত্মহত্যা/,
  /মরে\s*যেতে\s*চাই/,
  /বাঁচতে\s*চাই\s*না/,
  /নিজেকে\s*(শেষ|আঘাত)/,
  /মরতে\s*চাই/,
  /বাঁচতে\s*(ইচ্ছা|ইচ্ছে)\s*করে\s*না/,
  /নিজের\s*ক্ষতি\s*কর/,
  /জীবন\s*শেষ\s*করে/,
  /আমাকে\s*ছাড়া\s*(সবাই\s*)?ভালো\s*থাকবে/,
  /(গায়ে\s*হাত\s*তোলে|মারধর\s*করে)/,
  // Banglish (Bangla typed in English letters)
  /\b(more|mor)\s*jete\s*chai\b/i,
  /\bmorte\s*chai\b/i,
  /\b(bachte|banchte)\s*(chai|icche|ichha|iccha)\s*(kore\s*)?na\b/i,
  /\ba+tmo\s*hott?a\b/i,
  /\bnijeke\s*(shesh|sesh|aghat|khoti)\b/i,
];

const URGENT_MEDICAL_PATTERNS: RegExp[] = [
  /\bfaint(ed|ing)?\b|\bpassed out\b|\bblack(ed)? out\b/i,
  /\bsoak(ing|ed)?\b.*\b(pad|tampon|every hour|hourly)\b/i,
  /\b(can'?t|cannot)\s+(breathe|stand up|walk)\b/i,
  /\b(worst|unbearable|excruciating)\s+pain\b/i,
  /\bsudden(ly)?\b.*\b(severe|sharp)\b.*\bpain\b/i,
  /\bpregnan(t|cy)\b.*\b(pain|bleed)/i,
  /\b(pain|bleed).*\bpregnan(t|cy)\b/i,
  /\bhigh fever\b|\bfever\b.*\bpelvic\b/i,
  /অজ্ঞান/,
  /প্রচুর\s*রক্ত/,
  /(অসহ্য|প্রচণ্ড|প্রচন্ড)\s*ব্যথা/,
  /(গর্ভবতী|প্রেগন্যান্ট).*(ব্যথা|রক্ত)/,
  /শ্বাস\s*নিতে\s*পারছি\s*না/,
  /\b(ojnan|ognan)\b/i,
  /\b(onek|prochur)\s*rokto\b/i,
  /\b(osojjo|oshojjo|prochondo)\s*(betha|batha|byatha)\b/i,
];

export function screenText(text: string): TextRisk {
  if (CRISIS_PATTERNS.some((r) => r.test(text))) return 'crisis';
  if (URGENT_MEDICAL_PATTERNS.some((r) => r.test(text))) return 'urgent_medical';
  return 'none';
}

export const CRISIS_RESOURCES = [
  { label: 'Emergency services (Bangladesh)', detail: 'Call 999', tel: '999' },
  { label: 'Kaan Pete Roi — emotional support (Bangladesh)', detail: 'Free, confidential listening service', tel: '09612119911' },
  { label: 'Outside Bangladesh', detail: 'Find a free helpline at findahelpline.com', url: 'https://findahelpline.com' },
];

export const CRISIS_MESSAGE =
  'I’m really glad you told me. What you’re feeling matters, and you deserve support from a real person right now. ' +
  'I’m an AI companion, so I can’t keep you safe the way someone with you can. If you might act on these thoughts, please call 999 or go to the nearest emergency department. ' +
  'You can also reach a trained listener at Kaan Pete Roi, or someone you trust. Would you like me to stay here with you while you reach out?';

export const URGENT_MEDICAL_MESSAGE =
  'What you’re describing could need medical attention, and I don’t want you to wait it out alone. ' +
  'If the pain is sudden and severe, you’ve fainted, you’re soaking a pad or tampon every hour, or you might be pregnant, please seek urgent care or call 999. ' +
  'I can stay with you and help you note down what’s happening for the doctor.';

/* ------------------------------------------------------------------ */
/* Output guard for AI replies                                          */
/* ------------------------------------------------------------------ */

const DIAGNOSIS = /\byou\s+(definitely\s+|probably\s+|likely\s+)?(have|are suffering from|'ve got)\s+(endometriosis|pcos|pcod|adenomyosis|fibroids|cancer|an? (cyst|infection|std|sti)|depression|anxiety disorder|pmdd)\b/i;
const DOSING = /\b(take|try|use)\s+(\d+\s*(mg|milligrams?|tablets?|pills?))\b/i;
const PRESCRIBE = /\b(you should|I recommend you)\s+(start|stop|take)\s+(birth control|the pill|antidepressants?|hormones?|antibiotics?)\b/i;
const CONTRACEPTION = /\b(safe days?|can'?t get pregnant|won'?t get pregnant|no need for (protection|contraception))\b/i;
const HUMAN_CLAIM = /\bI\s*(am|'m)\s+(a|your)\s+(human|doctor|therapist|nurse|gynae?cologist)\b/i;

export interface GuardResult {
  text: string;
  modified: boolean;
  violations: string[];
}

/** Last line of defence on model output. Replaces unsafe sentences. */
export function guardOutput(text: string): GuardResult {
  const violations: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.map((s) => {
    if (DIAGNOSIS.test(s)) {
      violations.push('diagnosis');
      return 'I can’t diagnose conditions, but a health professional can look into this with you.';
    }
    if (DOSING.test(s) || PRESCRIBE.test(s)) {
      violations.push('medication');
      return 'For medicines and doses, a pharmacist or doctor is the right person to ask.';
    }
    if (CONTRACEPTION.test(s)) {
      violations.push('contraception');
      return 'Petal & Pulse can’t tell you when it is safe to avoid pregnancy, and it isn’t a contraceptive method.';
    }
    if (HUMAN_CLAIM.test(s)) {
      violations.push('identity');
      return 'I’m an AI companion, not a person or clinician.';
    }
    return s;
  });
  const dedup = kept.filter((s, i) => kept.indexOf(s) === i);
  return { text: dedup.join(' '), modified: violations.length > 0, violations };
}
