import { Injectable } from '@angular/core';

import { NutritionValues } from './nutrition-panel.models';
import { NutritionResultsSource } from './nutrition-results-source';

/** Provisório (motores de origem ainda não existem): só o paciente p1 tem resultados de exemplo. */
@Injectable()
export class ProvisionalNutritionResultsSource extends NutritionResultsSource {
  load(patientId: string): Promise<NutritionValues> {
    if (patientId !== 'p1') {
      return Promise.resolve({});
    }

    return Promise.resolve({
      'calorie-adequacy': '82%',
      glim: 'Desnutrição moderada',
      'nrs-2002': 'Em risco (3 pontos)',
      'protein-adequacy': '74%',
      'sarc-f': 'Baixo risco (2 pontos)',
      'therapy-type': 'Enteral',
    });
  }
}
