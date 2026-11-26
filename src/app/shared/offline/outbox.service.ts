import { computed, inject, Injectable, signal } from '@angular/core';

import { NOW } from '../../features/home/professional-profile';
import { OfflineStore, OutboxOperation, OutboxOperationType } from './offline-store';
import { OfflineUserService } from './offline-user.service';

/** Dados de uma escrita nova; o resto (id, ordem, situação) a fila preenche. */
export interface NewOutboxOperation {
  readonly patientId: string;
  readonly day: string;
  readonly type: OutboxOperationType;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly baseVersion?: number;
}

/** UUID v4 gerado no cliente; `randomUUID` só existe em contexto seguro, então há um caminho de reserva. */
export function newOpId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Fila de escrita do usuário (ADR-003): grava no `OfflineStore` e espelha em sinais para a interface (contador,
 * estado por card). Escrever só termina depois que a transação local fecha: se a gravação local falhar, rejeita e a
 * tela mantém o que o usuário digitou. Só o usuário da sessão atual enxerga a própria fila.
 */
@Injectable({ providedIn: 'root' })
export class OutboxService {
  readonly operations = signal<readonly OutboxOperation[]>([]);
  /** Aguardando envio (inclui o que está sendo enviado). */
  readonly pendingCount = computed(
    () => this.operations().filter(o => o.status === 'pending' || o.status === 'sending').length,
  );
  readonly failedCount = computed(() => this.operations().filter(o => o.status === 'failed').length);
  readonly conflictCount = computed(() => this.operations().filter(o => o.status === 'conflict').length);
  /** Tudo o que pede atenção ou espera envio. */
  readonly totalCount = computed(() => this.operations().length);
  /** Cresce a cada operação concluída no servidor: quem lista dados do servidor lê de novo. */
  readonly syncedTick = signal(0);

  private readonly store = inject(OfflineStore);
  private readonly users = inject(OfflineUserService);
  private readonly clock = inject(NOW);
  private sequence = 0;

  /** Enfileira uma escrita; rejeita sem sessão ou se o armazenamento local falhar. */
  async enqueue(input: NewOutboxOperation): Promise<OutboxOperation> {
    const userId = this.users.userId();

    if (userId === null) {
      throw new Error('Sem sessão para guardar o registro.');
    }
    const now = this.clock();
    const operation: OutboxOperation = {
      ...input,
      attempted: false,
      attempts: 0,
      nextAttemptAt: now.toISOString(),
      opId: newOpId(),
      seq: now.getTime() * 1000 + (this.sequence++ % 1000),
      status: 'pending',
      userId,
    };

    await this.store.putOutbox(operation);
    this.operations.update(list => [...list, operation]);

    return operation;
  }

  /** Relê a fila do usuário atual do armazenamento (abertura do app, troca de usuário). */
  async reload(): Promise<readonly OutboxOperation[]> {
    const userId = this.users.userId();
    const list = userId === null ? [] : await this.store.listOutbox(userId);

    this.operations.set(list);

    return list;
  }

  /** Grava a nova situação de uma operação já na fila. */
  async update(operation: OutboxOperation): Promise<void> {
    await this.store.putOutbox(operation);
    this.operations.update(list => list.map(o => (o.opId === operation.opId ? operation : o)));
  }

  /** Tira da fila (enviada ao servidor ou descartada pelo usuário). */
  async remove(opId: string): Promise<void> {
    await this.store.deleteOutbox(opId);
    this.operations.update(list => list.filter(o => o.opId !== opId));
  }

  /** Operações do paciente (e do dia, quando informado), em ordem de enfileiramento. */
  forPatient(patientId: string, day?: string): readonly OutboxOperation[] {
    return this.operations().filter(o => o.patientId === patientId && (day === undefined || o.day === day));
  }

  /** Reenvio manual de uma falha: volta a `pending` com a mesma chave e o mesmo corpo. */
  async retry(opId: string): Promise<void> {
    const operation = this.operations().find(o => o.opId === opId);

    if (operation?.status === 'failed') {
      // eslint-disable-next-line sonarjs/no-unused-vars
      const { reason: _reason, ...rest } = operation;

      await this.update({ ...rest, attempts: 0, nextAttemptAt: this.clock().toISOString(), status: 'pending' });
    }
  }

  /**
   * Resolve um conflito de texto: grava o texto escolhido como uma versão nova, com a `baseVersion` vigente. É uma
   * operação NOVA (chave nova: o corpo mudou) que herda a posição da antiga na fila.
   */
  async resolveConflict(opId: string, text: string): Promise<void> {
    const old = this.operations().find(o => o.opId === opId);

    if (old?.status !== 'conflict' || old.conflict === undefined) {
      return;
    }
    const next: OutboxOperation = {
      attempted: false,
      attempts: 0,
      baseVersion: old.conflict.currentVersion,
      day: old.day,
      nextAttemptAt: this.clock().toISOString(),
      occurredAt: this.clock().toISOString(),
      opId: newOpId(),
      patientId: old.patientId,
      payload: { ...old.payload, text },
      seq: old.seq,
      status: 'pending',
      type: old.type,
      userId: old.userId,
    };

    await this.store.putOutbox(next);
    await this.store.deleteOutbox(opId);
    this.operations.update(list => list.map(o => (o.opId === opId ? next : o)).sort((a, b) => a.seq - b.seq));
  }
}
