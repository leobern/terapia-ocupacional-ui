import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { isApiPatientId } from '../../features/patient-hub/api-patient-hub-source';
import { Formula, FormulaCategory } from '../../features/pharmacy/formulas.models';
import { FormulasApi } from '../../features/pharmacy/formulas-api';
import { ProvisionalFormulasApi } from '../../features/pharmacy/provisional-formulas-api';

/** `Formula` de openapi/formulas-api.yaml (`GET /hospitais/{id}/formulas` e `GET /pacientes/{id}/formulas-padronizadas`). */
interface FormulaDto {
  readonly id: number;
  readonly nome: string;
  readonly categoria: 'ENTERAL' | 'PARENTERAL' | 'SUPLEMENTO_ORAL' | 'MEDICAMENTO';
  readonly kcalPorMl: number | null;
  readonly proteinaPorMl: number | null;
  readonly fibra: boolean | null;
  readonly sacarose: boolean | null;
  readonly lactose: boolean | null;
  readonly gluten: boolean | null;
  readonly vegetariano: boolean | null;
  readonly vegano: boolean | null;
  readonly padronizada: boolean;
}

const CATEGORY: Record<FormulaDto['categoria'], FormulaCategory> = {
  ENTERAL: 'enteral',
  MEDICAMENTO: 'medicamento',
  PARENTERAL: 'parenteral',
  SUPLEMENTO_ORAL: 'suplemento-oral',
};

function toFormula(dto: FormulaDto): Formula {
  return {
    category: CATEGORY[dto.categoria],
    fiber: dto.fibra ?? false,
    gluten: dto.gluten ?? false,
    id: String(dto.id),
    kcalPerMl: dto.kcalPorMl,
    lactose: dto.lactose ?? false,
    name: dto.nome,
    proteinPerMl: dto.proteinaPorMl,
    standardized: dto.padronizada,
    sucrose: dto.sacarose ?? false,
    vegan: dto.vegano ?? false,
    vegetarian: dto.vegetariano ?? false,
  };
}

/** Farmácia contra a API real do EP-009 (backend). Ligada só em `devBackend` até o login existir. */
@Injectable()
export class HttpFormulasApi extends FormulasApi {
  private readonly http = inject(HttpClient);
  private readonly provisional = new ProvisionalFormulasApi();

  async list(hospitalId: number): Promise<readonly Formula[]> {
    const dtos = await firstValueFrom(this.http.get<FormulaDto[]>(`${this.base(hospitalId)}/formulas`));

    return dtos.map(toFormula);
  }

  /**
   * `GET /api/v1/pacientes/{id}/formulas-padronizadas`: o catálogo acima é só do GESTOR, então quem prescreve lê
   * por aqui as padronizadas do hospital do paciente. Paciente de exemplo (`p1`) segue no provisório.
   */
  async listStandardizedForPatient(patientId: string, hospitalId: number): Promise<readonly Formula[]> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.listStandardizedForPatient(patientId, hospitalId);
    }
    const dtos = await firstValueFrom(
      this.http.get<FormulaDto[]>(`${environment.apiBaseUrl}/v1/pacientes/${patientId}/formulas-padronizadas`),
    );

    return dtos.map(toFormula);
  }

  async setStandardized(hospitalId: number, formulaId: string, standardized: boolean): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.base(hospitalId)}/formulas/${encodeURIComponent(formulaId)}/padronizacao`, {
        padronizada: standardized,
      }),
    );
  }

  async requestFormula(hospitalId: number, description: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base(hospitalId)}/solicitacoes-formula`, { descricao: description }));
  }

  private base(hospitalId: number): string {
    if (!Number.isInteger(hospitalId)) {
      throw new Error(`Hospital inválido para a API: ${hospitalId}`);
    }

    return `${environment.apiBaseUrl}/v1/hospitais/${hospitalId}`;
  }
}
