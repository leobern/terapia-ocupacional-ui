import { CensusPatient } from './patient-list.models';

/**
 * Porta de leitura do censo do hospital na data. Sem contrato de API: a implementação real
 * (EP-002) substitui a provisória em `app.config.ts`. Offline, a implementação real devolve o último cache.
 */
export abstract class PatientListSource {
  abstract loadCensus(hospitalId: number, day: Date): Promise<readonly CensusPatient[]>;
}
