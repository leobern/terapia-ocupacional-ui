/** Motivo da falha da verificação de duplicidade, já classificado a partir da resposta da API. */
export type PatientDuplicateFailure =
  'access-denied' | 'invalid-date' | 'invalid-name' | 'session-expired' | 'unavailable';

export class PatientDuplicateError extends Error {
  constructor(readonly failure: PatientDuplicateFailure) {
    super(failure);
  }
}
