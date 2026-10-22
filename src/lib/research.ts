import * as Crypto from 'expo-crypto';
import type { ResearchReceipt } from '../data/types';
import type { Contribution } from '../engines/researchSchema';

/**
 * Where research contributions go. Set at build time by the study team
 * (EXPO_PUBLIC_RESEARCH_URL), never typed in by the person, so a look-alike
 * address can't collect data. Empty means no study is open.
 */
export const RESEARCH_URL = (process.env.EXPO_PUBLIC_RESEARCH_URL ?? '').replace(/\/$/, '');

export interface ResearchDeps {
  fetchImpl?: typeof fetch;
  randomHex?: (bytes: number) => string;
  sha256?: (s: string) => Promise<string>;
}

const hex = (n: number) => Array.from(Crypto.getRandomBytes(n), (b) => b.toString(16).padStart(2, '0')).join('');
const sha = (s: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);

/**
 * Sends one contribution with no token, cookie or id of the phone. Only the
 * hash of a fresh delete key goes with it; the key itself stays here.
 */
export async function sendContribution(endpoint: string, c: Contribution, deps: ResearchDeps = {}): Promise<ResearchReceipt | null> {
  const { fetchImpl = fetch, randomHex = hex, sha256 = sha } = deps;
  if (!endpoint) return null;
  const deleteKey = randomHex(32);
  try {
    const res = await fetchImpl(`${endpoint}/v1/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({ contribution: c, deleteKeyHash: await sha256(deleteKey) }),
    });
    if (!res.ok) return null;
    const { id } = (await res.json()) as { id?: string };
    if (!id || !/^[a-f0-9]{32}$/.test(id)) return null;
    return { id, deleteKey, sentAt: new Date().toISOString(), endpoint };
  } catch {
    return null;
  }
}

/** Asks the study server to delete one contribution. True when it's gone (or was never there). */
export async function deleteContribution(r: ResearchReceipt, deps: ResearchDeps = {}): Promise<boolean> {
  const { fetchImpl = fetch } = deps;
  try {
    const res = await fetchImpl(`${r.endpoint}/v1/research/${r.id}`, { method: 'DELETE', headers: { 'X-Delete-Key': r.deleteKey }, credentials: 'omit' });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
