import type React from 'react';
import { BN_PATTERNS, BN_PHRASES } from './phrases';

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
