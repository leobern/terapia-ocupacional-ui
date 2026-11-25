import { Injectable } from '@angular/core';

import { ReplyTranscriber } from './patient-messages-source';

/** Provisório: ainda não há serviço de transcrição; não reconhece texto (segue o campo manual). */
@Injectable()
export class ProvisionalReplyTranscriber extends ReplyTranscriber {
  transcribe(): Promise<string> {
    return Promise.resolve('');
  }
}
