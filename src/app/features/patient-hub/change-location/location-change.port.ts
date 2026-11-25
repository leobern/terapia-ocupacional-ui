/** Tipo da linha de localização da internação (US-002-1-07): no máximo uma linha de cada. */
export type LocationType = 'ALA' | 'UNIDADE';

/** Prévia da alteração: CREATE quando a internação não tem linha do tipo, UPDATE quando já tem (US-002-2-06, RN-03). */
export interface ResolvedLocationChange {
  readonly pacienteId: number;
  readonly internacaoId: number;
  readonly locationType: LocationType;
  readonly action: 'CREATE' | 'UPDATE';
  /** Valor atual da linha; `null` quando `action` é CREATE. */
  readonly currentValue: string | null;
  readonly newValue: string;
}

/** 422 MSG-09 (tipo não identificado) ou MSG-10 (valor vazio) em `field`. */
export class LocationNotIdentifiedError extends Error {
  constructor(
    readonly field: string,
    readonly code: string,
    message = '',
  ) {
    super(message);
  }
}

/**
 * Fronteira da alteração de unidade/ala. `resolve` não grava nada; `confirm` cria ou atualiza a linha depois do
 * "Sim" (o histórico é gravado pelo servidor). MSG-11 rejeita com `PatientWithoutInternacaoError`, MSG-09/10 com
 * `LocationNotIdentifiedError`.
 */
export abstract class LocationChangePort {
  abstract resolve(pacienteId: number, type: LocationType, value: string): Promise<ResolvedLocationChange>;
  abstract confirm(pacienteId: number, internacaoId: number, type: LocationType, value: string): Promise<void>;
}

/** Pedido extraído da mensagem: tipo e valor (vazio quando a mensagem não trouxe). */
export interface LocationRequest {
  readonly type: LocationType;
  readonly value: string;
}

/**
 * Fronteira que extrai tipo e valor de uma mensagem livre ("unidade UTI"). A extração por linguagem natural é do
 * motor de IA (fora de escopo); o provisório é substituível sem tocar na ação.
 */
export abstract class LocationExtractor {
  abstract extract(message: string): LocationRequest | null;
}
