import { Injectable } from '@angular/core';

import { CensusPatient } from './patient-list.models';
import { PatientListSource } from './patient-list-source';

const H = 'hospital-vila-nova-star';
const p = (
  id: string,
  name: string,
  birthDate: string,
  ward: string,
  bed: string,
  therapy: CensusPatient['therapy'],
  therapyStartDate: string,
  adequacy: CensusPatient['adequacy'],
  completedCycles: number,
  admitted = true,
): CensusPatient => ({
  adequacy,
  admissionStatus: admitted ? 'ADMITTED_BY_EMTN' : 'NOT_ADMITTED',
  bed,
  birthDate,
  completedCycles,
  hospitalId: H,
  id,
  name,
  registeredInConductia: true,
  therapy,
  therapyStartDate,
  ward,
});

/** Provisório: dados de exemplo (sem backend), incluindo um paciente do censo geral não admitido. */
@Injectable()
export class ProvisionalPatientListSource extends PatientListSource {
  loadCensus(): Promise<readonly CensusPatient[]> {
    return Promise.resolve([
      p(
        'p1',
        'Lucas Henrique Pimentel',
        '2000-01-19',
        'Ala 1',
        '31',
        'NE',
        '2026-11-10',
        { caloric: 82, protein: 74 },
        1,
      ),
      p(
        'p2',
        'Mariana Alves Figueiredo',
        '1991-03-12',
        'Ala 1',
        '29',
        'MISTA',
        '2026-10-01',
        { caloric: 45, protein: 38 },
        2,
      ),
      p('p3', 'Rafael Cunha Moreira', '1987-08-27', 'Ala 1', '30', 'MISTA', '2026-11-18', null, 0),
      p(
        'p4',
        'Camila Rocha Tavares',
        '1998-11-05',
        'Ala 2',
        '32',
        'NE',
        '2026-11-05',
        { caloric: 15, protein: null },
        1,
      ),
      p('p5', 'Ana Beatriz Lopes', '1974-02-02', 'Ala 2', '33', 'VO', '2026-09-20', { caloric: 100, protein: 95 }, 3),
      p('p6', 'Bruno Oliveira Petrovich', '2001-04-13', 'Subsolo', '7', 'NE', '2026-11-19', null, 0),
      p(
        'p7',
        'Paulo Mendes Castro',
        '1964-09-21',
        'Subsolo',
        '9',
        'NP',
        '2026-11-12',
        { caloric: null, protein: 60 },
        1,
      ),
      p(
        'p8',
        'Maria Eduarda de Albuquerque Cavalcanti Nogueira Santos',
        '1950-05-05',
        'Ala 2',
        '35',
        'VO',
        '2026-08-30',
        { caloric: 70, protein: 66 },
        2,
      ),
      p('x1', 'Paciente do censo geral', '1980-01-01', 'Ala 3', '1', 'VO', '2026-11-01', null, 0, false),
      {
        ...p('x2', 'Paciente sem cadastro', '1980-01-01', 'Ala 3', '2', 'VO', '2026-11-01', null, 0),
        registeredInConductia: false,
      },
    ]);
  }
}
