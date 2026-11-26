import { HttpErrorResponse } from '@angular/common/http';
import { effect, inject, Injectable, InjectionToken, Injector, untracked } from '@angular/core';
import { TimeoutError } from 'rxjs';

import { LocalSessionStore } from '../../features/auth/local-session-store';
import { NOW } from '../../features/home/professional-profile';
import { failureReason, isNetworkFailure } from './network-failure';
import { NetworkStateService } from './network-state.service';
import { OfflineStore, OutboxOperation } from './offline-store';
import { OfflineUserService } from './offline-user.service';
import { NewOutboxOperation, OutboxService } from './outbox.service';
import { OutboxTransport } from './outbox-transport';

/** Tempos do sincronizador (ADR-003); os testes trocam por valores curtos. */
export interface OutboxSyncConfig {
  /** Temporizador com o app aberto. */
  readonly intervalMs: number;
  /** Primeira espera do backoff exponencial. */
  readonly baseDelayMs: number;
  /** Teto do backoff (1 min: o app aberto volta a tentar rápido quando a rede volta). */
  readonly maxDelayMs: number;
  /** Nome do travamento entre abas (`navigator.locks`); os testes usam um nome por teste. */
  readonly lockName?: string;
  /** Tempo máximo de um envio; a chave de idempotência torna o reenvio seguro. */
  readonly sendTimeoutMs?: number;
  /** Tentativas contra erro de servidor (5xx fora de rede) antes de marcar `failed`. */
  readonly maxServerErrors: number;
}

export const OUTBOX_SYNC_CONFIG = new InjectionToken<OutboxSyncConfig>('OUTBOX_SYNC_CONFIG', {
  factory: (): OutboxSyncConfig => ({
    baseDelayMs: 5000,
    intervalMs: 30_000,
    maxDelayMs: 60_000,
    maxServerErrors: 5,
  }),
});

/** Espera do backoff exponencial para a tentativa de número `attempts` (1 = primeira falha). */
export function backoffDelay(attempts: number, config: Pick<OutboxSyncConfig, 'baseDelayMs' | 'maxDelayMs'>): number {
  return Math.min(config.baseDelayMs * 2 ** Math.max(0, attempts - 1), config.maxDelayMs);
}

const DEFAULT_LOCK_NAME = 'conductia-outbox-drain';
const DEFAULT_SEND_TIMEOUT_MS = 30_000;

/** Chave, no cache local do usuário, da última versão de texto que o próprio aparelho gravou no dia. */
function versionKey(patientId: string, day: string): string {
  return `sync-version|${patientId}|${day}`;
}

/**
 * Sincronizador da fila de escrita (ADR-003). Envia em ordem por paciente, uma operação por vez, com
 * `Idempotency-Key` = `opId`. Gatilhos: abertura do app, evento `online`, `visibilitychange` e um temporizador com o app
 * aberto; só um envio ocorre por vez (e, com `navigator.locks`, só em uma aba). Rede caiu (sem resposta, 502/503/504,
 * tempo esgotado) ou 401 que o interceptor não conseguiu renovar: a operação continua `pending`, com backoff, e o
 * esvaziamento para. 400/403/404/422: `failed` com o motivo, sem retentar para sempre. Conflito de texto: grava a
 * operação como `conflict` e segura os textos seguintes do mesmo dia até o profissional escolher.
 */
@Injectable({ providedIn: 'root' })
export class OutboxSyncService {
  private readonly outbox = inject(OutboxService);
  private readonly transport = inject(OutboxTransport);
  private readonly network = inject(NetworkStateService);
  private readonly users = inject(OfflineUserService);
  private readonly clock = inject(NOW);
  private readonly config = inject(OUTBOX_SYNC_CONFIG);
  private readonly store = inject(OfflineStore);
  private readonly session = inject(LocalSessionStore);
  private readonly injector = inject(Injector);
  private running: Promise<void> | null = null;
  private again = false;
  private againForce = false;
  private stopTriggers: (() => void) | null = null;

