import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { CensusPatient } from './patient-list.models';
import { PatientListSource } from './patient-list-source';
import { provisionalCensusSeed } from './provisional-patient-list';

/** `CensoPaciente` de openapi/pacientes-api.yaml. */
export interface CensoPacienteDto {
  readonly id: number;
  readonly fullName: string;
  readonly birthDate: string;
  readonly internacaoId: number;
  readonly ward?: string | null;
  readonly unit?: string | null;
  readonly bedNumber?: string | null;
  readonly nutritionalTherapyStartDate?: string | null;
}

interface CensoHospitalDto {
  readonly patients: readonly CensoPacienteDto[];
}

function filled(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';

  return text === '' ? null : text;
}

/** AAAA-MM-DD no calendário local (não UTC): é o dia que o profissional escolheu na faixa de datas. */
export function isoDay(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');

  return `${day.getFullYear()}-${month}-${date}`;
}

/**
 * Regra de combinação real × provisório (única fonte da verdade):
 * - Do backend: id (`String(id)`), nome, nascimento, ala (ala; se vazia, unidade; se ambas vazias, ""), leito
 *   ("" se ausente) e início da terapia (`null` se ausente).
 * - Se existir paciente de exemplo com o MESMO id (`provisional`), os campos clínicos sem backend vêm dele:
 *   terapia, adequação, ciclos, admissão, pendências, cadência, reavaliação e encerramento.
 * - Sem correspondência (todo paciente real, pois os ids de exemplo são "p1", "x1"...): valores neutros,
 *   sem inventar dado clínico: terapia `null`, adequação `null` (indisponível), ciclos `null` (nunca "primeira
 *   avaliação"), cadastrado e acompanhado pela EMTN (quem está no censo do backend já tem internação no Conductia),
 *   sem pendências, cadência ou encerramento.
 */
export function toCensusPatient(dto: CensoPacienteDto, hospitalId: number, provisional?: CensusPatient): CensusPatient {
  const real = {
    bed: filled(dto.bedNumber) ?? '',
    birthDate: dto.birthDate,
    hospitalId,
    id: String(dto.id),
    name: dto.fullName,
    therapyStartDate: dto.nutritionalTherapyStartDate ?? null,
    ward: filled(dto.ward) ?? filled(dto.unit) ?? '',
  };

  if (provisional !== undefined) {
    return { ...provisional, ...real };
  }

  return {
    ...real,
    adequacy: null,
    admissionStatus: 'ADMITTED_BY_EMTN',
    completedCycles: null,
    registeredInConductia: true,
    therapy: null,
  };
}

/**
 * Censo via API real: `GET /api/v1/hospitais/{hospitalId}/pacientes?data=AAAA-MM-DD` (`listHospitalPacientes`).
 * Erros 400/401/403 e de rede chegam como `HttpErrorResponse` rejeitado e a tela mostra o aviso.
 * Pendência: o cache offline (último censo) ainda não existe; offline a lista mantém o que já está na tela.
 */
@Injectable()
export class ApiPatientListSource extends PatientListSource {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/v1/hospitais`;

  async loadCensus(hospitalId: number, day: Date): Promise<readonly CensusPatient[]> {
    const params = new HttpParams().set('data', isoDay(day));
    const body = await firstValueFrom(
      this.http.get<CensoHospitalDto>(`${this.url}/${hospitalId}/pacientes`, { params }),
    );
    const seed = new Map(provisionalCensusSeed().map(p => [p.id, p]));

    return body.patients.map(dto => toCensusPatient(dto, hospitalId, seed.get(String(dto.id))));
  }
}
