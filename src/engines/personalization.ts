/**
 * Personalization Engine
 *
 * Connects what the user has chosen to share (symptoms, pain, mood, needs,
 * dietary preferences) with gentle, evidence-informed suggestions. It never
 * claims to cure, never recommends medication doses, and never prescribes
 * restrictive eating.
 */
import type { BodyRegion, CareMode, DayLog, Mood, PainEpisode, PainQuality, Profile, Symptom } from '../data/types';
import { MEALS, Meal, MealTag, mealAllowed } from '../data/meals';
import type { Phase } from './cycle';

export interface ComfortSuggestion {
  id: string;
  title: string;
  detail: string;
  icon: string;
}

const COMFORT: Record<string, ComfortSuggestion> = {
  heat: { id: 'heat', title: 'Gentle warmth', detail: 'Try a comfortably warm (not hot) heating pad or hot water bottle wrapped in cloth on the area for 15–20 minutes.', icon: '♨️' },
  position: { id: 'position', title: 'A position that feels better', detail: 'Lying on your side with knees drawn up, or on your back with a pillow under your knees, can ease pressure for some people.', icon: '🛏️' },
  movement: { id: 'movement', title: 'Gentle movement, if comfortable', detail: 'A slow walk or soft stretches like child’s pose can help some people. Stop if it hurts more.', icon: '🌿' },
  fluids: { id: 'fluids', title: 'Fluids and regular meals', detail: 'Sip water or something warm, and eat normally as you’re able to.', icon: '💧' },
  breathing: { id: 'breathing', title: 'Calming breath', detail: 'Breathe in for 4, hold for 4, out for 6. Repeat for a minute or two while letting your shoulders drop.', icon: '🫧' },
  massage: { id: 'massage', title: 'Soft massage', detail: 'Light circular strokes on your lower back or belly can feel soothing.', icon: '🤲' },
  rest_dark: { id: 'rest_dark', title: 'Dim, quiet rest', detail: 'For head pain, a darker, quieter room and a cool cloth on the forehead may feel easier.', icon: '🌙' },
  support_bra: { id: 'support_bra', title: 'Soft support', detail: 'A soft, supportive bra and a warm or cool compress can ease breast tenderness.', icon: '🤍' },
  legs_raise: { id: 'legs_raise', title: 'Ease aching legs', detail: 'Gentle stretching or resting with your legs slightly raised may help.', icon: '🦵' },
  pharmacist: { id: 'pharmacist', title: 'Ask about pain relief', detail: 'If you usually take pain relief, a pharmacist or doctor can advise what is suitable for you.', icon: '💬' },
};

export function comfortPath(ep: Pick<PainEpisode, 'regions' | 'intensity' | 'qualities'>, helpedBefore: string[] = []): ComfortSuggestion[] {
  const ids: string[] = [];
  const r = new Set<BodyRegion>(ep.regions);
  const q = new Set<PainQuality>(ep.qualities);
  const pelvic = r.has('lower_abdomen') || r.has('left_pelvis') || r.has('right_pelvis');
  if (pelvic || r.has('lower_back') || q.has('cramping')) ids.push('heat', 'position');
  if (r.has('head')) ids.push('rest_dark');
  if (r.has('breasts')) ids.push('support_bra');
  if (r.has('legs')) ids.push('legs_raise');
  if (r.has('lower_back') || r.has('upper_back')) ids.push('massage');
  if (ep.intensity <= 6) ids.push('movement');
  ids.push('fluids', 'breathing');
  if (ep.intensity >= 5) ids.push('pharmacist');
  // Put things that helped this user before first.
  const unique = [...new Set(ids)];
  unique.sort((a, b) => Number(helpedBefore.includes(b)) - Number(helpedBefore.includes(a)));
  return unique.slice(0, 6).map((id) => COMFORT[id]);
}

export const COMFORT_ITEMS = COMFORT;

/* ------------------------------------------------------------------ */
/* Nourish Me                                                           */
/* ------------------------------------------------------------------ */

export interface MealPick {
  meal: Meal;
  reason: string;
  score: number;
}

export interface NourishContext {
  profile: Pick<Profile, 'diet' | 'allergies' | 'foodRegion'>;
  symptoms: Symptom[];
  bleeding: boolean;
  energy: number | null;
  appetite: 'low' | 'normal' | 'high' | null;
  favorites?: string[];
}

export function recommendMeals(ctx: NourishContext, count = 3): MealPick[] {
  const want = new Map<MealTag, string>();
  if (ctx.bleeding) want.set('iron', 'Iron-rich, which matters when you’re losing blood');
  if (ctx.energy !== null && ctx.energy <= 2) {
    want.set('easy', 'Quick to make for a low-energy day');
    want.set('protein', 'Protein for steadier energy');
  }
  if (ctx.symptoms.includes('cramps')) {
    want.set('warm', 'Warm and comforting on a crampy day');
    want.set('magnesium', 'A source of magnesium');
  }
  if (ctx.symptoms.includes('bloating')) want.set('hydrating', 'Hydrating and light');
  if (ctx.symptoms.includes('nausea')) want.set('light', 'Gentle on a queasy stomach');
  if (ctx.appetite === 'low') want.set('light', 'Small and gentle when appetite is low');
  if (want.size === 0) {
    want.set('protein', 'A balanced plate with protein');
    want.set('fiber', 'Fibre for steady energy');
  }
  const pool = MEALS.filter((m) => mealAllowed(m, ctx.profile.diet, ctx.profile.allergies)).filter(
    (m) => ctx.profile.foodRegion === 'both' || m.region === ctx.profile.foodRegion,
  );
  const scored = pool.map((meal) => {
    let score = 0;
    let reason = '';
    for (const [tag, why] of want) {
      if (meal.tags.includes(tag)) {
        score += 2;
        if (!reason) reason = why;
      }
    }
    if (ctx.energy !== null && ctx.energy <= 2 && meal.minutes <= 15) score += 1;
    if (ctx.favorites?.includes(meal.id)) score += 0.5;
    return { meal, reason: reason || 'A balanced, satisfying option', score };
  });
  scored.sort((a, b) => b.score - a.score || a.meal.minutes - b.meal.minutes);
  // keep variety across regions when "both"
  const picks: MealPick[] = [];
  for (const s of scored) {
    if (picks.length >= count) break;
    if (ctx.profile.foodRegion === 'both' && picks.length === count - 1 && picks.every((p) => p.meal.region === s.meal.region)) {
      const alt = scored.find((x) => x.meal.region !== s.meal.region && !picks.includes(x));
      if (alt) {
        picks.push(alt);
        continue;
      }
    }
    picks.push(s);
  }
  return picks;
}

