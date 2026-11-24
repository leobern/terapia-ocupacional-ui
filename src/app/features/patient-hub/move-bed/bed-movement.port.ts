import { HttpErrorResponse } from '@angular/common/http';

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

/** Situação de ocupação do leito de destino (US-002-2-04, RN-01..RN-03). */
export interface BedOccupancy {
  readonly newBedNumber: string;
  readonly occupied: boolean;
  /** Nomes dos pacientes cuja internação mais recente está no leito; vazio quando livre. */
  readonly occupants: readonly { readonly pacienteId: number; readonly name: string }[];
}

/**
 * Fronteira que consulta se o leito de destino já está ocupado por outro paciente do mesmo hospital.
 * Sem efeito colateral; mesmos erros tipados de `BedMovementPort` (MSG-11 e MSG-12).
 */
export abstract class BedOccupancyPort {
  abstract check(pacienteId: number, newBedNumber: string): Promise<BedOccupancy>;
}

/** Converte 422 MSG-11/MSG-12 nos erros tipados; qualquer outro erro é devolvido como está. */
export function translateMovementError(error: unknown): unknown {
  if (error instanceof HttpErrorResponse && error.status === 422) {
    const data = error.error as { field?: string; code?: string; message?: string } | null;

    if (data?.code === 'MSG-11') {
      return new PatientWithoutInternacaoError(data.message ?? '');
    }
    if (data?.code === 'MSG-12') {
      return new BedNotIdentifiedError(data.field ?? 'newBedNumber', data.message ?? '');
    }
  }

  return error;
}
