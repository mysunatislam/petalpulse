import { assessPain, guardOutput, isWorsening, screenText } from '../src/engines/safety';
import { respond } from '../src/engines/conversation';
import type { PainEpisode } from '../src/data/types';

const ep = (p: Partial<PainEpisode> = {}): PainEpisode => ({
  id: 'x',
  date: '2026-05-01',
  createdAt: '',
  regions: ['lower_abdomen'],
  intensity: 4,
  qualities: ['cramping'],
  onset: 'few_hours',
  pattern: 'comes_and_goes',
  impact: 'a_little',
  otherSymptoms: [],
  heavyBleeding: false,
  tried: [],
  helped: [],
  notes: '',
  ...p,
});

describe('pain red flags', () => {
  test('ordinary cramps need no escalation', () => {
    expect(assessPain(ep()).level).toBe('none');
  });
  test('fainting is an emergency', () => {
    expect(assessPain(ep({ otherSymptoms: ['fainting'] })).level).toBe('emergency');
  });
  test('sudden severe pelvic pain is an emergency', () => {
    expect(assessPain(ep({ intensity: 9, onset: 'just_now', regions: ['right_pelvis'] })).level).toBe('emergency');
  });
  test('severe one-sided pain with possible pregnancy is an emergency', () => {
    expect(assessPain(ep({ intensity: 7, regions: ['left_pelvis'] }), { possiblePregnancy: true }).level).toBe('emergency');
  });
  test('very heavy bleeding is urgent, and an emergency with dizziness', () => {
    expect(assessPain(ep({ heavyBleeding: true })).level).toBe('urgent');
    expect(assessPain(ep({ heavyBleeding: true, otherSymptoms: ['dizziness'] })).level).toBe('emergency');
  });
  test('pelvic pain with fever is urgent', () => {
    expect(assessPain(ep({ otherSymptoms: ['fever'] })).level).toBe('urgent');
  });
  test('pain interfering with daily life is never normalised', () => {
    const r = assessPain(ep({ impact: 'cannot_function' }));
    expect(r.level).toBe('appointment');
    expect(r.guidance).toMatch(/not something you simply have to endure/);
  });
  test('progressive worsening is detected', () => {
    const hist = [3, 3, 4, 6, 6, 7].map((i) => ep({ intensity: i }));
    expect(isWorsening(hist)).toBe(true);
    expect(isWorsening([5, 5, 5, 5, 5, 5].map((i) => ep({ intensity: i })))).toBe(false);
    expect(isWorsening([1, 9].map((i) => ep({ intensity: i })))).toBe(false); // too little data
  });
});

describe('text screening', () => {
  test.each([
    'I want to die',
    'i dont want to live anymore',
    'thinking about killing myself… I want to hurt myself',
    'I feel suicidal',
    'everyone would be better off without me',
    'আমি মরে যেতে চাই',
  ])('crisis: %s', (s) => expect(screenText(s)).toBe('crisis'));

  test.each(['I fainted after the cramps', 'I am soaking a pad every hour', 'sudden severe sharp pain on my right side', 'I am pregnant and bleeding'])('urgent: %s', (s) =>
    expect(screenText(s)).toBe('urgent_medical'),
  );

  test.each(['My cramps are annoying', 'I died laughing at that show', 'so tired today'])('none: %s', (s) => expect(screenText(s)).toBe('none'));
});

describe('companion safety', () => {
  const settings = { aiCloudConsent: true, aiEndpoint: 'https://example.test', aiResponseLength: 'medium' as const, aiMemory: true };
  test('crisis messages never reach the network and get crisis support', async () => {
    const fetchImpl = jest.fn();
    const r = await respond('I want to end my life', [], { language: 'en' }, { settings, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.safety).toBe('crisis');
    expect(r.text).toMatch(/999/);
    expect(r.text).toMatch(/AI companion/);
  });
  test('cloud replies are filtered for diagnosis, dosing and contraception claims', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ text: 'You probably have endometriosis. Take 400 mg of ibuprofen. Today is a safe day. I hope you feel better.' }),
    }));
    const r = await respond('my cramps are bad', [], { language: 'en' }, { settings, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.text).not.toMatch(/endometriosis/);
    expect(r.text).not.toMatch(/400 mg/);
    expect(r.text).not.toMatch(/safe day/);
    expect(r.text).toMatch(/I hope you feel better/);
  });
  test('without memory consent, no history is sent', async () => {
    const fetchImpl = jest.fn(async (_url: string, init: { body: string }) => {
      expect(JSON.parse(init.body).history).toEqual([]);
      return { ok: true, json: async () => ({ text: 'Hi' }) };
    });
    await respond('hello', [{ id: '1', createdAt: '', role: 'user', text: 'old secret' }], { language: 'en' }, { settings: { ...settings, aiMemory: false }, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalled();
  });
  test('without cloud consent nothing is sent, device companion replies', async () => {
    const fetchImpl = jest.fn();
    const r = await respond('My stomach hurts so much.', [], { language: 'en' }, { settings: { ...settings, aiCloudConsent: false }, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.source).toBe('device');
    expect(r.text).toMatch(/where the pain is|Where do you feel it/i);
  });
  test('network failure falls back to the device companion', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('offline');
    });
    const r = await respond('I just want someone to listen.', [], { language: 'en' }, { settings, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.source).toBe('device');
    expect(r.text).toMatch(/listen/i);
  });
  test('output guard leaves safe text untouched', () => {
    const g = guardOutput('That sounds hard. Want to talk about it?');
    expect(g.modified).toBe(false);
  });
  test('output guard blocks claims of being human', () => {
    expect(guardOutput('I am a doctor, trust me.').violations).toContain('identity');
  });
});
