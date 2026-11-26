import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { isApiPatientId } from './api-patient-hub-source';
import { MeasurementPoint, MeasuresSource, PatientMeasures } from './measures-source';
import { ProvisionalMeasuresSource } from './provisional-measures-source';

/** Resposta do servidor: os campos nulos do contrato podem vir omitidos. */
interface MeasuresDto {
  readonly admissionDate?: string | null;
  readonly admissionWeightKg?: number | null;
  readonly bmiIdealRange: PatientMeasures['bmiIdealRange'];
  readonly points: readonly (Omit<MeasurementPoint, 'bmi' | 'heightCm'> & {
    readonly bmi?: number | null;
    readonly heightCm?: number | null;
  })[];
}

/**
 * Medidas reais: id numérico vai a `GET /api/v1/pacientes/{id}/medidas` (`getMedidasPaciente`), que responde
 * 200 mesmo sem medições (`points` vazio). Falhas sobem; ids de exemplo seguem no provisório.
 */
@Injectable()
export class ApiMeasuresSource extends MeasuresSource {
  private readonly http = inject(HttpClient);
  private readonly provisional = inject(ProvisionalMeasuresSource);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  async load(patientId: string): Promise<PatientMeasures> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.load(patientId);
    }

    const dto = await firstValueFrom(this.http.get<MeasuresDto>(`${this.url}/${patientId}/medidas`));

    // O servidor omite os campos nulos (sem internação, sem altura/IMC): normaliza para null.
    return {
      admissionDate: dto.admissionDate ?? null,
      admissionWeightKg: dto.admissionWeightKg ?? null,
      bmiIdealRange: dto.bmiIdealRange,
      points: dto.points.map(p => ({ ...p, bmi: p.bmi ?? null, heightCm: p.heightCm ?? null })),
    };
  }
}
