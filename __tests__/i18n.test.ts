import { localize, localizeNode } from '../src/i18n';
import { BN_PHRASES } from '../src/i18n/phrases';
import { CRISIS_MESSAGE, CRISIS_RESOURCES, URGENT_MEDICAL_MESSAGE } from '../src/engines/safety';
import { PHASE_COPY } from '../src/engines/cycle';
import { COMFORT_ITEMS } from '../src/engines/personalization';
import { hasBangla } from '../src/theme/tokens';

describe('Bangla phrasebook', () => {
  test('English stays untouched', () => {
    expect(localize('en', 'Save to my journal')).toBe('Save to my journal');
  });

  test('known phrases translate, unknown ones fall back to English', () => {
    expect(localize('bn', 'Save to my journal')).toBe('আমার জার্নালে সেভ করো');
    expect(localize('bn', 'Something we never wrote')).toBe('Something we never wrote');
  });

  test('whitespace differences from JSX still match', () => {
    expect(localize('bn', 'Save to my\n   journal ')).toBe('আমার জার্নালে সেভ করো');
  });

  test('mixed children translate string parts only', () => {
    expect(localizeNode('bn', ['♥ ', 'Helpful', 3])).toEqual(['♥ ', 'কাজের', 3]);
  });

  test('numbered patterns', () => {
    expect(localize('bn', 'Step 2 of 3')).toBe('ধাপ ২ / ৩');
    expect(localize('bn', 'High confidence')).toBe('উচ্চ নিশ্চয়তা');
  });

  test('every safety-critical message has a Bangla version', () => {
    const critical = [
      CRISIS_MESSAGE,
      URGENT_MEDICAL_MESSAGE,
      ...CRISIS_RESOURCES.flatMap((r) => [r.label, r.detail]).filter((s) => !/^Call \d|findahelpline/.test(s) || s.startsWith('Find')),
    ];
    for (const s of critical) expect(hasBangla(localize('bn', s))).toBe(true);
  });

  test('phase copy and comfort ideas are fully translated', () => {
    const texts = [
      ...Object.values(PHASE_COPY).flatMap((p) => Object.values(p).filter((v): v is string => typeof v === 'string')),
      ...Object.values(COMFORT_ITEMS).flatMap((c) => [c.title, c.detail]),
    ];
    const missing = texts.filter((s) => /[a-z]{3}/i.test(s) && !hasBangla(localize('bn', s)));
    expect(missing).toEqual([]);
  });

  test('no entry is left blank or still English', () => {
    for (const [en, bn] of Object.entries(BN_PHRASES)) {
      expect(bn.trim().length).toBeGreaterThan(0);
      if (!/PIN|PDF|JSON|LH|PCOS|AI|Petal|NHS|WHO|Android/.test(en)) expect(hasBangla(bn)).toBe(true);
    }
  });
});

describe('Bangla lists and lines', () => {
  test('joined lists with counts translate piece by piece', () => {
    expect(localize('bn', 'Nausea (1)')).toBe('বমিভাব (1)');
    expect(localize('bn', 'Cramping (3), Throbbing (2)')).toBe('মোচড়ানো (3), দপদপে (2)');
    expect(localize('bn', 'Gentle warmth (helped 3/3), Dim, quiet rest (helped 2/2)')).toBe('হালকা উষ্ণতা (কাজে লেগেছে 3/3), আবছা, নিরিবিলি বিশ্রাম (কাজে লেগেছে 2/2)');
    expect(localize('bn', 'Boiled chickpeas · Onion, green chilli, lemon')).toBe('সেদ্ধ ছোলা · পেঁয়াজ, কাঁচা মরিচ, লেবু');
  });

  test('a sentence with commas is not half-translated', () => {
    expect(localize('bn', 'Rice, and something we never wrote')).toBe('Rice, and something we never wrote');
  });

  test('bulleted lines translate one by one', () => {
    expect(localize('bn', '• Daily check-in\n• Fewer prompts')).toBe('• প্রতিদিনের চেক-ইন\n• কম প্রশ্ন');
  });
});
