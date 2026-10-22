import type React from 'react';
import { useApp } from '../store/app';
import { BN_PATTERNS, BN_PHRASES } from './phrases';

const en = {
  'nav.home': 'Home',
  'nav.cycle': 'My Cycle',
  'nav.care': 'My Care',
  'nav.insights': 'Insights',
  'nav.petal': 'Petal AI',
  'greet.morning': 'Good morning',
  'greet.afternoon': 'Good afternoon',
  'greet.evening': 'Good evening',
  'greet.soul': 'beautiful soul',
  'home.heart': 'How is your heart feeling today?',
  'home.body.title': 'My Body',
  'home.body.q': 'Any pain or discomfort today?',
  'home.comfort.title': 'My Comfort',
  'home.comfort.q': 'Here’s something gentle you could try.',
  'home.nourish.title': 'My Nourishment',
  'home.nourish.q': 'A little inspiration for today’s meals.',
  'home.askPetal': 'Ask Petal',
  'home.ritual': 'One Minute for Me',
  'mood.happy': 'Happy',
  'mood.peaceful': 'Peaceful',
  'mood.anxious': 'Anxious',
  'mood.sad': 'Sad',
  'mood.irritated': 'Irritated',
  'mood.exhausted': 'Exhausted',
  'mood.overwhelmed': 'Overwhelmed',
  'mood.mixed': 'Mixed feelings',
  'onb.hi': 'Hi, lovely. This is your space to feel heard, understood, and cared for.',
  'onb.pace': 'Let’s get to know your body, at your pace.',
  'onb.story': 'Your body has a story. Let’s understand it together.',
  'common.notSure': 'I’m not sure',
  'common.skip': 'Skip',
  'common.continue': 'Continue',
  'common.save': 'Save',
  'common.done': 'Done',
  'checkin.feel': 'How am I feeling?',
  'checkin.body': 'How is my body feeling?',
  'checkin.need': 'What do I need today?',
  'checkin.plan': 'Your gentle plan',
  'settings.title': 'Profile & settings',
  'pain.intensity': 'How intense is your pain right now?',
  'mood.weighing': 'What’s been weighing on your mind?',
} as const;

export type StringKey = keyof typeof en;

const bn: Partial<Record<StringKey, string>> = {
  'nav.home': 'হোম',
  'nav.cycle': 'আমার চক্র',
  'nav.care': 'আমার যত্ন',
  'nav.insights': 'অন্তর্দৃষ্টি',
  'nav.petal': 'পেটাল এআই',
  'greet.morning': 'শুভ সকাল',
  'greet.afternoon': 'শুভ অপরাহ্ন',
  'greet.evening': 'শুভ সন্ধ্যা',
  'greet.soul': 'সুন্দর মন',
  'home.heart': 'আজ তোমার মন কেমন আছে?',
  'home.body.title': 'আমার শরীর',
  'home.body.q': 'আজ কোনো ব্যথা বা অস্বস্তি আছে?',
  'home.comfort.title': 'আমার আরাম',
  'home.comfort.q': 'এই কোমল জিনিসটা চেষ্টা করে দেখতে পারো।',
  'home.nourish.title': 'আমার পুষ্টি',
  'home.nourish.q': 'আজকের খাবারের জন্য একটু অনুপ্রেরণা।',
  'home.askPetal': 'পেটালকে জিজ্ঞেস করো',
  'home.ritual': 'আমার জন্য এক মিনিট',
  'mood.happy': 'খুশি',
  'mood.peaceful': 'শান্ত',
  'mood.anxious': 'উদ্বিগ্ন',
  'mood.sad': 'দুঃখী',
  'mood.irritated': 'বিরক্ত',
  'mood.exhausted': 'ক্লান্ত',
  'mood.overwhelmed': 'ভারাক্রান্ত',
  'mood.mixed': 'মিশ্র অনুভূতি',
  'onb.hi': 'হাই, প্রিয়। এটা তোমার জায়গা, যেখানে তোমাকে শোনা হবে, বোঝা হবে, যত্ন নেওয়া হবে।',
  'onb.pace': 'চলো তোমার শরীরকে জানি, তোমার নিজের গতিতে।',
  'onb.story': 'তোমার শরীরের একটা গল্প আছে। চলো একসাথে সেটা বুঝি।',
  'common.notSure': 'আমি নিশ্চিত নই',
  'common.skip': 'বাদ দাও',
  'common.continue': 'এগিয়ে যাও',
  'common.save': 'সংরক্ষণ',
  'common.done': 'হয়ে গেছে',
  'checkin.feel': 'আমি কেমন অনুভব করছি?',
  'checkin.body': 'আমার শরীর কেমন আছে?',
  'checkin.need': 'আজ আমার কী দরকার?',
  'checkin.plan': 'তোমার কোমল পরিকল্পনা',
  'settings.title': 'প্রোফাইল ও সেটিংস',
  'pain.intensity': 'এই মুহূর্তে ব্যথা কতটা তীব্র?',
  'mood.weighing': 'কী নিয়ে মন ভারী লাগছে?',
};

