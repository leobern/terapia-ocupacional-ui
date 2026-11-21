import { Injectable } from '@angular/core';

import { SuggestedParameter } from './daily-record.models';
import { ParameterAiStructurer } from './parameter-ai-structurer';

/** Provisório: ainda não há serviço de IA; não reconhece nada (o profissional segue pelos campos manuais). */
@Injectable()
export class ProvisionalParameterAiStructurer extends ParameterAiStructurer {
  suggest(): Promise<readonly SuggestedParameter[]> {
    return Promise.resolve([]);
  }
}
