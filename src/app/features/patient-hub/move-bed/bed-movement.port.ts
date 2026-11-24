/** Internação mais recente do paciente associada ao pedido de mudança de leito (US-002-2-01, RN-01). */
export interface ResolvedBedMovement {
  readonly pacienteId: number;
  readonly internacaoId: number;
  /** Leito atual da internação; `null` quando ela ainda não tem leito. */
  readonly currentBedNumber: string | null;
  readonly newBedNumber: string;
}

/** RN-02 (MSG-11): paciente sem nenhuma internação; a movimentação não é processada. */
export class PatientWithoutInternacaoError extends Error {
  constructor(message = '') {
    super(message);
  }
}

/** RN-03 (MSG-12): leito não identificado na mensagem; o profissional deve informá-lo de novo. */
export class BedNotIdentifiedError extends Error {
  constructor(
    readonly field: string,
    message = '',
  ) {
    super(message);
  }
}

/**
 * Fronteira que associa o pedido de mudança de leito à internação mais recente do paciente. Não grava nada
 * (confirmação e aplicação são da US-002-2-03). Rejeita com `PatientWithoutInternacaoError` (MSG-11) ou
 * `BedNotIdentifiedError` (MSG-12); qualquer outro erro é falha genérica.
 */
export abstract class BedMovementPort {
  abstract resolve(pacienteId: number, newBedNumber?: string): Promise<ResolvedBedMovement>;
}