export function translate(lang: 'en' | 'bn', key: StringKey): string {
  return (lang === 'bn' && bn[key]) || en[key];
}

export function useT() {
  const lang = useApp((s) => s.settings.language);
  return (key: StringKey) => translate(lang, key);
}

/* ------------------------------------------------------------------ */
/* Phrase-level translation                                            */
/* ------------------------------------------------------------------ */

/**
 * Most screen copy is written inline in English. Rather than a key for every
 * string, `localize` looks the English text up in a Bangla phrasebook, so any
 * text rendered through <T>, Button, Chip or Segmented is translated. Text
 * without an entry stays in English, which is safer than a guess.
 */
export function localize(lang: 'en' | 'bn', text: string): string {
  if (lang !== 'bn' || !text) return text;
  // Multi-line text: each line on its own ("• Daily check-in\n• Fewer prompts").
  if (/\n\s*[•✓✿♥♡]/.test(text)) return text.split('\n').map((l) => localize(lang, l)).join('\n');
  const key = text.replace(/\s+/g, ' ').trim();
  const hit = BN_PHRASES[key];
  if (hit) return text.startsWith(' ') ? ` ${hit}` : hit;
  for (const [re, fn] of BN_PATTERNS) {
    const m = key.match(re);
    if (m) return fn(...m.slice(1));
  }
  // A leading bullet or symbol ("• Daily check-in", "✿ Ask Petal").
  const sym = key.match(/^([•✓✿♥♡·]\s*)(.+)$/);
  if (sym) {
    const inner = localize(lang, sym[2]);
    if (inner !== sym[2]) return sym[1] + inner;
  }
  return localizeList(key) ?? text;
}

/** A trailing count like " (3)" or " (helped 2/3)". */
function splitSuffix(s: string): [string, string] {
  const m = s.match(/^(.*?)( \((?:helped )?\d+(?:\/\d+)?\))$/);
  if (!m) return [s, ''];
  return [m[1], m[2].replace(/^ \(helped (\d+)\/(\d+)\)$/, (_, a, b) => ` (কাজে লেগেছে ${a}/${b})`)];
}

/**
 * Lists built by joining known phrases: "Nausea (1)", "Cramping (3), Throbbing (2)",
 * "Onion, green chilli, lemon · Rice". Phrases may contain commas themselves, so the
 * longest known run of pieces wins. Returns null unless every piece is known.
 */
function localizeList(key: string): string | null {
  const parts = key.split(/(, | · )/);
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    let found = false;
    for (let j = parts.length - 1; j >= i; j -= 2) {
      const [core, suffix] = splitSuffix(parts.slice(i, j + 1).join(''));
      const bn = BN_PHRASES[core];
      if (bn) {
        out.push(bn + suffix);
        if (j + 1 < parts.length) out.push(parts[j + 1]);
        i = j + 2;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }
  return out.join('');
}

export function localizeNode(lang: 'en' | 'bn', node: React.ReactNode): React.ReactNode {
  if (lang !== 'bn') return node;
  if (typeof node === 'string') return localize(lang, node);
  if (Array.isArray(node)) {
    // Text with values inside ("Next period · {range}") arrives as several children. Try it as one sentence first.
    if (node.every((n) => typeof n === 'string' || typeof n === 'number')) {
      const whole = node.join('');
      const out = localize(lang, whole);
      if (out !== whole) return out;
    }
    return node.map((n) => (typeof n === 'string' ? localize(lang, n) : n));
  }
  return node;
}

export function useLocalize() {
  const lang = useApp((s) => s.settings.language);
  return (text: string) => localize(lang, text);
}
