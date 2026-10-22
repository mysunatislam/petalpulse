/**
 * @jest-environment node
 */
import { planDictation, voiceLocale, VOICE_COPY } from '../src/engines/voice';
import { bearer, createLimiter, issueToken, TOKEN_MAX_AGE_MS, verifyToken } from '../server/src/auth';
import { respond } from '../src/engines/conversation';
import { applyConsentChange, cloudAllowed, GUARDIAN_COPY, needsGuardian, recordGuardianConsent, withdrawGuardianConsent } from '../src/engines/privacy';
import { DEFAULT_SETTINGS } from '../src/data/types';
import { localize } from '../src/i18n';
import { hasBangla } from '../src/theme/tokens';

describe('voice input', () => {
  const offline = { available: true, onDevice: true, installedLocales: ['en-US'] };
  test('uses on-device recognition when the language is installed', () => {
    expect(planDictation(offline, 'en', false)).toEqual({ ok: true, onDevice: true, locale: 'en-US' });
  });
  test('never goes online without permission', () => {
    expect(planDictation(offline, 'bn', false)).toEqual({ ok: false, reason: 'needs-network-consent' });
    expect(planDictation({ available: true, onDevice: false, installedLocales: [] }, 'en', false)).toEqual({ ok: false, reason: 'needs-network-consent' });
  });
  test('goes online only once allowed', () => {
    expect(planDictation(offline, 'bn', true)).toEqual({ ok: true, onDevice: false, locale: 'bn-BD' });
  });
  test('matches installed locales by language', () => {
    expect(planDictation({ available: true, onDevice: true, installedLocales: ['bn_IN'] }, 'bn', false)).toMatchObject({ ok: true, onDevice: true });
  });
  test('says so when the phone has no speech service', () => {
    expect(planDictation({ available: false, onDevice: false, installedLocales: [] }, 'en', true)).toEqual({ ok: false, reason: 'unavailable' });
    expect(voiceLocale('bn')).toBe('bn-BD');
  });
  test('voice copy is translated', () => {
    for (const s of Object.values(VOICE_COPY)) expect(hasBangla(localize('bn', s))).toBe(true);
  });
});

describe('AI server install tokens', () => {
  const secret = 'x'.repeat(40);
  const now = 1_790_000_000_000;
  test('a fresh token verifies to its install id', () => {
    const { token, installId } = issueToken(secret, now);
    expect(verifyToken(secret, token, now + 1000)).toBe(installId);
  });
  test('tampered, foreign, expired and revoked tokens fail', () => {
    const { token, installId } = issueToken(secret, now);
    const [v, id, at, mac] = token.split('.');
    expect(verifyToken(secret, `${v}.${id}x.${at}.${mac}`, now)).toBeNull();
    expect(verifyToken('y'.repeat(40), token, now)).toBeNull();
    expect(verifyToken(secret, token, now + TOKEN_MAX_AGE_MS + 1)).toBeNull();
    expect(verifyToken(secret, token, now, new Set([installId]))).toBeNull();
    expect(verifyToken(secret, undefined, now)).toBeNull();
    expect(verifyToken(secret, 'garbage', now)).toBeNull();
  });
  test('tokens carry nothing about the person', () => {
    const { token } = issueToken(secret, now);
    expect(token.split('.')).toHaveLength(4);
    expect(token).not.toMatch(/@/);
  });
  test('short secrets are refused', () => {
    expect(() => issueToken('short')).toThrow();
  });
  test('bearer parsing and per-install limits', () => {
    expect(bearer('Bearer abc.def')).toBe('abc.def');
    expect(bearer('Basic abc')).toBeUndefined();
    const limited = createLimiter(60_000, 2);
    expect([limited('a', 0), limited('a', 1), limited('a', 2), limited('b', 3)]).toEqual([false, false, true, false]);
    expect(limited('a', 70_000)).toBe(false);
  });
});

describe('app sends its install token', () => {
  const settings = { aiCloudConsent: true, aiEndpoint: 'https://example.test/', aiResponseLength: 'medium' as const, aiMemory: false };
  const ok = (body: object) => ({ ok: true, status: 200, json: async () => body });
  test('adds the bearer header', async () => {
    const fetchImpl = jest.fn(async () => ok({ text: 'Hi there.' }));
    const r = await respond('hello', [], { language: 'en' }, { settings, fetchImpl: fetchImpl as unknown as typeof fetch, getToken: async () => 'tok1' });
    expect(r.source).toBe('cloud');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.test/v1/companion');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok1');
  });
  test('re-registers once after a 401, then falls back to the phone', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    const getToken = jest.fn(async (refresh: boolean) => (refresh ? 'new' : 'old'));
    const r = await respond('hello', [], { language: 'en' }, { settings, fetchImpl: fetchImpl as unknown as typeof fetch, getToken });
    expect(getToken.mock.calls).toEqual([[false], [true]]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(r.source).toBe('device');
  });
});

describe('parental consent', () => {
  const minor = 'under_16';
  test('a minor cannot switch on cloud AI without a guardian', () => {
    const s = applyConsentChange(DEFAULT_SETTINGS, 'aiCloudConsent', true, minor);
    expect(s.aiCloudConsent).toBe(false);
    expect(needsGuardian(s, minor)).toBe(true);
    expect(applyConsentChange(DEFAULT_SETTINGS, 'aiCloudConsent', true, '18_24').aiCloudConsent).toBe(true);
  });
  test('guardian agreement needs a name and relation, then turns cloud AI on', () => {
    expect(recordGuardianConsent(DEFAULT_SETTINGS, { name: ' ', relation: 'Mother' })).toMatch(/name/);
    expect(recordGuardianConsent(DEFAULT_SETTINGS, { name: 'Rina', relation: '' })).toMatch(/related/);
    const s = recordGuardianConsent(DEFAULT_SETTINGS, { name: 'Rina', relation: 'Mother' }, new Date('2026-10-22T10:00:00Z'));
    if (typeof s === 'string') throw new Error(s);
    expect(s.guardianConsent).toEqual({ name: 'Rina', relation: 'Mother', at: '2026-10-22T10:00:00.000Z' });
    expect(cloudAllowed(s, minor)).toBe(true);
  });
  test('cloud stays blocked at send time if a profile becomes under-18 later', () => {
    const s = { ...DEFAULT_SETTINGS, aiCloudConsent: true };
    expect(cloudAllowed(s, '18_24')).toBe(true);
    expect(cloudAllowed(s, '16_17')).toBe(false);
  });
  test('withdrawing switches cloud AI off', () => {
    const s = withdrawGuardianConsent({ ...DEFAULT_SETTINGS, aiCloudConsent: true, guardianConsent: { name: 'R', relation: 'Father', at: '' } });
    expect(s.aiCloudConsent).toBe(false);
    expect(s.guardianConsent).toBeNull();
  });
  test('guardian copy is translated', () => {
    for (const s of [GUARDIAN_COPY.title, GUARDIAN_COPY.intro, ...GUARDIAN_COPY.points, GUARDIAN_COPY.confirm, GUARDIAN_COPY.device]) expect(hasBangla(localize('bn', s))).toBe(true);
  });
});
