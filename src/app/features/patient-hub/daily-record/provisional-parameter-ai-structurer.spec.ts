import { ProvisionalParameterAiStructurer } from './provisional-parameter-ai-structurer';

describe('ProvisionalParameterAiStructurer', () => {
  it('não reconhece nenhum parâmetro', async () => {
    expect(await new ProvisionalParameterAiStructurer().suggest()).toEqual([]);
  });
});