  /** Inicia os gatilhos e esvazia a fila uma vez. Chamado na abertura do app. */
  async start(): Promise<void> {
    if (this.stopTriggers !== null) {
      return;
    }
    const onOnline = (): void => void this.drain(true);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        void this.drain(true);
      }
    };
    const timer = setInterval(() => void this.drain(false), this.config.intervalMs);

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    // Entrou (ou renovou) a sessão: a fila desse usuário passa a aparecer e a sair sem esperar o temporizador.
    const watcher = effect(
      () => {
        this.session.accessTokenSignal();
        untracked(() => void this.drain(true));
      },
      { injector: this.injector },
    );

    this.stopTriggers = (): void => {
      clearInterval(timer);
      watcher.destroy();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      this.stopTriggers = null;
    };
    await this.drain(true);
  }

  /** Desliga os gatilhos (testes e encerramento do app). */
  stop(): void {
    this.stopTriggers?.();
  }

  /** Enfileira e já tenta enviar; resolve depois de gravar localmente (não espera o envio). */
  async enqueue(input: NewOutboxOperation): Promise<OutboxOperation> {
    const operation = await this.outbox.enqueue(await this.withKnownVersion(input));

    void this.drain(true);

    return operation;
  }

  /**
   * Esvazia a fila. `force` ignora a espera do backoff (reconexão, retorno ao app, envio novo); o temporizador respeita
   * a espera. Chamadas simultâneas se juntam: no máximo uma varredura extra depois da atual.
   */
  drain(force: boolean): Promise<void> {
    if (this.running !== null) {
      this.again = true;
      this.againForce ||= force;

      return this.running;
    }
    const run = this.locked(() => this.sweep(force))
      .catch(() => undefined)
      .finally(() => {
        this.running = null;
        if (this.again) {
          const nextForce = this.againForce;

          this.again = false;
          this.againForce = false;
          void this.drain(nextForce);
        }
      });

    this.running = run;

    return run;
  }

  /**
   * Um texto novo parte da versão que ESTE aparelho já gravou no dia (guardada ao sincronizar), se for mais nova que a
   * da tela: senão o segundo texto do dia, escrito depois de o primeiro já ter sincronizado, seria marcado como conflito
   * com o próprio autor.
   */
  private async withKnownVersion(input: NewOutboxOperation): Promise<NewOutboxOperation> {
    const userId = this.users.userId();

    if (input.type !== 'evolution-text' || userId === null) {
      return input;
    }
    const known = await this.store.getCache(userId, versionKey(input.patientId, input.day)).catch(() => null);

    return typeof known?.value === 'number' && known.value > (input.baseVersion ?? -1)
      ? { ...input, baseVersion: known.value }
      : input;
  }

  /**
   * Lê a fila e devolve a pendente o que ficou em envio (app fechado no meio do envio): só este varredor, sob o
   * travamento, envia, então "em envio" no início da varredura é sempre sobra. O reenvio é seguro (idempotente).
   */
  private async recover(): Promise<readonly OutboxOperation[]> {
    const list = await this.outbox.reload();

    await Promise.all(
      list.filter(o => o.status === 'sending').map(o => this.outbox.update({ ...o, status: 'pending' })),
    );

    return this.outbox.operations();
  }

  private async locked(job: () => Promise<void>): Promise<void> {
    const locks = (navigator as { locks?: LockManager }).locks;

    if (locks === undefined) {
      return job();
    }
    // Outra aba já está enviando: esta não repete (a outra reporta o resultado pelo armazenamento compartilhado).
    await locks.request(this.config.lockName ?? DEFAULT_LOCK_NAME, { ifAvailable: true }, async lock => {
      if (lock !== null) {
        await job();
      }
    });
  }

  private async sweep(force: boolean): Promise<void> {
    const userId = this.users.userId();

    if (userId === null) {
      // Sem sessão a tela não mostra a fila de ninguém.
      this.outbox.operations.set([]);

      return;
    }
    const list = await this.recover();
    const patients = [...new Set(list.map(o => o.patientId))];

    for (const patientId of patients) {
      // Pacientes em sequência: uma única conexão, e a ordem de cada paciente é preservada.
      // eslint-disable-next-line no-await-in-loop
      const proceed = await this.sweepPatient(patientId, userId, force);

      if (!proceed) {
        return;
      }
    }
  }

  /** `false` = parar tudo (rede caiu, sessão sem token válido ou usuário trocou). */
  private async sweepPatient(patientId: string, userId: string, force: boolean): Promise<boolean> {
    const held = new Set<string>();
    const ids = this.outbox
      .operations()
      .filter(o => o.patientId === patientId)
      .map(o => o.opId);

    for (const opId of ids) {
      // Relê da fila a cada passo: o envio anterior pode ter avançado a `baseVersion` das seguintes.
      const operation = this.outbox.operations().find(o => o.opId === opId);

      if (operation === undefined || this.skip(operation, held)) {
        continue;
      }
      if (!force && operation.nextAttemptAt > this.clock().toISOString()) {
        // A espera de uma operação segura as seguintes do mesmo paciente (a ordem importa).
        return true;
      }
      // eslint-disable-next-line no-await-in-loop
      const result = await this.sendOne(operation, force);

      if (result === 'stop' || this.users.userId() !== userId) {
        // Rede/sessão caiu, ou a sessão trocou no meio do envio: nada mais sai com o token de outra pessoa.
        return false;
      }
      if (result === 'hold-patient') {
        return true;
      }
      if (result === 'conflict') {
        held.add(operation.day);
      }
    }

    return true;
  }

  /** Pula o que não está pendente e os textos do dia que ficam retidos atrás de um conflito. */
  private skip(operation: OutboxOperation, held: Set<string>): boolean {
    const isText = operation.type === 'evolution-text';

    if (isText && operation.status === 'conflict') {
      held.add(operation.day);
    }

    return operation.status !== 'pending' || (isText && held.has(operation.day));
  }

  private async sendOne(
    operation: OutboxOperation,
    force: boolean,
  ): Promise<'ok' | 'conflict' | 'failed' | 'stop' | 'hold-patient'> {
    const sending: OutboxOperation = { ...operation, attempted: true, status: 'sending' };

    await this.outbox.update(sending);
    try {
      const outcome = await this.withTimeout(this.transport.send(sending));

      this.network.markReachable();
      await this.rememberVersion(operation, outcome.version);
      if (outcome.conflict !== undefined) {
        const mine = typeof operation.payload['text'] === 'string' ? operation.payload['text'] : '';

        await this.outbox.update({
          ...sending,
          conflict: { ...outcome.conflict, mine },
          reason: 'O texto foi gravado sobre uma versão defasada.',
          status: 'conflict',
        });
        this.outbox.syncedTick.update(n => n + 1);

        return 'conflict';
      }
      await this.outbox.remove(operation.opId);
      await this.advanceBase(operation, outcome.version);
      this.outbox.syncedTick.update(n => n + 1);

      return 'ok';
    } catch (error) {
      return this.handleFailure(sending, error, force);
    }
  }

  /** Corre o envio contra um relógio: um POST parado não pode segurar a fila nem o travamento entre abas. */
  private withTimeout<T>(job: Promise<T>): Promise<T> {
    const limit = this.config.sendTimeoutMs ?? DEFAULT_SEND_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError()), limit);
    });

    return Promise.race([job, expired]).finally(() => clearTimeout(timer));
  }

  private async rememberVersion(operation: OutboxOperation, version: number | undefined): Promise<void> {
    if (operation.type === 'evolution-text' && version !== undefined) {
      await this.store
        .putCache(operation.userId, versionKey(operation.patientId, operation.day), version, this.clock().toISOString())
        .catch(() => undefined);
    }
  }

  /** Os próximos textos do dia, ainda nunca enviados, partem da versão que acabou de ser gravada (nada conflita com o próprio texto). */
  private async advanceBase(done: OutboxOperation, version: number | undefined): Promise<void> {
    if (done.type !== 'evolution-text' || version === undefined) {
      return;
    }
    const later = this.outbox
      .operations()
      .filter(
        o =>
          o.type === 'evolution-text' &&
          o.patientId === done.patientId &&
          o.day === done.day &&
          o.seq > done.seq &&
          !o.attempted &&
          o.baseVersion !== version,
      );

    await Promise.all(later.map(o => this.outbox.update({ ...o, baseVersion: version })));
  }

  private async handleFailure(
    sending: OutboxOperation,
    error: unknown,
    force: boolean,
  ): Promise<'failed' | 'stop' | 'hold-patient'> {
    // Envio forçado (gravação nova, volta ao app) não gasta o orçamento de erros de servidor: só a espera cresce.
    const attempts = sending.attempts + 1;
    const serverErrors = (sending.serverErrors ?? 0) + (force ? 0 : 1);
    const retry = (extra: Partial<OutboxOperation> = {}): Promise<void> =>
      this.outbox.update({
        ...sending,
        attempts,
        nextAttemptAt: new Date(this.clock().getTime() + backoffDelay(attempts, this.config)).toISOString(),
        status: 'pending',
        ...extra,
      });

    if (isNetworkFailure(error)) {
      this.network.markUnreachable();
      await retry();

      return 'stop';
    }
    const status = error instanceof HttpErrorResponse ? error.status : 0;

    if (status === 401) {
      // O interceptor já tentou renovar: sem token válido nada sai. Fica pendente, sem contar tentativa de servidor.
      await this.outbox.update({ ...sending, status: 'pending' });

      return 'stop';
    }
    if ((status >= 500 || status === 408 || status === 429) && serverErrors < this.config.maxServerErrors) {
      await retry({ serverErrors });

      return 'hold-patient';
    }
    this.network.markReachable();
    await this.outbox.update({ ...sending, attempts, reason: failureReason(error), serverErrors, status: 'failed' });

    return 'failed';
  }
}
