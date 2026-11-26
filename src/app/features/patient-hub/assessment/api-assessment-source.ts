import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { isApiPatientId } from '../api-patient-hub-source';
import {
  AssessmentFieldId,
  AssessmentPreviousValue,
  AssessmentValues,
  NutritionFunctionalAssessment,
} from './assessment.models';
import { AssessmentSource } from './assessment-source';
import { AssessmentWriter } from './assessment-writer';
import { ProvisionalAssessmentSource } from './provisional-assessment-source';

/** `AvaliacaoNutricional` de openapi/avaliacao-nutricional-api.yaml; autor e `at` são da trilha de auditoria. */
interface AssessmentDto {
  readonly values: Readonly<Partial<Record<AssessmentFieldId, string>>>;
  readonly previous: Readonly<Partial<Record<AssessmentFieldId, AssessmentPreviousValue>>>;
  readonly author: string;
  readonly at: string;
}

/** Do contrato para o modelo da tela: só valores e "anterior" (autor e data da versão não são exibidos). */
export function toNutritionFunctionalAssessment(dto: AssessmentDto): NutritionFunctionalAssessment {
  return { previous: dto.previous, values: dto.values };
}

/**
 * Avaliação Nutricional e Funcional real: `GET`/`PUT /api/v1/pacientes/{id}/avaliacao-nutricional`
 * (`getAvaliacaoNutricional`, `saveAvaliacaoNutricional`). 204 = paciente sem avaliação (`null`, não é erro).
 * Cada gravação é uma versão nova; autor e data/hora são do servidor, e o "anterior" também é calculado por
 * ele (o corpo leva só os valores preenchidos). Erros (400/404/rede) sobem. Ids de exemplo seguem no provisório.
 */
@Injectable()
export class ApiAssessmentSource extends AssessmentSource implements AssessmentWriter {
  private readonly http = inject(HttpClient);
  private readonly provisional = inject(ProvisionalAssessmentSource);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  async loadLatest(patientId: string): Promise<NutritionFunctionalAssessment | null> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadLatest(patientId);
    }
    const dto = await firstValueFrom(
      this.http.get<AssessmentDto | null>(`${this.url}/${patientId}/avaliacao-nutricional`),
    );

    return dto === null ? null : toNutritionFunctionalAssessment(dto);
  }

  async save(patientId: string, values: AssessmentValues): Promise<void> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.save(patientId, values);
    }
    await firstValueFrom(this.http.put(`${this.url}/${patientId}/avaliacao-nutricional`, { values }));
  }
}
