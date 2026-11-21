/** Motivo do encerramento do acompanhamento (FR-002). */
export type ClosureReason = 'hospital-discharge' | 'death' | 'emtn-discharge' | 'external-transfer';

export interface ClosureReasonOption {
  readonly id: ClosureReason;
  readonly label: string;
  /** Texto de apoio em linha, quando o nome sozinho não basta. */
  readonly help?: string;
}

export const CLOSURE_REASONS: readonly ClosureReasonOption[] = [
  { id: 'hospital-discharge', label: 'Alta hospitalar' },
  { id: 'death', label: 'Óbito' },
  { help: 'Segue internado, sem indicação de terapia nutricional.', id: 'emtn-discharge', label: 'Alta da EMTN' },
  { id: 'external-transfer', label: 'Transferência externa' },
];

export function reasonLabel(reason: ClosureReason): string {
  return CLOSURE_REASONS.find(option => option.id === reason)?.label ?? reason;
}

/** Dados de um encerramento a gravar: autor e data/hora seguem para a trilha de auditoria (FR-006). */
export interface FollowUpClosureRequest {
  readonly patientId: string;
  readonly reason: ClosureReason;
  /** AAAA-MM-DD: a partir dela o paciente sai da lista "a avaliar" (FR-005). */
  readonly effectiveDate: string;
  readonly author: string;
  /** ISO 8601: data/hora do registro. */
  readonly at: string;
}

/** Registro imutável: um paciente pode ter vários ao longo do tempo (nunca se edita nem se apaga). */
export interface FollowUpClosure extends FollowUpClosureRequest {
  readonly id: string;
}

export const FUTURE_DATE_HINT = 'A data do encerramento não pode ser futura.';
export const INVALID_DATE_HINT = 'Informe uma data válida.';
export const REASON_REQUIRED_HINT = 'Escolha o motivo do encerramento.';
export const OFFLINE_CLOSURE_HINT = 'Conexão necessária para encerrar o acompanhamento.';
export const CLOSURE_FAILED_HINT = 'Não foi possível encerrar o acompanhamento. Nada foi alterado; tente novamente.';

/** AAAA-MM-DD no fuso local (não UTC: a data de efeito é o dia do calendário do profissional). */
export function toIsoDate(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');

  return `${day.getFullYear()}-${month}-${date}`;
}

/** DD/MM/AAAA para exibição. */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-');

  return `${day}/${month}/${year}`;
}

/** `null` = data válida (passada ou hoje); data futura não é aceita (decisão do desenho). */
export function validateEffectiveDate(value: string, today: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00`))) {
    return INVALID_DATE_HINT;
  }

  return value > toIsoDate(today) ? FUTURE_DATE_HINT : null;
}

/** Dados de uma reabertura a gravar: autor e data/hora seguem para a trilha de auditoria (FR-012). */
export interface FollowUpReopeningRequest {
  readonly patientId: string;
  /** Encerramento que a reabertura reverte; ele permanece intacto no histórico. */
  readonly closureId: string;
  readonly author: string;
  /** ISO 8601: data/hora do registro. */
  readonly at: string;
}

/** Registro imutável, ligado ao encerramento original (nunca o altera nem o apaga). */
export interface FollowUpReopening extends FollowUpReopeningRequest {
  readonly id: string;
}

export const OFFLINE_REOPEN_HINT = 'Conexão necessária para reabrir o acompanhamento.';
export const REOPEN_FAILED_HINT = 'Não foi possível reabrir o acompanhamento. Nada foi alterado; tente novamente.';

/** Encerramentos ainda em vigor: os que nenhuma reabertura reverteu. */
export function activeClosures(
  closures: readonly FollowUpClosure[],
  reopenings: readonly FollowUpReopening[],
): readonly FollowUpClosure[] {
  const reverted = new Set(reopenings.map(r => r.closureId));

  return closures.filter(c => !reverted.has(c.id));
}

/** Uma linha do histórico: encerramento (com a reabertura que o reverteu, se houver) ou a própria reabertura. */
export type FollowUpHistoryEntry =
  | { readonly kind: 'closure'; readonly closure: FollowUpClosure; readonly reopening: FollowUpReopening | null }
  | { readonly kind: 'reopening'; readonly reopening: FollowUpReopening; readonly closure: FollowUpClosure | null };

/** Histórico em ordem cronológica (data/hora do registro); todos os ciclos, nunca só o último. */
export function buildHistory(
  closures: readonly FollowUpClosure[],
  reopenings: readonly FollowUpReopening[],
): readonly FollowUpHistoryEntry[] {
  const entries: FollowUpHistoryEntry[] = [
    ...closures.map((closure): FollowUpHistoryEntry => ({
      closure,
      kind: 'closure',
      reopening: reopenings.find(r => r.closureId === closure.id) ?? null,
    })),
    ...reopenings.map((reopening): FollowUpHistoryEntry => ({
      closure: closures.find(c => c.id === reopening.closureId) ?? null,
      kind: 'reopening',
      reopening,
    })),
  ];
  const at = (entry: FollowUpHistoryEntry): string =>
    entry.kind === 'closure' ? entry.closure.at : entry.reopening.at;

  return entries.sort((a, b) => at(a).localeCompare(at(b)));
}
