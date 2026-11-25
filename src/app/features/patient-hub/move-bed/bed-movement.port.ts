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

/** RN-04 (MSG-13): nenhum paciente do hospital ativo tem o nome informado (US-002-2-02). */
export class PatientNotFoundError extends Error {
  constructor(message = '') {
    super(message);
  }
}

/** Paciente listado quando o nome coincide com mais de um (RN-03): nome, data de nascimento e SAME. */
export interface PatientCandidate {
  readonly id: number;
  readonly fullName: string;
  /** `yyyy-MM-dd`. */
  readonly birthDate: string;
  /** SAME, quando preenchido. */
  readonly medicalRecordNumber: string | null;
}

/** Resultado da busca por nome: um paciente já associado à internação mais recente, ou os candidatos. */
export type ResolvedByName =
  | { readonly kind: 'single'; readonly resolved: ResolvedBedMovement }
  | { readonly kind: 'multiple'; readonly candidates: readonly PatientCandidate[] };

/**
 * Fronteira da movimentação de leito. `resolve` associa o pedido à internação mais recente do paciente e não
 * grava nada; `confirm` aplica a mudança depois do "Sim" (US-002-2-03). Rejeita com `PatientWithoutInternacaoError` (MSG-11) ou
 * `BedNotIdentifiedError` (MSG-12); qualquer outro erro é falha genérica.
 */
export abstract class BedMovementPort {
  abstract resolve(pacienteId: number, newBedNumber?: string): Promise<ResolvedBedMovement>;
  /**
   * US-002-2-02: identifica o paciente pelo nome, só entre os do hospital informado. Além de MSG-11/MSG-12,
   * rejeita com `PatientNotFoundError` (MSG-13).
   */
  abstract resolveByName(hospitalId: number, fullName: string, newBedNumber?: string): Promise<ResolvedByName>;
  /** Aplica o novo leito à internação já identificada; 422 MSG-12 rejeita com `BedNotIdentifiedError`. */
  abstract confirm(pacienteId: number, internacaoId: number, newBedNumber: string): Promise<void>;
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
