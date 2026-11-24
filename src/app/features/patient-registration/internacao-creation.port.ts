export type LocationType = 'UNIDADE' | 'ALA';

/** Localização da internação (US-002-1-07): no máximo 2, uma de cada tipo (RN-03). */
export interface InternacaoLocation {
  readonly locationType: LocationType;
  readonly locationValue: string;
}

/** Dados da internação coletados pelo chatbot (US-002-1-06). Todos opcionais (RN-01): campo vazio não é enviado. */
export interface CreateInternacaoRequest {
  readonly bedNumber?: string;
  readonly healthInsurance?: string;
  readonly admissionNumber?: string;
  /** `aaaa-mm-dd`, não futura (RN-02). */
  readonly hospitalAdmissionDate?: string;
  /** `aaaa-mm-dd`. */
  readonly nutritionalTherapyStartDate?: string;
  /** Opcional; ausente ou vazia não é enviada. */
  readonly locations?: readonly InternacaoLocation[];
}

export interface CreatedInternacao {
  readonly id: number;
  readonly pacienteId: number;
  readonly bedNumber: string | null;
  readonly healthInsurance: string | null;
  readonly admissionNumber: string | null;
  readonly hospitalAdmissionDate: string | null;
  readonly nutritionalTherapyStartDate: string | null;
  readonly locations: readonly InternacaoLocation[];
  readonly createdAt: string;
}

/** Campos que o servidor rejeita com 422 (MSG-08: data futura; MSG-09/MSG-10: localização). */
export type InternacaoField = 'hospitalAdmissionDate' | 'locations';

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
