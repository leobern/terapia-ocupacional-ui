import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { PatientHubProfile } from './patient-hub.models';
import { PatientHubSource } from './patient-hub-source';
import { ProvisionalPatientHubSource } from './provisional-patient-hub';

/** `PacienteDetalhe` de openapi/pacientes-api.yaml (só o que o Hub usa). */
export interface PacienteDetalheDto {
  readonly id: number;
  readonly fullName: string;
  readonly birthDate: string;
  readonly internacao?: {
    readonly ward?: string | null;
    readonly unit?: string | null;
    readonly bedNumber?: string | null;
    readonly nutritionalTherapyStartDate?: string | null;
  } | null;
}

/** Id inteiro positivo do contrato; ids de exemplo ("p1") nunca chegam à API. */
const API_ID = /^[1-9]\d{0,15}$/;

function filled(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

/** Identificação do paciente real; ala (ala, senão unidade) e leito vêm da internação mais recente. */
export function toHubProfile(dto: PacienteDetalheDto): PatientHubProfile {
  const stay = dto.internacao ?? null;

  return {
    bed: filled(stay?.bedNumber),
    birthDate: dto.birthDate,
    id: String(dto.id),
    name: dto.fullName,
    therapy: null,
    therapyStartDate: stay?.nutritionalTherapyStartDate ?? null,
    ward: filled(stay?.ward) || filled(stay?.unit),
  };
}

/**
 * Hub com identificação real: id numérico vai a `GET /api/v1/pacientes/{id}` (`getPaciente`); 404 (inexistente
 * ou de hospital sem vínculo) = `null` (estado "não encontrado"). Outros erros sobem (403/rede viram o estado de
 * erro/revogação da tela). Ids de exemplo seguem no provisório.
 */
@Injectable()
export class ApiPatientHubSource extends PatientHubSource {
  private readonly http = inject(HttpClient);
  private readonly provisional = inject(ProvisionalPatientHubSource);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  async loadProfile(patientId: string): Promise<PatientHubProfile | null> {
    if (!API_ID.test(patientId)) {
      return this.provisional.loadProfile(patientId);
    }
    try {
      return toHubProfile(await firstValueFrom(this.http.get<PacienteDetalheDto>(`${this.url}/${patientId}`)));
    } catch (failure) {
      if ((failure as { status?: number }).status === 404) {
        return null;
      }
      throw failure;
    }
  }

  /** Id numérico: `GET /api/v1/pacientes/{id}/diagnostico`; 204 = ainda não preenchida (`null`). */
  async loadHypothesis(patientId: string): Promise<string | null> {
    if (!API_ID.test(patientId)) {
      return this.provisional.loadHypothesis(patientId);
    }
    const response = await firstValueFrom(
      this.http.get<{ readonly text: string } | null>(`${this.url}/${patientId}/diagnostico`, { observe: 'response' }),
    );

    return response.status === 204 ? null : (response.body?.text ?? null);
  }
}

/** Identifica o paciente que existe no backend (inteiro positivo); ids de exemplo ("p1") ficam no provisório. */
export function isApiPatientId(patientId: string): boolean {
  return API_ID.test(patientId);
}
