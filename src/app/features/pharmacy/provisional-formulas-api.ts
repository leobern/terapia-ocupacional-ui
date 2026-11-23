import { Injectable } from '@angular/core';

import { Formula } from './formulas.models';
import { FormulasApi } from './formulas-api';

type CatalogItem = Omit<Formula, 'standardized'>;

const base = { fiber: false, gluten: false, lactose: false, sucrose: false, vegan: false, vegetarian: false };

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
    vegetarian: true,
  },
  {
    ...base,
    category: 'parenteral',
    id: 'parenteral-1',
    kcalPerMl: 1.1,
    name: 'Nutrição parenteral 3 em 1',
    proteinPerMl: 0.05,
  },
  {
    ...base,
    category: 'suplemento-oral',
    id: 'suplemento-1',
    kcalPerMl: 1.5,
    lactose: true,
    name: 'Suplemento oral hiperproteico',
    proteinPerMl: 0.1,
    sucrose: true,
    vegetarian: true,
  },
  {
    ...base,
    category: 'suplemento-oral',
    id: 'suplemento-2',
    kcalPerMl: 1.2,
    name: 'Suplemento oral vegano',
    proteinPerMl: 0.06,
    vegan: true,
    vegetarian: true,
  },
  {
    ...base,
    category: 'medicamento',
    id: 'medicamento-1',
    kcalPerMl: null,
    name: 'Módulo de proteína',
    proteinPerMl: null,
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
