import { ProvisionalMessageAiAssistant } from './provisional-patient-message';

describe('ProvisionalMessageAiAssistant', () => {
  it('não transcreve e sugere grupos por palavras-chave', async () => {
    const ai = new ProvisionalMessageAiAssistant();

    expect(await ai.transcribe()).toBe('');
    expect(await ai.suggestGroups('SNE exteriorizada')).toEqual(['nurses']);
    expect(await ai.suggestGroups('dieta interrompida')).toEqual([]);
  });
});
