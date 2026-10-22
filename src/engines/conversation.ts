/**
 * Conversation Engine — Petal AI
 *
 * Order of operations for every message:
 *   1. Safety Engine screens the text locally. Crisis or urgent-medical
 *      messages get a fixed, reviewed response and are never sent anywhere.
 *   2. If the user consented to cloud AI and a backend is configured, a
 *      minimal, consented context is sent to the protected backend
 *      (server/), whose reply is passed through the output guard.
 *   3. Otherwise (or if the network fails) the on-device companion answers.
 *      It is intentionally modest: warm, honest, and pattern-aware.
 */
import type { ChatMessage, Mood, Settings } from '../data/types';
import type { CycleStatus } from './cycle';
import type { Insight } from './insights';
import { CRISIS_MESSAGE, guardOutput, screenText, URGENT_MEDICAL_MESSAGE } from './safety';

export interface CompanionContext {
  name?: string;
  language: 'en' | 'bn';
  cycle?: { cycleDay: number | null; phase: string; limited: boolean; nextPeriod?: string; confidence: string };
  recentMoods?: { date: string; mood: Mood; tags: string[] }[];
  recentPain?: { date: string; intensity: number; regions: string[] }[];
  sleepAvg?: number | null;
  patterns?: string[];
}

export interface CompanionReply {
  text: string;
  safety: ChatMessage['safety'];
  suggestions: string[];
  source: 'safety' | 'cloud' | 'device';
}

export const DEFAULT_SUGGESTIONS = ['Talk it out', 'Try a calming activity', 'See my patterns', 'Just log how I feel'];

