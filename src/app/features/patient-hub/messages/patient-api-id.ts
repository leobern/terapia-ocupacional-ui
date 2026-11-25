/**
 * Id do paciente no contrato (`int64`). O Hub ainda guarda o id como texto (e a lista provisória usa
 * ids como "p1"): um id que não é inteiro positivo nunca chega à API.
 */
export function asPatientApiId(patientId: string): number {
  const id = Number(patientId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`Id de paciente inválido para a API: ${patientId}`);
  }

  return id;
}
