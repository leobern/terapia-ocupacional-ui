import { ProvisionalAudioTranscriber } from './provisional-audio-transcriber';

describe('ProvisionalAudioTranscriber', () => {
  it('não transcreve na V1 (sem IA): rejeita para o consumidor avisar e manter a digitação', async () => {
    await expectAsync(new ProvisionalAudioTranscriber().transcribe()).toBeRejectedWithError('Transcrição indisponível');
  });
});