/** Build the context the user has agreed to share. Nothing else is included. */
export function buildContext(
  settings: Pick<Settings, 'aiUseCycleContext' | 'aiUseMoodPainContext' | 'language'>,
  data: {
    name: string;
    status: CycleStatus | null;
    moods: { date: string; mood: Mood; tags: string[] }[];
    pain: { date: string; intensity: number; regions: string[] }[];
    sleep: number[];
    insights: Insight[];
  },
): CompanionContext {
  const ctx: CompanionContext = { language: settings.language, name: data.name || undefined };
  if (settings.aiUseCycleContext && data.status) {
    ctx.cycle = {
      cycleDay: data.status.cycleDay,
      phase: data.status.phase,
      limited: data.status.phaseLimited,
      nextPeriod: data.status.prediction ? `${data.status.prediction.nextStartEarliest} to ${data.status.prediction.nextStartLatest}` : undefined,
      confidence: data.status.confidence,
    };
  }
  if (settings.aiUseMoodPainContext) {
    ctx.recentMoods = data.moods.slice(-7);
    ctx.recentPain = data.pain.slice(-5);
    ctx.sleepAvg = data.sleep.length ? Math.round((data.sleep.reduce((a, b) => a + b, 0) / data.sleep.length) * 10) / 10 : null;
    ctx.patterns = data.insights.map((i) => i.body);
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Intent detection for the on-device companion                         */
/* ------------------------------------------------------------------ */

type Intent =
  | 'listen'
  | 'pain'
  | 'irritated'
  | 'sad'
  | 'anxious'
  | 'tired'
  | 'exam_period'
  | 'food'
  | 'sleep'
  | 'late'
  | 'cycle_q'
  | 'patterns'
  | 'calm'
  | 'log'
  | 'thanks'
  | 'greeting'
  | 'other';

const RULES: [Intent, RegExp][] = [
  ['listen', /\b(just )?(want|need) (someone|somebody) to listen|talk it out|vent\b/i],
  ['calm', /calming activity|help me (calm|relax)|breath(e|ing)/i],
  ['patterns', /see my patterns|pattern|trend/i],
  ['log', /just log|log how i feel/i],
  ['exam_period', /\b(exam|test|interview|presentation|deadline)\b/i],
  ['pain', /\b(pain|hurts?|cramp|ache|aching|stomach|belly|back)\b|ব্যথা/i],
  ['late', /\b(late|missed|hasn'?t (come|started)|delayed)\b.*\bperiod|period.*\b(late|missed)\b/i],
  ['irritated', /\b(irritat|annoy|angry|mad|frustrat|snappy|rage)/i],
  ['sad', /\b(sad|cry|crying|down|low|lonely|empty|hopeless)\b|মন খারাপ|দুঃখ/i],
  ['anxious', /\b(anxious|anxiety|worried|worry|nervous|panic|scared|stress(ed)?)\b|চিন্তা|ভয়/i],
  ['tired', /\b(tired|exhausted|drained|no energy|fatigue|sleepy)\b|ক্লান্ত/i],
  ['food', /\b(eat|food|meal|hungry|craving|diet|snack)\b|খাবার/i],
  ['sleep', /\b(sleep|insomnia|can'?t sleep|awake)\b|ঘুম/i],
  ['cycle_q', /\b(cycle|phase|ovulat|period|luteal|follicular)\b|মাসিক|পিরিয়ড/i],
  ['thanks', /\b(thank|thanks|thx)\b|ধন্যবাদ/i],
  ['greeting', /^\s*(hi|hello|hey|good (morning|evening|afternoon))\b|^\s*(হাই|হ্যালো|আসসালামু)/i],
];

export function detectIntent(text: string): Intent {
  for (const [intent, re] of RULES) if (re.test(text)) return intent;
  return 'other';
}

export function isBangla(text: string): boolean {
  return /[ঀ-৿]/.test(text);
}

function pick(options: string[], history: ChatMessage[]): string {
  const recent = new Set(history.filter((m) => m.role === 'assistant').slice(-6).map((m) => m.text));
  const fresh = options.filter((o) => ![...recent].some((r) => r.startsWith(o.slice(0, 40))));
  const pool = fresh.length ? fresh : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

function patternMention(ctx: CompanionContext, about: 'mood' | 'pain' | 'energy'): string | null {
  const p = ctx.patterns?.find((s) =>
    about === 'mood' ? /felt|mood|irritat|anxious|sad/i.test(s) : about === 'pain' ? /cramp|pain/i.test(s) : /energy/i.test(s),
  );
  return p ? `I noticed something in your notes: ${p.charAt(0).toLowerCase()}${p.slice(1).replace(/[.\s]+$/, '')}` : null;
}

const BN: Partial<Record<Intent, string[]>> = {
  pain: ['শুনে খারাপ লাগছে যে তুমি ব্যথায় আছো। ব্যথাটা ঠিক কোথায় আর কতটা তীব্র, ০ থেকে ১০ এর মধ্যে বলবে? তাহলে কী আরাম দিতে পারে আর ডাক্তারের কাছে যাওয়া দরকার কিনা, সেটা ভাবতে সাহায্য করতে পারব।'],
  sad: ['মন খারাপ লাগাটা খুব ভারী হতে পারে। কী হয়েছে, বলতে চাও? আমি শুনছি।'],
  anxious: ['চিন্তা হচ্ছে বুঝতে পারছি। চলো একসাথে একটু ধীরে শ্বাস নিই: ৪ গুনে শ্বাস নাও, ৬ গুনে ছাড়ো। কী নিয়ে বেশি চিন্তা হচ্ছে?'],
  tired: ['ক্লান্ত লাগাটা স্বাভাবিক, বিশেষ করে ঘুম কম হলে বা পিরিয়ডের সময়। আজ নিজের জন্য একটু বিশ্রামের সময় রাখতে পারবে?'],
  food: ['আজ সহজ কিছু খেতে পারো, যেমন মসুর ডাল-ভাত লেবু দিয়ে, বা ডিম ভুনা। “My Care” ট্যাবে আরও আইডিয়া আছে।'],
  greeting: ['হাই! আমি পেটাল, তোমার এআই সঙ্গী। আজ কেমন লাগছে?'],
  thanks: ['তোমার পাশে থাকতে পেরে ভালো লাগছে। যখন ইচ্ছা আবার কথা বলো।'],
  other: ['আমি শুনছি। আরেকটু বলবে, কেমন লাগছে?'],
};

export function deviceReply(text: string, history: ChatMessage[], ctx: CompanionContext, length: Settings['aiResponseLength'] = 'medium'): CompanionReply {
  const intent = detectIntent(text);
  const name = ctx.name ? `${ctx.name}` : '';
  const bn = isBangla(text) || ctx.language === 'bn';
  if (bn && BN[intent]) {
    return { text: pick(BN[intent] as string[], history), safety: null, suggestions: [], source: 'device' };
  }
  let reply = '';
  let suggestions: string[] = [];
  const phaseNote =
    ctx.cycle && !ctx.cycle.limited && ctx.cycle.cycleDay
      ? ctx.cycle.phase === 'luteal'
        ? ' You’re likely in the days before your period, which some people find harder, though everyone is different.'
        : ctx.cycle.phase === 'menstrual'
          ? ' You’re on your period, so being extra gentle with yourself makes sense.'
          : ''
      : '';

  switch (intent) {
    case 'listen':
      reply = pick(
        ['I’m here to listen. You don’t need to turn everything into a plan. What’s on your mind?', 'Of course. Take your time, I’m listening. Start wherever feels easiest.'],
        history,
      );
      break;
    case 'pain': {
      const lastPain = ctx.recentPain?.[ctx.recentPain.length - 1];
      reply = pick(
        [
          'I’m sorry you’re dealing with that. Can I ask where the pain is and how intense it feels? I want to help you decide what might make you more comfortable and whether it needs medical attention.',
          'That sounds really uncomfortable. Where do you feel it most, and how strong is it from 0 to 10? Then we can look at comfort ideas and whether it’s worth getting checked.',
        ],
        history,
      );
      const pat = patternMention(ctx, 'pain');
      if (pat && length !== 'short') reply += ` ${pat}.`;
      else if (lastPain && length === 'long') reply += ` Your last pain log was ${lastPain.intensity}/10.`;
      suggestions = ['Open the pain map', 'Comfort ideas', 'When should I see a doctor?'];
      break;
    }
    case 'irritated': {
      reply = pick(
        [
          'That sounds exhausting. Want to tell me what happened? I can also look at your recent cycle notes to see whether you’ve noticed similar days before.',
          'Feeling like everything is grating on you is really draining. Was there a moment today that tipped it, or has it been building?',
        ],
        history,
      );
      const pat = patternMention(ctx, 'mood');
      if (pat) reply += ` ${pat}. That may be worth exploring, although stress, sleep, and other things can matter too.`;
      suggestions = DEFAULT_SUGGESTIONS;
      break;
    }
    case 'sad':
      reply = pick(
        [
          'I’m sorry it feels heavy right now. You don’t have to have a reason for it. Would it help to talk about it, or would something gentle feel better?',
          'That sounds hard. I’m here with you. What’s been weighing on you most?',
        ],
        history,
      );
      suggestions = DEFAULT_SUGGESTIONS;
      break;
    case 'anxious':
      reply = pick(
        [
          'That sounds stressful. Would you like to try one slow breath with me first? In for 4, out for 6. Then, if you want, tell me what’s on your mind.',
          'Worry can make everything feel louder. What’s the thing taking up the most space right now?',
        ],
        history,
      );
      suggestions = ['Try a calming activity', 'Talk it out', 'Just log how I feel'];
      break;
    case 'tired': {
      reply = pick(
        [
          'Being that tired is hard. Have you been able to rest or eat much today? We could find one small thing to make the rest of the day easier.',
          'Low energy days are real. Is it more of a sleepy-tired or a heavy, worn-out tired?',
        ],
        history,
      );
      if (ctx.sleepAvg && ctx.sleepAvg < 6.5) reply += ` Your recent sleep has averaged about ${ctx.sleepAvg} hours, which might be part of it.`;
      suggestions = ['Easy meal ideas', 'Make a gentle plan', 'Just log how I feel'];
      break;
    }
    case 'exam_period':
      reply = pick(
        [
          'That’s difficult timing. Want a small comfort plan for tonight and tomorrow? We can work around your energy, pain, and study schedule.',
          'Ugh, that’s a lot at once. Shall we plan for tonight: some comfort, some focused study in short blocks, and real sleep?',
        ],
        history,
      );
      suggestions = ['Yes, make a plan', 'Comfort ideas', 'Talk it out'];
      break;
    case 'food':
      reply = 'Food can be comforting and practical. On bleeding days, iron-rich foods like dal, leafy greens, eggs or fish can help, paired with something rich in vitamin C. Want a few easy ideas for today?';
      suggestions = ['Easy meal ideas', 'Something with no cooking'];
      break;
    case 'sleep':
      reply = 'Sleep and how we feel are closely linked. Would it help to try a short wind-down routine tonight, or to talk about what’s keeping you up?';
      suggestions = ['Try a calming activity', 'Talk it out'];
      break;
    case 'late':
      reply =
        'Periods can come later than expected for many reasons, like stress, illness, travel, or changes in weight or exercise. If there’s any chance of pregnancy, a test can give you clarity. If it’s much later than usual, or you’re worried, a health professional can help. How are you feeling about it?';
      break;
    case 'cycle_q':
      reply = ctx.cycle && !ctx.cycle.limited && ctx.cycle.cycleDay
        ? `Based on your logs, today is around cycle day ${ctx.cycle.cycleDay}, and you’re likely in your ${ctx.cycle.phase} phase. That’s an estimate from dates, not a measurement of hormones.${ctx.cycle.nextPeriod ? ` Your next period may start between ${ctx.cycle.nextPeriod}.` : ''} What would you like to know?`
        : 'We’re still learning your pattern, so I don’t want to guess your phase yet. Logging a couple of periods will make this much more personal. What would you like to know?';
      suggestions = ['See my patterns'];
      break;
    case 'patterns':
      reply = ctx.patterns?.length
        ? `Here’s what stands out in your notes: ${ctx.patterns[0]} These are patterns, not causes. You can explore more in Insights.`
        : 'There isn’t enough data yet to show patterns confidently. A few weeks of quick check-ins will start to reveal what’s personal to you.';
      suggestions = ['Open Insights'];
      break;
    case 'calm':
      reply = 'Let’s try this together. Breathe in slowly for 4… hold for 4… and out for 6. Let your shoulders drop. Do that three more times, at your own pace. How do you feel now?';
      suggestions = ['A little better', 'Still tense'];
      break;
    case 'log':
      reply = 'Of course. Tap “Log mood” below, or tell me in a word or two how you feel and I’ll keep it with today’s check-in.';
      suggestions = ['Log mood'];
      break;
    case 'thanks':
      reply = pick(['I’m glad I could be here. Come back anytime.', 'Anytime. Take good care of yourself today.'], history);
      break;
    case 'greeting':
      reply = pick([`Hi${name ? ` ${name}` : ''}. How is your heart feeling today?`, `Hello${name ? `, ${name}` : ''}. What’s on your mind?`], history);
      break;
    default:
      reply = pick(
        ['Thank you for telling me. Can you say a bit more about how that feels?', 'I’m listening. What would feel most helpful right now: talking it through, or something practical?'],
        history,
      );
      suggestions = DEFAULT_SUGGESTIONS;
  }
  if (length === 'long' && phaseNote && ['irritated', 'sad', 'tired', 'anxious'].includes(intent)) reply += phaseNote;
  if (length === 'short') reply = reply.split(/(?<=[.?!])\s+/).slice(0, 2).join(' ');
  return { text: reply, safety: null, suggestions, source: 'device' };
}

/* ------------------------------------------------------------------ */
/* Main entry                                                           */
/* ------------------------------------------------------------------ */

export interface RespondOptions {
  settings: Pick<Settings, 'aiCloudConsent' | 'aiEndpoint' | 'aiResponseLength' | 'aiMemory'>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function respond(text: string, history: ChatMessage[], ctx: CompanionContext, opts: RespondOptions): Promise<CompanionReply> {
  const trimmed = text.trim().slice(0, 2000);
  const risk = screenText(trimmed);
  if (risk === 'crisis') return { text: CRISIS_MESSAGE, safety: 'crisis', suggestions: ['Show support options'], source: 'safety' };
  if (risk === 'urgent_medical') return { text: URGENT_MEDICAL_MESSAGE, safety: 'urgent', suggestions: ['Show care guidance', 'Open the pain map'], source: 'safety' };

  const { settings } = opts;
  if (settings.aiCloudConsent && settings.aiEndpoint) {
    try {
      const f = opts.fetchImpl ?? fetch;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
      const res = await f(`${settings.aiEndpoint.replace(/\/$/, '')}/v1/companion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          // Without memory consent only the current exchange is sent.
          history: settings.aiMemory ? history.slice(-12).map((m) => ({ role: m.role, text: m.text })) : [],
          context: ctx,
          length: settings.aiResponseLength,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as { text?: string; suggestions?: string[]; safety?: ChatMessage['safety'] };
        if (data.text) {
          const guarded = guardOutput(data.text);
          return { text: guarded.text, safety: data.safety ?? null, suggestions: (data.suggestions ?? []).slice(0, 4), source: 'cloud' };
        }
      }
    } catch {
      // fall through to on-device companion
    }
  }
  return deviceReply(trimmed, history, ctx, settings.aiResponseLength);
}

export const AI_DISCLOSURE =
  'Petal is an AI companion, not a human, therapist, or clinician. It can’t diagnose conditions or prescribe medication.';
