/** Dados da internação coletados pelo chatbot (US-002-1-06). Todos opcionais (RN-01): campo vazio não é enviado. */
export interface CreateInternacaoRequest {
  readonly bedNumber?: string;
  readonly healthInsurance?: string;
  readonly admissionNumber?: string;
  /** `aaaa-mm-dd`, não futura (RN-02). */
  readonly hospitalAdmissionDate?: string;
  /** `aaaa-mm-dd`. */
  readonly nutritionalTherapyStartDate?: string;
}

export interface CreatedInternacao {
  readonly id: number;
  readonly pacienteId: number;
  readonly bedNumber: string | null;
  readonly healthInsurance: string | null;
  readonly admissionNumber: string | null;
  readonly hospitalAdmissionDate: string | null;
  readonly nutritionalTherapyStartDate: string | null;
  readonly createdAt: string;
}

/** Único campo que o servidor rejeita com 422 (MSG-08: data de internação futura). */
export type InternacaoField = 'hospitalAdmissionDate';

/** Validação rejeitada pelo servidor: `field` indica a pergunta a repetir e `message` (se houver) o texto a exibir. */
export class InternacaoFieldError extends Error {
  constructor(
    readonly field: InternacaoField,
    readonly code: string,
    message = '',
  ) {
    super(message);
  }
}

/**
 * Fronteira de criação da internação do paciente (registro variável, 1:N). Rejeita com `InternacaoFieldError`
 * quando o servidor recusa um campo; qualquer outro erro é falha genérica.
 */
export abstract class InternacaoCreationPort {
  abstract create(pacienteId: number, request: CreateInternacaoRequest): Promise<CreatedInternacao>;
}
