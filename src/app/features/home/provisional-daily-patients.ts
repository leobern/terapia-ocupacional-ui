import { Injectable } from '@angular/core';

import { DailyPatientsSource, DailyPatientsSummary } from './daily-patients';

/** Provisório: valores de exemplo (sem backend) para a Home mostrar o card de contagem e a meta. */
@Injectable()
export class ProvisionalDailyPatientsSource extends DailyPatientsSource {
  loadForDay(): Promise<DailyPatientsSummary> {
    return Promise.resolve({ averageCaloricPercentage: 82, averageProteinPercentage: 64, patientCount: 12 });
  }
}
