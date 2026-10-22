/**
 * Writes docs/review/REVIEW_PACKET.md: every Learn article and the safety
 * messages, with the hash a clinician signs off against.
 *
 *   npm run review:packet
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { ARTICLES, contentHash } from '../src/content/library';
import { REVIEWS, reviewStatus } from '../src/content/reviews';
import { CRISIS_MESSAGE, URGENT_MEDICAL_MESSAGE } from '../src/engines/safety';

const lines: string[] = [
  '# Clinician review packet',
  '',
  `Generated ${new Date().toISOString().slice(0, 10)}. Regenerate with \`npm run review:packet\` after any content change.`,
  '',
  'How to review: read each item in both languages. If you approve it as written, send back the item id, the hash shown, your name, credential and date. These are added to `src/content/reviews.ts`. If you want changes, note them and the item will be revised and re-sent with a new hash.',
  '',
  '| Item | Hash | Status |',
  '| --- | --- | --- |',
  ...ARTICLES.map((a) => `| ${a.id} | \`${contentHash(a)}\` | ${reviewStatus(a).state} |`),
  '',
];

for (const a of ARTICLES) {
  lines.push(`## ${a.en.title}`, '', `id \`${a.id}\` · hash \`${contentHash(a)}\` · updated ${a.updated}`, '');
  if (REVIEWS[a.id]) lines.push(`Last signed off by ${REVIEWS[a.id].reviewer} on ${REVIEWS[a.id].date} (hash \`${REVIEWS[a.id].hash}\`).`, '');
  lines.push('Sources:', ...a.sources.map((s) => `- ${s}`), '');
  for (const lang of ['en', 'bn'] as const) {
    const t = a[lang];
    lines.push(`### ${lang === 'en' ? 'English' : 'Bangla'}: ${t.title}`, '', `_${t.summary}_`, '');
    for (const s of t.sections) lines.push(`**${s.heading}**`, '', s.body, '');
  }
  lines.push('Sign-off: name, credential, date, approved / changes needed', '', '---', '');
}

lines.push('## Safety messages (shown before any AI reply)', '', '### Crisis', '', CRISIS_MESSAGE, '', '### Urgent medical', '', URGENT_MEDICAL_MESSAGE, '');
lines.push('The red-flag rules behind these messages are in `src/engines/safety.ts` and described in `docs/SAFETY.md`.', '');

mkdirSync('docs/review', { recursive: true });
writeFileSync('docs/review/REVIEW_PACKET.md', lines.join('\n'));
console.log(`Wrote docs/review/REVIEW_PACKET.md (${ARTICLES.length} articles)`);
