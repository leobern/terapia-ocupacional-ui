import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { isApiPatientId } from '../patient-hub/api-patient-hub-source';
import { Formula, FormulaCategory } from './formulas.models';
import { FormulasApi } from './formulas-api';
import { ProvisionalFormulasApi } from './provisional-formulas-api';

/** `Formula` de openapi/formulas-api.yaml (`GET /hospitais/{id}/formulas` e `GET /pacientes/{id}/formulas-padronizadas`). */
interface FormulaDto {
  readonly id: number;
  readonly nome: string;
  readonly categoria: 'ENTERAL' | 'PARENTERAL' | 'MODULO_PROTEICO' | 'SUPLEMENTO_ORAL' | 'ESPESSANTE' | 'MEDICAMENTO';
  readonly fabricante: string | null;
  readonly tipoApresentacao: string | null;
  readonly unidadeBase: 'ML' | 'G';
  readonly viaAdministracao: string | null;
  readonly embalagem: string | null;
  readonly kcalPorMl: number | null;
  readonly proteinaPorMl: number | null;
  readonly fibra: boolean | null;
  readonly sacarose: boolean | null;
  readonly lactose: boolean | null;
  readonly gluten: boolean | null;
  readonly padronizada: boolean;
}

const CATEGORY: Record<FormulaDto['categoria'], FormulaCategory> = {
  ENTERAL: 'enteral',
  ESPESSANTE: 'espessante',
  MEDICAMENTO: 'medicamento',
  MODULO_PROTEICO: 'modulo-proteico',
  PARENTERAL: 'parenteral',
  SUPLEMENTO_ORAL: 'suplemento-oral',
};

/** Atributo nulo continua nulo: "não informado" nunca vira "Não". */
function toFormula(dto: FormulaDto): Formula {
  return {
    category: CATEGORY[dto.categoria],
    fiber: dto.fibra,
    gluten: dto.gluten,
    id: String(dto.id),
    kcalPerMl: dto.kcalPorMl,
    lactose: dto.lactose,
    manufacturer: dto.fabricante,
    name: dto.nome,
    packaging: dto.embalagem,
    presentation: dto.tipoApresentacao,
    proteinPerMl: dto.proteinaPorMl,
    route: dto.viaAdministracao,
    standardized: dto.padronizada,
    sucrose: dto.sacarose,
    unit: dto.unidadeBase === 'G' ? 'g' : 'ml',
  };
}

/** Hospital que existe no backend (inteiro positivo); os cadastrados só neste aparelho têm id negativo (provisório). */
function isApiHospitalId(hospitalId: number): boolean {
  return Number.isInteger(hospitalId) && hospitalId > 0;
}

/**
 * Farmácia contra a API real do EP-009 (backend), em todos os ambientes. Segue o critério das outras fontes reais:
 * id de hospital/paciente que existe no backend vai por HTTP; ids de exemplo (hospital local, paciente `p1`) ficam no
 * `ProvisionalFormulasApi`. A autenticação é a da sessão (`sessionAuthInterceptor`); o token de teste só entra em
 * `devBackend`.
 */
@Injectable()
export class HttpFormulasApi extends FormulasApi {
  private readonly http = inject(HttpClient);
  private readonly provisional = new ProvisionalFormulasApi();

  async list(hospitalId: number): Promise<readonly Formula[]> {
    if (!isApiHospitalId(hospitalId)) {
      return this.provisional.list(hospitalId);
    }
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
    if (!isApiHospitalId(hospitalId)) {
      return this.provisional.setStandardized(hospitalId, formulaId, standardized);
    }
    await firstValueFrom(
      this.http.put(`${this.base(hospitalId)}/formulas/${encodeURIComponent(formulaId)}/padronizacao`, {
        padronizada: standardized,
      }),
    );
  }

  async requestFormula(hospitalId: number, description: string): Promise<void> {
    if (!isApiHospitalId(hospitalId)) {
      return this.provisional.requestFormula(hospitalId, description);
    }
    await firstValueFrom(this.http.post(`${this.base(hospitalId)}/solicitacoes-formula`, { descricao: description }));
  }

  private base(hospitalId: number): string {
    return `${environment.apiBaseUrl}/v1/hospitais/${hospitalId}`;
  }
}
