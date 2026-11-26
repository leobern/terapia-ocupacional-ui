import { OutboxOperation, OutboxOperationType, OutboxStatus } from './offline-store';

/** Texto de cada situação (a cor nunca é a única forma de transmitir o estado). */
export const SYNC_STATUS_LABEL: Readonly<Record<OutboxStatus, string>> = {
  conflict: 'Conflito de texto: escolha qual versão manter',
  failed: 'Não foi possível sincronizar',
  pending: 'Pendente de sincronização',
  sending: 'Enviando…',
};

export const SYNC_TYPE_LABEL: Readonly<Record<OutboxOperationType, string>> = {
  'evolution-text': 'Evolução médica',
  parameters: 'Parâmetros assistenciais',
  reevaluations: 'Avaliar de novo',
};

/** Prioridade do estado mais grave (conflito > falha > envio > pendente). */
const SEVERITY: readonly OutboxStatus[] = ['conflict', 'failed', 'sending', 'pending'];

/** Estado mais grave entre as operações (`null` quando não há nenhuma). */
export function worstStatus(operations: readonly OutboxOperation[]): OutboxStatus | null {
  return SEVERITY.find(status => operations.some(o => o.status === status)) ?? null;
}

/** Texto do estado de sincronização das operações (vazio quando está tudo no servidor). */
export function syncLabel(operations: readonly OutboxOperation[]): string {
  const worst = worstStatus(operations);

  return worst === null ? '' : SYNC_STATUS_LABEL[worst];
}

/** "N pendentes · N com falha · N em conflito", só o que existe. */
export function summaryText(counts: { pending: number; failed: number; conflict: number }): string {
  const parts: string[] = [];

  if (counts.pending > 0) {
    parts.push(`${counts.pending} ${counts.pending === 1 ? 'pendente' : 'pendentes'} de sincronização`);
  }
  if (counts.failed > 0) {
    parts.push(`${counts.failed} com falha`);
  }
  if (counts.conflict > 0) {
    parts.push(`${counts.conflict} em conflito`);
  }

  return parts.join(' · ');
}

/** O que a gravação contém, em texto curto (para o profissional reconhecer o que está pendente, falho ou em conflito). */
export function previewText(operation: OutboxOperation): string {
  const { payload } = operation;

  if (operation.type === 'evolution-text') {
    return String(payload['text'] ?? '');
  }
  if (operation.type === 'parameters') {
    const parameters = (payload['parameters'] ?? []) as readonly {
      parameterId: string;
      parameterLabel?: string;
      value: number;
      unit?: string;
    }[];

    return parameters
      .map(p => [`${p.parameterLabel ?? p.parameterId}: ${p.value}`, p.unit].filter(Boolean).join(' '))
      .join(' · ');
  }
  const reevaluations = (payload['reevaluations'] ?? []) as readonly { name: string }[];

  return reevaluations.map(r => r.name).join(' · ');
}
