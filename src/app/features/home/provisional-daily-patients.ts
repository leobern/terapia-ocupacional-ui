import { Injectable } from '@angular/core';

import { DailyPatientsSource, DailyPatientsSummary } from './daily-patients';

/** Provisório: sem backend definido, nenhum paciente (neutro). */
@Injectable()
export class ProvisionalDailyPatientsSource extends DailyPatientsSource {
  loadForDay(): Promise<DailyPatientsSummary> {
    return Promise.resolve({ averageCaloricPercentage: 0, averageProteinPercentage: 0, patientCount: 0 });
  }
}
