import { TestBed } from '@angular/core/testing';

import { CensusPatient } from '../patient-list/patient-list.models';
import { PatientListSource } from '../patient-list/patient-list-source';
import { CensusDailyPatientsSource } from './census-daily-patients';

function patient(id: string, over: Partial<CensusPatient>): CensusPatient {
  return {
    adequacy: null,
    admissionStatus: 'ADMITTED_BY_EMTN',
    bed: '1',
    birthDate: '1980-01-01',
    completedCycles: 1,
    hospitalId: 1,
    id,
    name: id,
    registeredInConductia: true,
    therapy: 'NE',
    therapyStartDate: '2026-01-01',
    ward: 'UTI',
    ...over,
  } as CensusPatient;
}

describe('CensusDailyPatientsSource', () => {
  const load = async (list: readonly CensusPatient[]): Promise<unknown> => {
    TestBed.configureTestingModule({
      providers: [
        CensusDailyPatientsSource,
        {
          provide: PatientListSource,
          useValue: { loadCensus: (): Promise<readonly CensusPatient[]> => Promise.resolve(list) },
        },
      ],
    });

    return TestBed.inject(CensusDailyPatientsSource).loadForDay(1, new Date());
  };

  it('conta os pacientes do dia e tira a média das adequações, ignorando quem não tem prescrição', async () => {
    expect(
      await load([
        patient('a', { adequacy: { caloric: 80, protein: 60 } }),
        patient('b', { adequacy: { caloric: 90, protein: null } }),
        patient('c', {}),
        patient('d', { registeredInConductia: false }),
        patient('f', { hospitalId: 2 }),
        patient('e', { admissionStatus: 'NOT_ADMITTED' }),
      ]),
    ).toEqual({ averageCaloricPercentage: 85, averageProteinPercentage: 60, patientCount: 3 });
  });

  it('sem pacientes a média é zero', async () => {
    expect(await load([])).toEqual({ averageCaloricPercentage: 0, averageProteinPercentage: 0, patientCount: 0 });
  });
});
