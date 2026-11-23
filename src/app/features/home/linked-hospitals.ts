/** Hospital ao qual o profissional autenticado tem vínculo ativo (id numérico do backend). */
export interface LinkedHospital {
  readonly id: number;
  readonly name: string;
}

/**
 * Fronteira de leitura dos hospitais com vínculo ativo do profissional.
 * Assíncrona (como as demais portas da Home); a implementação real é `HomeHospitalsApiService`.
 * Rejeita quando o carregamento falha.
 */
export abstract class LinkedHospitalsReader {
  abstract read(): Promise<readonly LinkedHospital[]>;
}
