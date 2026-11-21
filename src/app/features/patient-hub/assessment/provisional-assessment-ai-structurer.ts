import { Injectable } from '@angular/core';

import { AssessmentAiStructurer, StructuredAssessment } from './assessment-ai-structurer';

/** Provisório: ainda não há serviço de IA; não reconhece nenhum campo (o formulário fica como estava). */
@Injectable()
export class ProvisionalAssessmentAiStructurer extends AssessmentAiStructurer {
  structure(): Promise<StructuredAssessment> {
    return Promise.resolve({});
  }
}
