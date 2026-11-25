import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { isApiPatientId } from '../api-patient-hub-source';
import { ClinicalAssessment, ClinicalItem, StatusRange } from './clinical-assessment.models';
import { ClinicalAssessmentSource } from './clinical-assessment-source';
import { ProvisionalClinicalAssessmentSource } from './provisional-clinical-assessment-source';

/** `AvaliacaoClinica` de openapi/pacientes-api.yaml. `fixed` pode vir nulo. */
interface AssessmentDto {
  readonly tnType: string;
  readonly device: string;
  readonly weightKg: number | null;
  readonly heightCm: number | null;
  readonly previousWeight: { readonly kg: number; readonly at: string } | null;
  readonly items: readonly (Omit<ClinicalItem, 'fixed' | 'ranges'> & {
    readonly fixed?: boolean | null;
    readonly ranges: readonly StatusRange[];
  })[];
}

/** Do contrato para o modelo da tela: `fixed` nulo some e `previousWeight` nulo some. */
export function toClinicalAssessment(dto: AssessmentDto): ClinicalAssessment {
  return {
    device: dto.device,
    heightCm: dto.heightCm,
    items: dto.items.map(({ fixed, ...item }) => (fixed === true ? { ...item, fixed } : item)),
    ...(dto.previousWeight === null ? {} : { previousWeight: dto.previousWeight }),
    tnType: dto.tnType,
    weightKg: dto.weightKg,
  };
}

/**
 * Avaliação clínica real: `GET`/`PUT /api/v1/pacientes/{id}/avaliacao-clinica` (`getAvaliacaoClinica`,
 * `saveAvaliacaoClinica`). Paciente sem avaliação volta vazio (200), nunca erro. Erros sobem (400/404/rede). O
 * peso anterior é calculado pelo servidor e não é enviado. Ids de exemplo seguem no provisório.
 */
@Injectable()
export class ApiClinicalAssessmentSource extends ClinicalAssessmentSource {
  private readonly http = inject(HttpClient);
  private readonly provisional = inject(ProvisionalClinicalAssessmentSource);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  async load(patientId: string): Promise<ClinicalAssessment> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.load(patientId);
    }

    return toClinicalAssessment(
      await firstValueFrom(this.http.get<AssessmentDto>(`${this.url}/${patientId}/avaliacao-clinica`)),
    );
  }

  async save(patientId: string, assessment: ClinicalAssessment): Promise<void> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.save(patientId, assessment);
    }
    await firstValueFrom(
      this.http.put(`${this.url}/${patientId}/avaliacao-clinica`, {
        device: assessment.device,
        heightCm: assessment.heightCm,
        items: assessment.items,
        tnType: assessment.tnType,
        weightKg: assessment.weightKg,
      }),
    );
  }
}
