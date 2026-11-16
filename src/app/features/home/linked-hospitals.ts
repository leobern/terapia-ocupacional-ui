/** Hospital ao qual o profissional autenticado tem vínculo ativo. */
export interface LinkedHospital {
  readonly id: string;
  readonly name: string;
}

/**
 * Fronteira de leitura dos hospitais com vínculo ativo do profissional.
 *
 * DEPENDÊNCIA: EP-001 (fluxo de vínculo hospitalar) fornecerá a implementação real,
 * substituindo `MockLinkedHospitalsReader` em `app.config.ts`.
 */
export abstract class LinkedHospitalsReader {
  abstract read(): readonly LinkedHospital[];
}