/* ------------------------------------------------------------------ */
/* One Minute for Me → Today's Gentle Plan                             */
/* ------------------------------------------------------------------ */

export interface GentlePlanInput {
  mood: Mood | null;
  bodyScore: number | null; // 1 (rough) – 5 (great)
  need: DayLog['need'];
  painIntensity: number | null;
  phase: Phase;
}

export function gentlePlan(i: GentlePlanInput): string[] {
  const plan: string[] = [];
  const hard = i.mood && ['exhausted', 'overwhelmed', 'sad', 'anxious'].includes(i.mood);
  if ((i.painIntensity ?? 0) >= 5) plan.push('Keep a warm compress nearby and rest when you can.');
  else if ((i.bodyScore ?? 3) <= 2 || i.mood === 'exhausted') plan.push('Take a short rest if possible, even ten minutes counts.');

  switch (i.need) {
    case 'rest':
      plan.push('Let one thing on your list wait until tomorrow.');
      break;
    case 'nourish':
      plan.push('Eat a satisfying lunch, something warm if you like.');
      break;
    case 'connection':
      plan.push('Send a message to someone who feels safe.');
      break;
    case 'movement':
      plan.push('A gentle walk or stretch, at whatever pace feels right.');
      break;
    case 'quiet':
      plan.push('Find ten quiet minutes with no screens.');
      break;
    case 'focus':
      plan.push('Pick one priority and break it into small steps, with pauses.');
      break;
    default:
      plan.push('Eat a satisfying meal and drink some water.');
  }
  if (hard) plan.push('Try a calming activity this evening, like slow breathing or journaling.');
  else if (i.mood === 'irritated') plan.push('Give yourself permission to step away when things feel like too much.');
  else plan.push('Do one small thing that makes you smile.');
  if (i.phase === 'menstrual') plan.push('Keep period supplies and a water bottle within reach.');
  plan.push('Check in with yourself later if you feel like it.');
  return [...new Set(plan)].slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* My Care Mode suggestion (never applied automatically)               */
/* ------------------------------------------------------------------ */

export function suggestCareMode(latestPain: number | null, latestMood: Mood | null, current: CareMode): { mode: CareMode; reason: string } | null {
  if ((latestPain ?? 0) >= 7 && current !== 'comfort')
    return { mode: 'comfort', reason: 'You logged strong pain. Comfort Mode keeps things simple and puts care options first.' };
  if (latestMood === 'overwhelmed' && current !== 'quiet')
    return { mode: 'quiet', reason: 'You mentioned feeling overwhelmed. Quiet Mode offers a calmer, simpler space.' };
  return null;
}

/* ------------------------------------------------------------------ */
/* Daily cards on My Bloom                                              */
/* ------------------------------------------------------------------ */

export function comfortOfTheDay(phase: Phase, mood: Mood | null): ComfortSuggestion {
  if (mood === 'anxious' || mood === 'overwhelmed') return COMFORT.breathing;
  if (phase === 'menstrual') return COMFORT.heat;
  if (mood === 'exhausted') return { id: 'nap', title: 'A pocket of rest', detail: 'Close your eyes for ten minutes. Rest is productive too.', icon: '☁️' };
  if (phase === 'luteal') return { id: 'evening', title: 'A softer evening', detail: 'Plan something low-effort tonight: a shower, a favourite show, early lights out.', icon: '🕯️' };
  return COMFORT.movement;
}

/* ------------------------------------------------------------------ */
/* Journal theme suggestions (on-device, consent-gated, user-confirmed) */
/* ------------------------------------------------------------------ */

const THEMES: [string, RegExp][] = [
  ['Pressure from studies or work', /\b(exam|study|studies|assignment|deadline|class|boss|work|office|grade)s?\b/i],
  ['Tiredness and sleep', /\b(tired|sleep|slept|insomnia|exhausted|awake)\b/i],
  ['Family', /\b(family|mom|mum|mother|dad|father|sister|brother|parents|ammu|abbu)\b/i],
  ['Relationships', /\b(friend|boyfriend|girlfriend|partner|husband|wife|relationship|breakup)\b/i],
  ['Feeling alone', /\b(alone|lonely|nobody|no one|isolated)\b/i],
  ['Body discomfort', /\b(pain|cramp|bloat|headache|sick|hurt)s?\b/i],
  ['Self-criticism', /\b(useless|stupid|failure|not good enough|hate myself|ugly)\b/i],
  ['Something good', /\b(happy|grateful|proud|fun|laughed|great day|enjoyed)\b/i],
];

/** Possible themes only. The UI always asks the user to confirm or correct. */
export function suggestThemes(text: string): string[] {
  return THEMES.filter(([, re]) => re.test(text)).map(([t]) => t).slice(0, 3);
}
