import { normalizeQuestion } from './assistant-query-resolver';

describe('normalizeQuestion', () => {
  it('lowercases and strips accents and punctuation', () => {
    expect(normalizeQuestion('  Quais são minhas PENDÊNCIAS de hoje? ')).toBe('quais sao minhas pendencias de hoje');
  });
});
