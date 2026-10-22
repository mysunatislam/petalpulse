/**
 * Opt-in research store. Off unless PETAL_RESEARCH_DIR is set.
 *
 * - Accepts only the Contribution shape (src/engines/researchSchema.ts).
 * - Keeps no IP, token, user agent or arrival time beyond the day.
 * - One file per contribution, so deletion is a real delete.
 * - Deletion needs the delete key whose SHA-256 was sent with the data.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateContribution } from '../../src/engines/researchSchema.ts';

const ID_RE = /^[a-f0-9]{32}$/;
const HASH_RE = /^[a-f0-9]{64}$/;

export function parseSubmission(body: unknown): { contribution: unknown; deleteKeyHash: string } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (Object.keys(b).length !== 2 || typeof b.deleteKeyHash !== 'string' || !HASH_RE.test(b.deleteKeyHash)) return null;
  if (!validateContribution(b.contribution)) return null;
  return { contribution: b.contribution, deleteKeyHash: b.deleteKeyHash };
}

export function createResearchStore(dir: string) {
  const file = (id: string) => path.join(dir, `${id}.json`);
  return {
    async save(contribution: unknown, deleteKeyHash: string, now = new Date()): Promise<string> {
      await mkdir(dir, { recursive: true });
      const id = randomBytes(16).toString('hex');
      // Day only: an exact time could help link a contribution to a person.
      await writeFile(file(id), JSON.stringify({ day: now.toISOString().slice(0, 10), deleteKeyHash, contribution }), { flag: 'wx' });
      return id;
    },
    /** 'deleted', 'missing' (already gone) or 'forbidden' (wrong key). */
    async remove(id: string, deleteKey: string | undefined): Promise<'deleted' | 'missing' | 'forbidden'> {
      if (!ID_RE.test(id) || !deleteKey) return 'forbidden';
      let saved: { deleteKeyHash: string };
      try {
        saved = JSON.parse(await readFile(file(id), 'utf8'));
      } catch {
        return 'missing';
      }
      const given = createHash('sha256').update(deleteKey).digest();
      const want = Buffer.from(saved.deleteKeyHash, 'hex');
      if (want.length !== given.length || !timingSafeEqual(want, given)) return 'forbidden';
      await unlink(file(id));
      return 'deleted';
    },
  };
}
