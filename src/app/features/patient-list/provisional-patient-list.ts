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
  admitted = true,
): CensusPatient => ({
  admissionStatus: admitted ? 'ADMITTED_BY_EMTN' : 'NOT_ADMITTED',
  bed,
  birthDate,
  hospitalId: H,
  id,
  name,
  registeredInConductia: true,
  therapy,
  ward,
});

/** Provisório: dados de exemplo (sem backend), incluindo um paciente do censo geral não admitido. */
@Injectable()
export class ProvisionalPatientListSource extends PatientListSource {
  loadCensus(): Promise<readonly CensusPatient[]> {
    return Promise.resolve([
      p('p1', 'Lucas Henrique Pimentel', '2000-01-19', 'Ala 1', '31', 'NE'),
      p('p2', 'Mariana Alves Figueiredo', '1991-03-12', 'Ala 1', '29', 'MISTA'),
      p('p3', 'Rafael Cunha Moreira', '1987-08-27', 'Ala 1', '30', 'MISTA'),
      p('p4', 'Camila Rocha Tavares', '1998-11-05', 'Ala 2', '32', 'NE'),
      p('p5', 'Ana Beatriz Lopes', '1974-02-02', 'Ala 2', '33', 'VO'),
      p('p6', 'Bruno Oliveira Petrovich', '2001-04-13', 'Subsolo', '7', 'NE'),
      p('p7', 'Paulo Mendes Castro', '1964-09-21', 'Subsolo', '9', 'NP'),
      p('p8', 'Maria Eduarda de Albuquerque Cavalcanti Nogueira Santos', '1950-05-05', 'Ala 2', '35', 'VO'),
      p('x1', 'Paciente do censo geral', '1980-01-01', 'Ala 3', '1', 'VO', false),
      { ...p('x2', 'Paciente sem cadastro', '1980-01-01', 'Ala 3', '2', 'VO'), registeredInConductia: false },
    ]);
  }
}
