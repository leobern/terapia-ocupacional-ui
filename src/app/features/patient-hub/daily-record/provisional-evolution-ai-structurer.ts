import { Injectable } from '@angular/core';

import { EvolutionAiStructurer } from './evolution-ai-structurer';

/** Provisório: ainda não há serviço de IA; não reconhece texto (o médico segue pelo campo manual). */
@Injectable()
export class ProvisionalEvolutionAiStructurer extends EvolutionAiStructurer {
  suggest(): Promise<string> {
    return Promise.resolve('');
  }
}
