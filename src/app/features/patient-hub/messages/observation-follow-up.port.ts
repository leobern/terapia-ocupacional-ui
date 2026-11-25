import { RecipientRef, RecipientSpec } from './patient-message.models';

/** Pendência de reavaliação sugerida para uma observação (`SugestaoPendencia`, openapi/mensagens-api.yaml). */
export interface PendingSuggestion {
  /** Prazo sugerido (ISO 8601). */
  readonly suggestedDueAt: string;
  readonly defaultRecipients: readonly RecipientSpec[];
  /** Profissionais vinculados e aprovados ao paciente que o destinatário padrão atingiria. */
  readonly resolvedRecipients: readonly RecipientRef[];
  readonly rationale: string | null;
}

/** Comunicação sugerida (`SugestaoComunicacao`): destinatários e rascunho editável. */
export interface CommunicationSuggestion {
  readonly suggestedRecipients: readonly RecipientSpec[];
  readonly resolvedRecipients: readonly RecipientRef[];
  readonly draft: string;
}

/** Cada sugestão é independente e `null` quando o assistente não identifica necessidade. */
export interface RecordSuggestions {
  readonly pendencia: PendingSuggestion | null;
  readonly comunicacao: CommunicationSuggestion | null;
}

/**
 * Porta das sugestões e ações a partir de uma observação (FT-005-1, US-005-1-04). `suggestions` rejeita
 * quando o backend ou a IA estão indisponíveis: nada é exibido e a observação segue registrada (FR-019).
 * Nada é criado ou enviado sem a confirmação explícita do profissional.
 */
export abstract class ObservationFollowUpPort {
  abstract suggestions(patientId: string, recordId: string): Promise<RecordSuggestions>;
  /** `recipients` nulo = destinatário padrão do backend (grupo do mesmo perfil do autor). */
  abstract createPending(
    patientId: string,
    recordId: string,
    dueAt: string,
    recipients: readonly RecipientSpec[] | null,
  ): Promise<void>;
  abstract sendCommunication(
    patientId: string,
    recordId: string,
    content: string,
    recipients: readonly RecipientSpec[],
  ): Promise<void>;
  /** Substitui os destinatários de uma pendência já criada (FR-014c). */
  abstract changePendingRecipients(
    patientId: string,
    threadId: string,
    recipients: readonly RecipientSpec[],
  ): Promise<void>;
}
