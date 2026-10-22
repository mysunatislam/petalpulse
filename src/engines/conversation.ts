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
import { localize } from '../i18n/localize';
import { formatShortBn } from '../lib/dates';

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
  | 'better'
  | 'other';

const RULES: [Intent, RegExp][] = [
  ['listen', /\b(just )?(want|need) (someone|somebody) to listen|talk it out|vent\b/i],
  ['calm', /calming activity|help me (calm|relax)|breath(e|ing)|still tense/i],
  ['better', /^\s*(a (little|bit) better|better now|feeling better)/i],
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

/**
 * Bangla (and Banglish: Bangla typed in English letters) cues, checked before
 * the English rules. The app's own Bangla chips and starters are covered too,
 * since tapping one sends its Bangla text.
 */
const BN_RULES: [Intent, RegExp][] = [
  ['listen', /শুনুক|শুনবে|শোনো|কথা বলি|কথা বলতে চাই|মনের কথা|\b(shuno|sunbe|kotha bolte)\b/i],
  ['calm', /শান্ত হ|শ্বাস|রিল্যাক্স|এখনো টেনশন|এখনো অস্থির|\bshanto\b/i],
  ['better', /একটু ভালো লাগছে|আগের চেয়ে ভালো|এখন ভালো লাগছে|\b(ektu bhalo|ektu valo)\b/i],
  ['patterns', /ধরন|প্যাটার্ন|প্রবণতা/],
  ['log', /লিখে রাখ|লগ কর|কেমন লাগছে লিখি/],
  ['exam_period', /পরীক্ষা|পরিক্ষা|ইন্টারভিউ|প্রেজেন্টেশন|ডেডলাইন|\b(porikkha|porikha)\b/i],
  ['pain', /ব্যথা|ব্যাথা|কামড়|মোচড়|ক্র্যাম্প|\b(betha|batha|byatha|bytha)\b/i],
  ['late', /(পিরিয়ড|মাসিক).*(দেরি|হচ্ছে না|আসছে না|মিস)|\b(period|mashik|masik)\b.*\b(deri|hocche na|ashche na|asche na)\b/i],
  ['irritated', /বিরক্ত|রাগ|মেজাজ|খিটখিটে|\b(birokto|rag lagche)\b/i],
  ['sad', /মন খারাপ|দুঃখ|কান্না|কাঁদ|একা লাগ|খারাপ লাগছে|ভালো লাগছে না|\b(mon kharap|kharap lagche|valo lagche na|bhalo lagche na)\b/i],
  ['anxious', /চিন্তা|দুশ্চিন্তা|ভয়|টেনশন|অস্থির|উদ্বিগ্ন|নার্ভাস|\b(chinta|tension|bhoy)\b/i],
  ['tired', /ক্লান্ত|শক্তি নেই|দুর্বল|অবসন্ন|ঘুম ঘুম|\b(klanto|durbol)\b/i],
  ['food', /খাবার|খাওয়া|খেতে|খিদে|ক্ষুধা|\b(khabar|khide|khete)\b/i],
  ['sleep', /ঘুম|\bghum\b/i],
  ['cycle_q', /চক্র|পর্যায়|ফেজ|ডিম্বস্ফোটন|মাসিক|পিরিয়ড/],
  ['thanks', /ধন্যবাদ|থ্যাংক|\bdhonnobad\b/i],
  ['greeting', /^\s*(হাই|হ্যালো|হেলো|আসসালামু|সালাম|নমস্কার|শুভ সকাল|শুভ সন্ধ্যা)/],
];

export function isBangla(text: string): boolean {
  return /[ঀ-৿]/.test(text);
}

const BANGLISH = /\b(ami|amar|amake|amr|tumi|valo|bhalo|lagche|kharap|onek|khub|keno|korbo|ektu|chai|na|kichu|hobe|hocche|parchi)\b/i;

/** Bangla script, or Bangla typed in English letters. */
export function looksBangla(text: string): boolean {
  return isBangla(text) || (text.match(new RegExp(BANGLISH.source, 'gi')) ?? []).length >= 2;
}

export function detectIntent(text: string): Intent {
  if (looksBangla(text)) for (const [intent, re] of BN_RULES) if (re.test(text)) return intent;
  for (const [intent, re] of RULES) if (re.test(text)) return intent;
  return 'other';
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

const PHASE_BN: Record<string, string> = { menstrual: 'মাসিকের', follicular: 'ফলিকুলার', ovulatory: 'ডিম্বস্ফোটনের', luteal: 'লুটিয়াল' };

const bnDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

/** A pattern from Insights, in Bangla, or null if it has no Bangla wording yet. */
function patternMentionBn(ctx: CompanionContext, about: 'mood' | 'pain' | 'energy'): string | null {
  const p = ctx.patterns?.find((s) =>
    about === 'mood' ? /felt|mood|irritat|anxious|sad/i.test(s) : about === 'pain' ? /cramp|pain/i.test(s) : /energy/i.test(s),
  );
  if (!p) return null;
  const bn = localize('bn', p);
  return isBangla(bn) ? `তোমার নোটে একটা জিনিস চোখে পড়েছে: ${bn.replace(/[।.\s]+$/, '')}।` : null;
}

/** The on-device companion, in Bangla. Same intents, same care, same limits as in English. */
function deviceReplyBn(intent: Intent, history: ChatMessage[], ctx: CompanionContext, length: Settings['aiResponseLength']): CompanionReply {
  const name = ctx.name ? ` ${ctx.name}` : '';
  let reply = '';
  let suggestions: string[] = [];
  const phaseNote =
    ctx.cycle && !ctx.cycle.limited && ctx.cycle.cycleDay
      ? ctx.cycle.phase === 'luteal'
        ? ' তুমি সম্ভবত পিরিয়ডের আগের দিনগুলোতে আছ, যখন অনেকের একটু বেশি কঠিন লাগে, যদিও সবার অভিজ্ঞতা আলাদা।'
        : ctx.cycle.phase === 'menstrual'
          ? ' এখন তোমার পিরিয়ড চলছে, তাই নিজের প্রতি একটু বেশি কোমল থাকাটাই স্বাভাবিক।'
          : ''
      : '';
  switch (intent) {
    case 'listen':
      reply = pick(['আমি শুনছি। সবকিছুকে পরিকল্পনায় বদলাতে হবে না। মনে কী চলছে, বলো।', 'অবশ্যই। সময় নাও, আমি আছি। যেখান থেকে সহজ লাগে, সেখান থেকে শুরু করো।'], history);
      break;
    case 'pain': {
      reply = pick(
        [
          'শুনে খারাপ লাগছে যে তুমি ব্যথায় আছ। ব্যথাটা ঠিক কোথায়, আর ০ থেকে ১০-এর মধ্যে কতটা তীব্র? তাহলে কী আরাম দিতে পারে আর ডাক্তার দেখানো দরকার কিনা, সেটা ভাবতে সাহায্য করতে পারব।',
          'খুব অস্বস্তিকর শোনাচ্ছে। সবচেয়ে বেশি কোথায় লাগছে, আর ০ থেকে ১০-এ কতটা? তারপর আরামের কিছু উপায় আর ডাক্তার দেখানো উচিত কিনা, একসাথে দেখতে পারি।',
        ],
        history,
      );
      const pat = patternMentionBn(ctx, 'pain');
      if (pat && length !== 'short') reply += ` ${pat}`;
      suggestions = ['Open the pain map', 'Comfort ideas', 'When should I see a doctor?'];
      break;
    }
    case 'irritated': {
      reply = pick(
        [
          'খুব ক্লান্তিকর শোনাচ্ছে। কী হয়েছে বলবে? চাইলে তোমার সাম্প্রতিক চক্রের নোটও দেখতে পারি, আগে এমন দিন এসেছিল কিনা।',
          'সবকিছু গায়ে লাগার অনুভূতিটা সত্যিই ক্লান্ত করে দেয়। আজ কোনো একটা মুহূর্তে এমন হলো, নাকি ধীরে ধীরে জমেছে?',
        ],
        history,
      );
      const pat = patternMentionBn(ctx, 'mood');
      if (pat) reply += ` ${pat} এটা খেয়াল করার মতো, যদিও চাপ, ঘুম আর অন্য অনেক কিছুরও ভূমিকা থাকতে পারে।`;
      suggestions = DEFAULT_SUGGESTIONS;
      break;
    }
    case 'sad':
      reply = pick(['এখন মনটা ভারী লাগছে, শুনে খারাপ লাগল। এর পেছনে কারণ থাকতেই হবে এমন নয়। কথা বলতে চাও, নাকি কোমল কিছু করলে ভালো লাগবে?', 'কঠিন শোনাচ্ছে। আমি তোমার সাথে আছি। সবচেয়ে বেশি কী ভার হয়ে আছে?'], history);
      suggestions = DEFAULT_SUGGESTIONS;
      break;
    case 'anxious':
      reply = pick(['চিন্তা হচ্ছে বুঝতে পারছি। আগে একসাথে একটা ধীর শ্বাস নিই? ৪ গুনে শ্বাস নাও, ৬ গুনে ছাড়ো। তারপর চাইলে বলো কী নিয়ে ভাবছ।', 'দুশ্চিন্তা সবকিছুকে আরও জোরালো করে তোলে। এই মুহূর্তে কোন জিনিসটা সবচেয়ে বেশি জায়গা নিয়ে আছে?'], history);
      suggestions = ['Try a calming activity', 'Talk it out', 'Just log how I feel'];
      break;
    case 'tired':
      reply = pick(['এতটা ক্লান্ত লাগা কঠিন। আজ কি একটু বিশ্রাম বা খাওয়া হয়েছে? দিনের বাকিটা সহজ করতে ছোট একটা কিছু খুঁজে নিতে পারি।', 'কম শক্তির দিনগুলো সত্যি। এটা কি ঘুম ঘুম ক্লান্তি, নাকি ভারী, নিঃশেষ হয়ে যাওয়ার মতো?'], history);
      if (ctx.sleepAvg && ctx.sleepAvg < 6.5) reply += ` তোমার সাম্প্রতিক ঘুম গড়ে প্রায় ${bnDigits(ctx.sleepAvg)} ঘণ্টা, এটাও হয়তো একটা কারণ।`;
      suggestions = ['Easy meal ideas', 'Make a gentle plan', 'Just log how I feel'];
      break;
    case 'exam_period':
      reply = pick(['সময়টা সত্যিই কঠিন। আজ রাত আর কালকের জন্য ছোট একটা আরামের পরিকল্পনা করবে? তোমার শক্তি, ব্যথা আর পড়ার সময় মিলিয়ে করা যাবে।', 'একসাথে অনেক কিছু। আজ রাতের জন্য ভাবি: একটু আরাম, ছোট ছোট ভাগে মন দিয়ে পড়া, আর ঠিকমতো ঘুম?'], history);
      suggestions = ['Yes, make a plan', 'Comfort ideas', 'Talk it out'];
      break;
    case 'food':
      reply = 'খাবার আরামও দেয়, কাজেও লাগে। পিরিয়ডের দিনে ডাল, শাক, ডিম বা মাছের মতো আয়রনসমৃদ্ধ খাবার কাজে লাগতে পারে, সাথে লেবু বা পেয়ারার মতো ভিটামিন সি। আজকের জন্য কিছু সহজ আইডিয়া দেখবে?';
      suggestions = ['Easy meal ideas', 'Something with no cooking'];
      break;
    case 'sleep':
      reply = 'ঘুম আর মন খুব কাছাকাছি জড়িয়ে থাকে। আজ রাতে ছোট একটা ঘুমের আগের রুটিন চেষ্টা করবে, নাকি কী তোমাকে জাগিয়ে রাখছে সেটা নিয়ে কথা বলবে?';
      suggestions = ['Try a calming activity', 'Talk it out'];
      break;
    case 'late':
      reply = 'অনেক কারণে পিরিয়ড দেরিতে আসতে পারে, যেমন চাপ, অসুখ, ভ্রমণ, বা ওজন বা ব্যায়ামে পরিবর্তন। গর্ভধারণের কোনো সম্ভাবনা থাকলে একটা টেস্ট পরিষ্কার উত্তর দিতে পারে। যদি স্বাভাবিকের চেয়ে অনেক দেরি হয় বা চিন্তা হয়, একজন স্বাস্থ্যকর্মী সাহায্য করতে পারবেন। তোমার কেমন লাগছে এ নিয়ে?';
      break;
    case 'cycle_q': {
      const c = ctx.cycle;
      if (c && !c.limited && c.cycleDay && PHASE_BN[c.phase]) {
        const m = c.nextPeriod?.match(/^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/);
        reply = `তোমার লগ অনুযায়ী আজ চক্রের মোটামুটি ${bnDigits(c.cycleDay)} নম্বর দিন, আর সম্ভবত তুমি ${PHASE_BN[c.phase]} পর্যায়ে আছ। এটা তারিখ থেকে করা অনুমান, হরমোনের মাপ নয়।${m ? ` পরের পিরিয়ড হয়তো ${formatShortBn(m[1])} থেকে ${formatShortBn(m[2])}-এর মধ্যে শুরু হতে পারে।` : ''} কী জানতে চাও?`;
      } else {
        reply = 'আমরা এখনো তোমার ধরন শিখছি, তাই এখনই তোমার পর্যায় আন্দাজ করতে চাই না। কয়েকটা পিরিয়ড লগ করলে এটা অনেক বেশি তোমার মতো হবে। কী জানতে চাও?';
      }
      suggestions = ['See my patterns'];
      break;
    }
    case 'patterns': {
      const first = ctx.patterns?.map((p) => localize('bn', p)).find(isBangla);
      reply = first
        ? `তোমার নোটে যা চোখে পড়ছে: ${first} এগুলো ধরন, কারণ নয়। অন্তর্দৃষ্টিতে আরও দেখতে পারো।`
        : 'নিশ্চিতভাবে ধরন দেখানোর মতো তথ্য এখনো হয়নি। কয়েক সপ্তাহের ছোট ছোট চেক-ইনে তোমার নিজস্ব ধরন ফুটে উঠবে।';
      suggestions = ['Open Insights'];
      break;
    }
    case 'calm':
      reply = 'চলো একসাথে করি। ধীরে ৪ গুনে শ্বাস নাও… ৪ গুনে ধরে রাখো… ৬ গুনে ছাড়ো। কাঁধ দুটো আলগা করে দাও। নিজের গতিতে আরও তিনবার করো। এখন কেমন লাগছে?';
      suggestions = ['A little better', 'Still tense'];
      break;
    case 'better':
      reply = 'শুনে ভালো লাগল। যখনই দরকার, এই শ্বাসটা আবার করতে পারো। আর কিছু নিয়ে কথা বলতে চাও?';
      break;
    case 'log':
      reply = 'অবশ্যই। নিচে “মন লেখো” চাপো, অথবা এক-দুই শব্দে বলো কেমন লাগছে।';
      suggestions = ['Log mood'];
      break;
    case 'thanks':
      reply = pick(['তোমার পাশে থাকতে পেরে ভালো লাগছে। যখন ইচ্ছা আবার কথা বলো।', 'সবসময়। আজ নিজের যত্ন নিও।'], history);
      break;
    case 'greeting':
      reply = pick([`হাই${name}! আমি পেটাল, তোমার এআই সঙ্গী। আজ মনটা কেমন?`, `হ্যালো${name}। মনে কী চলছে?`], history);
      break;
    default:
      reply = pick(['বলার জন্য ধন্যবাদ। আরেকটু বলবে, কেমন লাগছে?', 'আমি শুনছি। এখন কোনটা বেশি কাজে লাগবে: কথা বলে হালকা হওয়া, নাকি কোনো কাজের কিছু?'], history);
      suggestions = DEFAULT_SUGGESTIONS;
  }
  if (length === 'long' && phaseNote && ['irritated', 'sad', 'tired', 'anxious'].includes(intent)) reply += phaseNote;
  if (length === 'short') reply = reply.split(/(?<=[।?!])\s+/).slice(0, 2).join(' ');
  return { text: reply, safety: null, suggestions, source: 'device' };
}

export function deviceReply(text: string, history: ChatMessage[], ctx: CompanionContext, length: Settings['aiResponseLength'] = 'medium'): CompanionReply {
  const intent = detectIntent(text);
  const name = ctx.name ? `${ctx.name}` : '';
  // Reply in Bangla when the person writes Bangla (or Banglish), or uses the app in Bangla and wrote no English words.
  const bn = looksBangla(text) || (ctx.language === 'bn' && !/[a-z]/i.test(text));
  if (bn) return deviceReplyBn(intent, history, ctx, length);
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
    case 'better':
      reply = 'I’m glad. You can come back to that breath whenever you need it. Is there anything else on your mind?';
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
  /** Per-install token for the backend. `refresh` asks for a new one after a 401. */
  getToken?: (refresh: boolean) => Promise<string | null>;
}

export async function respond(text: string, history: ChatMessage[], ctx: CompanionContext, opts: RespondOptions): Promise<CompanionReply> {
  const trimmed = text.trim().slice(0, 2000);
  const risk = screenText(trimmed);
  // Someone writing in Bangla gets the safety message in Bangla, whatever language the app is set to.
  const say = (msg: string) => (looksBangla(trimmed) ? localize('bn', msg) : msg);
  if (risk === 'crisis') return { text: say(CRISIS_MESSAGE), safety: 'crisis', suggestions: ['Show support options'], source: 'safety' };
  if (risk === 'urgent_medical') return { text: say(URGENT_MEDICAL_MESSAGE), safety: 'urgent', suggestions: ['Show care guidance', 'Open the pain map'], source: 'safety' };

  const { settings } = opts;
  if (settings.aiCloudConsent && settings.aiEndpoint) {
    try {
      const f = opts.fetchImpl ?? fetch;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
      const call = (token: string | null) =>
        f(`${settings.aiEndpoint.replace(/\/$/, '')}/v1/companion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            message: trimmed,
            // Without memory consent only the current exchange is sent.
            history: settings.aiMemory ? history.slice(-12).map((m) => ({ role: m.role, text: m.text })) : [],
            context: ctx,
            length: settings.aiResponseLength,
          }),
          signal: controller.signal,
        });
      let res = await call((await opts.getToken?.(false)) ?? null);
      if (res.status === 401 && opts.getToken) res = await call(await opts.getToken(true));
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
