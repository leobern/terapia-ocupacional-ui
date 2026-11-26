import { OutboxConflict, OutboxOperation } from './offline-store';

/** Resultado de um envio aceito pelo servidor. */
export interface SendOutcome {
  /** `version` do texto vigente depois da gravação (só `evolution-text`). */
  readonly version?: number;
  /** Presente quando o servidor gravou, mas marcou conflito de texto (base defasada). */
  readonly conflict?: Omit<OutboxConflict, 'mine'>;
}

/**
 * Porta de envio de uma operação da fila ao servidor. A implementação (por tipo de operação) manda a `opId` como
 * `Idempotency-Key`. Falhas sobem como `HttpErrorResponse`/`TimeoutError` para o sincronizador classificar.
 */
export abstract class OutboxTransport {
  abstract send(operation: OutboxOperation): Promise<SendOutcome>;
}
