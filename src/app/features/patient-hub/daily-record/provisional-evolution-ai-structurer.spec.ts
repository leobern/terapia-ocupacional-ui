import { ProvisionalEvolutionAiStructurer } from './provisional-evolution-ai-structurer';

describe('ProvisionalEvolutionAiStructurer', () => {
  it('não reconhece texto', async () => {
    expect(await new ProvisionalEvolutionAiStructurer().suggest()).toBe('');
  });
});
