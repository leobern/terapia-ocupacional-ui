import { Injectable } from '@angular/core';

import { Formula } from './formulas.models';
import { FormulasApi } from './formulas-api';

type CatalogItem = Omit<Formula, 'standardized'>;

const base = {
  fiber: false,
  gluten: false,
  lactose: false,
  manufacturer: null,
  packaging: null,
  presentation: 'Líquido',
  route: 'Oral/Sonda',
  sucrose: false,
  unit: 'ml',
} as const;

const CATALOG: readonly CatalogItem[] = [
  { ...base, category: 'enteral', id: 'enteral-1', kcalPerMl: 1, name: 'Fórmula polimérica 1.0', proteinPerMl: 0.04 },
  {
    ...base,
    category: 'enteral',
    fiber: true,
    id: 'enteral-2',
    kcalPerMl: 1.5,
    name: 'Fórmula hipercalórica com fibras',
    proteinPerMl: 0.06,
  },
  {
    ...base,
    category: 'parenteral',
    fiber: null,
    gluten: null,
    id: 'parenteral-1',
    kcalPerMl: 1.1,
    lactose: null,
    name: 'Nutrição parenteral 3 em 1',
    proteinPerMl: 0.05,
    route: 'Endovenosa (central)',
    sucrose: null,
  },
  {
    ...base,
    category: 'modulo-proteico',
    id: 'modulo-1',
    kcalPerMl: 3.7,
    name: 'Módulo de proteína',
    presentation: 'Pó',
    proteinPerMl: 0.9,
    unit: 'g',
  },
  {
    ...base,
    category: 'suplemento-oral',
    id: 'suplemento-1',
    kcalPerMl: 1.5,
    lactose: true,
    name: 'Suplemento oral hiperproteico',
    proteinPerMl: 0.1,
    route: 'Oral',
    sucrose: true,
  },
  {
    ...base,
    category: 'espessante',
    id: 'espessante-1',
    kcalPerMl: null,
    name: 'Espessante',
    presentation: 'Pó espessante',
    proteinPerMl: null,
    route: 'Oral',
    unit: 'g',
  },
  {
    ...base,
    category: 'medicamento',
    id: 'medicamento-1',
    kcalPerMl: null,
    name: 'Polivitamínico',
    presentation: 'Pó liofilizado',
    proteinPerMl: null,
    route: 'Endovenosa',
  },
];

/** Provisório: catálogo fixo; a padronização fica em memória, separada por hospital. */
@Injectable()
export class ProvisionalFormulasApi extends FormulasApi {
  /** Pedidos registrados nesta sessão (provisório; a API real guarda hospital, solicitante e data/hora). */
  readonly requests: { readonly description: string; readonly hospitalId: number }[] = [];
  private readonly standardizedByHospital = new Map<number, Set<string>>();

  list(hospitalId: number): Promise<readonly Formula[]> {
    const ids = this.standardizedByHospital.get(hospitalId);

    return Promise.resolve(CATALOG.map(item => ({ ...item, standardized: ids?.has(item.id) ?? false })));
  }

  async listStandardizedForPatient(_: string, hospitalId: number): Promise<readonly Formula[]> {
    return (await this.list(hospitalId)).filter(formula => formula.standardized);
  }

  setStandardized(hospitalId: number, formulaId: string, standardized: boolean): Promise<void> {
    const ids = this.standardizedByHospital.get(hospitalId) ?? new Set<string>();

    if (standardized) {
      ids.add(formulaId);
    } else {
      ids.delete(formulaId);
    }
    this.standardizedByHospital.set(hospitalId, ids);

    return Promise.resolve();
  }

  requestFormula(hospitalId: number, description: string): Promise<void> {
    this.requests.push({ description, hospitalId });

    return Promise.resolve();
  }
}
