import { Injectable } from '@angular/core';

import { MeasuresSource, PatientMeasures } from './measures-source';

const HEIGHT_CM = 163;

/** Pesos do Figma 4608:4845 (kg); o IMC é calculado da altura de 1,63 m. */
const WEIGHTS: readonly (readonly [string, number])[] = [
  ['2026-05-01T09:00:00', 48.5],
  ['2026-05-10T09:00:00', 49.4],
  ['2026-05-15T09:00:00', 49.9],
  ['2026-05-18T09:00:00', 50.2],
  ['2026-05-20T09:00:00', 50.4],
  ['2026-05-28T09:00:00', 51],
];

/** Provisório: séries fixas do Figma para os pacientes de exemplo ("p1"…), sem backend. */
@Injectable()
export class ProvisionalMeasuresSource extends MeasuresSource {
  load(_: string): Promise<PatientMeasures> {
    return Promise.resolve({
      admissionDate: '2026-05-01',
      admissionWeightKg: WEIGHTS[0][1],
      bmiIdealRange: { max: 24.9, min: 18.5 },
      points: WEIGHTS.map(([at, weightKg]) => ({
        at,
        bmi: Math.round((weightKg / (HEIGHT_CM / 100) ** 2) * 10) / 10,
        heightCm: HEIGHT_CM,
        weightKg,
      })),
    });
  }
}
