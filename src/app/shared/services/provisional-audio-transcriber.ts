import { Injectable } from '@angular/core';

import { AudioTranscriber } from './audio-transcriber';

/** Provisório (V1 sem IA): não transcreve; o consumidor mostra o aviso e mantém o campo para digitação. */
@Injectable()
export class ProvisionalAudioTranscriber extends AudioTranscriber {
  transcribe(): Promise<string> {
    return Promise.reject(new Error('Transcrição indisponível'));
  }
}
