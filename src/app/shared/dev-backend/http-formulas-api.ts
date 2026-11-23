import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { Formula, FormulaCategory } from '../../features/pharmacy/formulas.models';
import { FormulasApi } from '../../features/pharmacy/formulas-api';

/** Resposta de `GET /api/v1/hospitais/{id}/formulas` (backend, FormulaResponse). */
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

/** Farmácia contra a API real do EP-009 (backend). Ligada só em `devBackend` até o login existir. */
@Injectable()
export class HttpFormulasApi extends FormulasApi {
  private readonly http = inject(HttpClient);

  async list(hospitalId: number): Promise<readonly Formula[]> {
    const dtos = await firstValueFrom(this.http.get<FormulaDto[]>(`${this.base(hospitalId)}/formulas`));

    return dtos.map(dto => ({
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
    }));
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
