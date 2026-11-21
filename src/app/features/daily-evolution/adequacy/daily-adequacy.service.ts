import { inject, Injectable } from '@angular/core';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NutritionTargetsReader } from '../../patient-hub/plan/nutrition-targets-reader';
import { computeAdequacy, DailyAdequacy } from './adequacy.models';
import { FoodRecallSource, InfusedIntakeSource } from './intake-sources';

/**
 * Único ponto de cálculo da % de adequação do dia (FT-004-7, US3). Painel e Plano apenas exibem o
 * resultado. Exige conexão; erro de leitura propaga (quem exibe mantém o último valor).
 */
@Injectable({ providedIn: 'root' })
export class DailyAdequacyService {
  private readonly connectivity = inject(ConnectivityService);
  private readonly targets = inject(NutritionTargetsReader);
  private readonly infusion = inject(InfusedIntakeSource);
  private readonly food = inject(FoodRecallSource);

  async calculate(patientId: string): Promise<DailyAdequacy> {
    if (!this.connectivity.online()) {
      return { reason: 'offline', status: 'unavailable' };
    }
    const [targets, infusion, food] = await Promise.all([
      this.targets.current(patientId),
      this.infusion.today(patientId),
      this.food.today(patientId),
    ]);

    return computeAdequacy(targets, infusion, food);
  }
}
