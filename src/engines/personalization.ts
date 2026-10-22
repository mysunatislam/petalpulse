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
  /** What we've learned from this person's own logs, e.g. "Helped you 3 of 4 times". */
  note?: string;
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

export interface ComfortRecord {
  tried: number;
  helped: number;
  /** Counts from episodes that share a body region with the current one. */
  similarTried: number;
  similarHelped: number;
}

/** How each comfort idea has worked for this person, weighted toward similar pain. */
export function comfortHistory(history: PainEpisode[], regions: BodyRegion[] = []): Record<string, ComfortRecord> {
  const out: Record<string, ComfortRecord> = {};
  const here = new Set(regions);
  for (const e of history) {
    const similar = e.regions.some((r) => here.has(r));
    for (const id of new Set([...e.tried, ...e.helped])) {
      const rec = (out[id] ??= { tried: 0, helped: 0, similarTried: 0, similarHelped: 0 });
      const helped = e.helped.includes(id);
      rec.tried++;
      if (helped) rec.helped++;
      if (similar) {
        rec.similarTried++;
        if (helped) rec.similarHelped++;
      }
    }
  }
  return out;
}

const times = (n: number) => (n === 1 ? 'time' : 'times');

/**
 * Comfort ideas for this episode. Starts from what generally suits the body
 * region and intensity, then learns from the person's own "I tried this" and
 * "It helped" taps: things that helped with similar pain rise, things that
 * keep not helping sink (but stay available). "Ask about pain relief" is never
 * dropped for stronger pain.
 */
export function comfortPath(ep: Pick<PainEpisode, 'regions' | 'intensity' | 'qualities'>, history: PainEpisode[] = []): ComfortSuggestion[] {
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

  const rec = comfortHistory(history, ep.regions);
  // Something that helped with similar pain is worth offering even if the rules didn't pick it.
  for (const [id, x] of Object.entries(rec)) if (COMFORT[id] && x.similarHelped > 0 && !ids.includes(id)) ids.push(id);

  const unique = [...new Set(ids)];
  const scored = unique.map((id, i) => {
    const x = rec[id];
    let score = (unique.length - i) * 0.1;
    let note: string | undefined;
    if (x) {
      const w = x.similarTried + 0.5 * (x.tried - x.similarTried);
      const h = x.similarHelped + 0.5 * (x.helped - x.similarHelped);
      score += ((h + 1) / (w + 2) - 0.5) * 4;
      const [hn, tn] = x.similarTried ? [x.similarHelped, x.similarTried] : [x.helped, x.tried];
      if (hn > 0) note = `Helped you ${hn} of ${tn} ${times(tn)}`;
      else if (tn >= 3) {
        note = 'Hasn’t helped the last few times. Still here if you want it.';
        score -= 3;
      }
    }
    return { id, score, note };
  });
  scored.sort((a, b) => b.score - a.score);
  let top = scored.slice(0, 6);
  if (ep.intensity >= 5 && !top.some((x) => x.id === 'pharmacist')) top = [...top.slice(0, 5), scored.find((x) => x.id === 'pharmacist')!];
  return top.map(({ id, note }) => (note ? { ...COMFORT[id], note } : COMFORT[id]));
}

/** What has tended to help overall: ideas tried at least twice, best first. */
export function whatHelps(history: PainEpisode[], min = 2): { item: ComfortSuggestion; tried: number; helped: number }[] {
  return Object.entries(comfortHistory(history))
    .filter(([id, x]) => COMFORT[id] && x.tried >= min && x.helped > 0)
    .map(([id, x]) => ({ item: COMFORT[id], tried: x.tried, helped: x.helped }))
    .sort((a, b) => b.helped / b.tried - a.helped / a.tried || b.tried - a.tried)
    .slice(0, 3);
}

export const COMFORT_ITEMS = COMFORT;

/* ------------------------------------------------------------------ */
/* Nourish Me                                                           */
/* ------------------------------------------------------------------ */

export interface MealPick {
  meal: Meal;
  reason: string;
  score: number;
  /** A small, optional way to get more from the meal. */
  tip?: string;
}

export interface NourishContext {
  profile: Pick<Profile, 'diet' | 'allergies' | 'foodRegion'>;
  symptoms: Symptom[];
  bleeding: boolean;
  energy: number | null;
  appetite: 'low' | 'normal' | 'high' | null;
  favorites?: string[];
  phase?: Phase;
  /** Symptoms that tend to come back before this person's period (from multi-cycle patterns). */
  usuallyBefore?: Symptom[];
}

export const IRON_TIP = 'Add lemon, guava or an orange on the side: vitamin C helps your body use the iron.';

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
  if (ctx.symptoms.includes('fatigue')) {
    want.set('iron', 'Iron and protein, for a tired day');
    want.set('protein', 'Protein for steadier energy');
  }
  if (ctx.symptoms.includes('cravings')) {
    want.set('fiber', 'Satisfying, with fibre and protein, when cravings hit');
    want.set('magnesium', 'A source of magnesium');
  }
  if (ctx.symptoms.includes('headache')) want.set('hydrating', 'Hydrating, as headaches can come with being a bit dehydrated');
  if (ctx.symptoms.includes('bloating')) want.set('hydrating', 'Hydrating and light');
  if (ctx.symptoms.includes('nausea')) want.set('light', 'Gentle on a queasy stomach');
  if (ctx.appetite === 'low') want.set('light', 'Small and gentle when appetite is low');
  if (want.size === 0 && ctx.phase === 'luteal') {
    want.set('fiber', 'Fibre and magnesium, which many people like in the days before a period');
    want.set('magnesium', 'A source of magnesium');
  }
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
    const tip = meal.tags.includes('iron') && !meal.tags.includes('vitamin_c') && (ctx.bleeding || want.has('iron')) ? IRON_TIP : undefined;
    return { meal, reason: reason || 'A balanced, satisfying option', score, ...(tip ? { tip } : {}) };
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

/** A short focus for today at the top of Nourish Me. Positive ideas only, nothing to cut out. */
export function nourishFocus(ctx: Pick<NourishContext, 'bleeding' | 'symptoms' | 'phase' | 'usuallyBefore' | 'energy'>): { title: string; points: string[] } {
  const points: string[] = [];
  let title = 'Today’s focus: balanced and satisfying';
  if (ctx.bleeding) {
    title = 'Today’s focus: iron and warmth';
    points.push('Iron-rich foods like dal, leafy greens, eggs, fish or meat help replace what you lose while bleeding.');
    points.push('Pair them with vitamin C, like lemon, guava or orange.');
  } else if (ctx.phase === 'luteal') {
    title = 'Today’s focus: steady energy';
    points.push('Regular meals with fibre and protein can help energy feel steadier.');
  }
  if (ctx.symptoms.includes('bloating') || ctx.symptoms.includes('headache')) points.push('Keep water, daab or warm drinks nearby through the day.');
  if (ctx.energy !== null && ctx.energy <= 2) points.push('Low effort is fine: no-cook plates and leftovers count.');
  const ahead = (ctx.usuallyBefore ?? []).filter((s) => !ctx.symptoms.includes(s));
  if (ctx.phase === 'luteal' && ahead.includes('cravings')) points.push('Cravings often come up for you before your period. Having a snack you enjoy ready can help.');
  if (ctx.phase === 'luteal' && ahead.includes('bloating')) points.push('Bloating often comes up for you before your period. Lighter, warm meals and plenty of fluids may feel better.');
  if (!points.length) points.push('Eat regularly, include some protein and colour, and enjoy it.');
  return { title, points: points.slice(0, 3) };
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
