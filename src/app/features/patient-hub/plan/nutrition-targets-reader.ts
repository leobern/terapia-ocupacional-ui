import { inject, Injectable } from '@angular/core';

import { PlanSource } from './plan-source';
import { NutritionTargets } from './plan-targets';

/**
 * Porta de leitura das metas vigentes do paciente (calórica e proteica, em total/dia e por kg), para a
 * Evolução Diária (FT-004-7) e a Prescrição (FT-004-8) — sem nova coleta. Devolve `null` quando não há metas.
 */
export abstract class NutritionTargetsReader {
  abstract current(patientId: string): Promise<NutritionTargets | null>;
}

@Injectable()
export class PlanNutritionTargetsReader extends NutritionTargetsReader {
  private readonly source = inject(PlanSource);

  current(patientId: string): Promise<NutritionTargets | null> {
    return this.source.loadTargets(patientId);
  }
}
