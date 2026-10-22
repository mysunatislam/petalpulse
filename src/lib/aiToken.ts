import { getSecret, setSecret, delSecret } from './secure';

/**
 * Keeps the Petal AI backend's per-install token in the keystore, one per
 * backend address. Registration sends nothing about the person.
 */
const key = (endpoint: string) => `pp_ai_token_${endpoint.replace(/[^a-z0-9]/gi, '_').slice(0, 80)}`;

export function tokenGetter(endpoint: string, fetchImpl: typeof fetch = fetch) {
  const base = endpoint.replace(/\/$/, '');
  return async (refresh: boolean): Promise<string | null> => {
    if (!refresh) {
      const saved = await getSecret(key(endpoint));
      if (saved) return saved;
    } else {
      await delSecret(key(endpoint));
    }
    try {
      const res = await fetchImpl(`${base}/v1/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) return null;
      const { token } = (await res.json()) as { token?: string | null };
      if (token) await setSecret(key(endpoint), token);
      return token ?? null;
    } catch {
      return null;
    }
  };
}

export async function forgetToken(endpoint: string) {
  await delSecret(key(endpoint));
}
