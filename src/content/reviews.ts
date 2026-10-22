/**
 * Clinician sign-offs for the Learn library and the safety copy.
 *
 * Add an entry only when a qualified clinician has read the exact text in the
 * review packet (npm run review:packet) and approved it. Copy the hash from the
 * packet: if the text changes afterwards, the hash no longer matches and the
 * item goes back to "awaiting review" on its own.
 *
 * No item has been reviewed yet. Never add an entry on someone's behalf.
 */
import { type Article, contentHash } from './library';

export interface Review {
  /** Hash of the text that was approved, from the review packet. */
  hash: string;
  reviewer: string;
  /** For example "MBBS, FCPS (Obstetrics & Gynaecology)". */
  credential: string;
  /** YYYY-MM-DD */
  date: string;
  notes?: string;
}

export const REVIEWS: Record<string, Review> = {};

export type ReviewStatus =
  | { state: 'reviewed'; review: Review }
  | { state: 'changed'; review: Review }
  | { state: 'awaiting' };

export function reviewStatus(a: Article, reviews: Record<string, Review> = REVIEWS): ReviewStatus {
  const r = reviews[a.id];
  if (!r) return { state: 'awaiting' };
  return r.hash === contentHash(a) ? { state: 'reviewed', review: r } : { state: 'changed', review: r };
}

export const REVIEW_COPY = {
  awaiting: 'Awaiting clinician review',
  changed: 'Updated since review, awaiting a fresh check',
  reviewedBy: 'Reviewed by',
  explain:
    'Every article is written from the guidelines listed under it. An article is marked reviewed only after a qualified clinician has checked that exact text. If it changes later, it goes back to awaiting review automatically.',
};
