import { inject, Injectable } from '@angular/core';

import { assemblePatientList } from '../patient-list/patient-list-assembly';
import { PatientListSource } from '../patient-list/patient-list-source';
import { DailyPatientsSource, DailyPatientsSummary } from './daily-patients';

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Resumo do dia calculado a partir do censo (Thiago, 2026-11-25): o contador é o total de pacientes acompanhados no dia e
 * o gráfico é a média das adequações calórica e proteica desses pacientes (quem não tem prescrição ativa fica fora da média).
 */
@Injectable()
export class CensusDailyPatientsSource extends DailyPatientsSource {
  private readonly census = inject(PatientListSource);

  async loadForDay(hospitalId: number, day: Date): Promise<DailyPatientsSummary> {
    // Mesma montagem da lista de pacientes: o contador e a lista sempre batem.
    const patients = assemblePatientList(await this.census.loadCensus(hospitalId, day), hospitalId, day);
    const caloric = patients.flatMap(p => (p.adequacy?.caloric == null ? [] : [p.adequacy.caloric]));
    const protein = patients.flatMap(p => (p.adequacy?.protein == null ? [] : [p.adequacy.protein]));

    return {
      averageCaloricPercentage: average(caloric),
      averageProteinPercentage: average(protein),
      patientCount: patients.length,
    };
  }
}
