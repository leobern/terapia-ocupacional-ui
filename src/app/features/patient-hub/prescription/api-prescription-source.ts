import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { isApiPatientId } from '../api-patient-hub-source';
import { NutritionRoute } from '../plan/plan.models';
import {
  ActivePrescription,
  AdministrationModality,
  Prescription,
  PrescriptionReview,
  PrescriptionReviewRequest,
  PrescriptionSaveRequest,
  toActivePrescription,
} from './prescription.models';
import { PrescriptionSource } from './prescription-source';
import { ProvisionalPrescriptionSource } from './provisional-prescription-source';

/** Id de fórmula do catálogo real (inteiro positivo); ids de exemplo (`enteral-1`) não existem no backend. */
const API_FORMULA_ID = /^[1-9]\d{0,15}$/u;

/** `PrescricaoItem` de openapi/prescricao-api.yaml. */
interface ItemDto {
  readonly route: NutritionRoute;
  readonly formulaId: number;
  readonly formulaName: string;
  readonly kcalPerMl: number;
  readonly proteinPerMl: number;
  readonly volumeMl: number;
  readonly modality: AdministrationModality;
  readonly startTime: string;
  readonly pauseTimes: readonly string[];
  readonly nursingNotes: string;
  readonly at: string;
  readonly author: string;
}

/** `PrescricaoItemRequest`: sem nome, densidades, autor nem data/hora (o servidor grava o snapshot). */
interface ItemRequestDto {
  readonly route: NutritionRoute;
  readonly formulaId: number;
  readonly volumeMl: number;
  readonly modality: AdministrationModality;
  readonly startTime: string;
  readonly pauseTimes: readonly string[];
  readonly nursingNotes: string;
}

function toPrescription(dto: ItemDto): Prescription {
  return { ...dto, formulaId: String(dto.formulaId) };
}

function toItemRequest(prescription: Prescription): ItemRequestDto {
  if (!API_FORMULA_ID.test(prescription.formulaId)) {
    throw new Error('A fórmula precisa vir do catálogo real da Farmácia do hospital.');
  }

  return {
    formulaId: Number(prescription.formulaId),
    modality: prescription.modality,
    nursingNotes: prescription.nursingNotes,
    pauseTimes: prescription.pauseTimes,
    route: prescription.route,
    startTime: prescription.startTime,
    volumeMl: prescription.volumeMl,
  };
}

/**
 * Prescrição real: `GET`/`PUT /api/v1/pacientes/{id}/prescricao` (`getPrescricaoPaciente`, `savePrescricaoPaciente`).
 * `204` = sem prescrição (lista vazia); cada `PUT` é uma versão nova que substitui o conjunto de vias. Autor e
 * data/hora são do servidor (os do pedido são ignorados). Erros sobem (400/404/rede). Fora do contrato e mantidos no
 * provisório: a revisão diária (`loadReview`/`keep`). Ids de exemplo (`p1`) seguem no provisório.
 */
@Injectable()
export class ApiPrescriptionSource extends PrescriptionSource {
  private readonly http = inject(HttpClient);
  private readonly provisional = inject(ProvisionalPrescriptionSource);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  async load(patientId: string): Promise<readonly Prescription[]> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.load(patientId);
    }
    const body = await firstValueFrom(
      this.http.get<{ readonly prescriptions: readonly ItemDto[] } | null>(`${this.url}/${patientId}/prescricao`),
    );

    return (body?.prescriptions ?? []).map(toPrescription);
  }

  async save(request: PrescriptionSaveRequest): Promise<readonly Prescription[]> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.save(request);
    }
    const body = await firstValueFrom(
      this.http.put<{ readonly prescriptions: readonly ItemDto[] }>(`${this.url}/${request.patientId}/prescricao`, {
        prescriptions: request.prescriptions.map(toItemRequest),
      }),
    );

    return body.prescriptions.map(toPrescription);
  }

  async loadActive(patientId: string): Promise<readonly ActivePrescription[]> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadActive(patientId);
    }

    return (await this.load(patientId)).map(toActivePrescription);
  }

  /** Fora do contrato: a revisão diária segue no provisório. */
  loadReview(patientId: string, day: string): Promise<PrescriptionReview | null> {
    return this.provisional.loadReview(patientId, day);
  }

  /** Fora do contrato: a revisão diária segue no provisório. */
  keep(request: PrescriptionReviewRequest): Promise<PrescriptionReview> {
    return this.provisional.keep(request);
  }
}
