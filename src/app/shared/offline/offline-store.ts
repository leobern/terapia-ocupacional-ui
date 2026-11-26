import { inject, Injectable, InjectionToken } from '@angular/core';

/** Situação de uma operação da fila de escrita (ADR-003). */
export type OutboxStatus = 'pending' | 'sending' | 'failed' | 'conflict';

/** Tipos de escrita que funcionam sem rede (só registros clínicos de paciente já cadastrado). */
export type OutboxOperationType = 'evolution-text' | 'parameters' | 'reevaluations';

/** Versões de texto em disputa quando a gravação offline chegou sobre uma base defasada. */
export interface OutboxConflict {
  /** `version` vigente no servidor (base para a resolução). */
  readonly currentVersion: number;
  /** Texto que o profissional escreveu offline. */
  readonly mine: string;
  /** Versões gravadas por outros enquanto isso. */
  readonly others: readonly { readonly text: string; readonly author: string; readonly at: string }[];
}

/**
 * Uma escrita pendente. `opId` é o UUID gerado no cliente e vai como `Idempotency-Key` a cada reenvio. O `day`
 * (AAAA-MM-DD) é gravado ao enfileirar: nunca é recalculado no envio. `occurredAt` é a hora do cliente quando o
 * profissional registrou. O corpo (`payload`) nunca muda depois da primeira tentativa: a mesma chave com outro corpo
 * seria 422.
 */
export interface OutboxOperation {
  readonly opId: string;
  readonly userId: string;
  /** Ordem de enfileiramento (cresce); o envio respeita esta ordem por paciente. */
  readonly seq: number;
  readonly patientId: string;
  readonly day: string;
  readonly type: OutboxOperationType;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  /** `version` do dia que a tela tinha visto (só `evolution-text`); só avança enquanto nunca foi tentada. */
  readonly baseVersion?: number;
  readonly status: OutboxStatus;
  readonly attempts: number;
  /** Erros de servidor (5xx, 408, 429) em tentativas NÃO forçadas: só estes contam para o limite de `failed`. */
  readonly serverErrors?: number;
  /** ISO: antes disto o temporizador não reenvia. */
  readonly nextAttemptAt: string;
  /** Já houve ao menos uma tentativa de envio (o corpo e a base não mudam mais). */
  readonly attempted: boolean;
  /** Motivo legível da falha (`failed`). */
  readonly reason?: string;
  /** Preenchido em `conflict`. */
  readonly conflict?: OutboxConflict;
}

/** Valor em cache de leitura com a hora em que foi guardado. */
export interface CachedValue {
  readonly savedAt: string;
  readonly value: unknown;
}

/**
 * Costura para criptografia local (EP-007, decisão pendente): cada valor em cache e cada `payload` da fila passam por
 * `encode` ao gravar e `decode` ao ler. Hoje é identidade (sem criptografia); trocar por AES-GCM é um provider.
 */
export interface OfflineCodec {
  encode(plain: string): Promise<string>;
  decode(stored: string): Promise<string>;
}

export const OFFLINE_CODEC = new InjectionToken<OfflineCodec>('OFFLINE_CODEC', {
  factory: (): OfflineCodec => ({
    decode: (stored: string): Promise<string> => Promise.resolve(stored),
    encode: (plain: string): Promise<string> => Promise.resolve(plain),
  }),
});

/** Nome do banco IndexedDB; os testes trocam por um nome único por teste. */
export const OFFLINE_DB_NAME = new InjectionToken<string>('OFFLINE_DB_NAME', {
  factory: (): string => 'conductia-offline',
});

/**
 * Porta do armazenamento local do modo offline (ADR-003): cache de leitura por chave e fila de escrita (outbox), ambos
 * separados por usuário. A implementação real usa IndexedDB; os testes usam o mesmo código com um banco por teste.
 * `getCache` devolve `null` só quando a chave NÃO está em cache (um valor `null` guardado volta como `{ value: null }`).
 */
// A fábrica só roda em tempo de execução, depois de o módulo inteiro carregar: a classe abaixo já existe.
@Injectable({
  providedIn: 'root',
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  useFactory: (): OfflineStore => new IndexedDbOfflineStore(inject(OFFLINE_DB_NAME), inject(OFFLINE_CODEC)),
})
export abstract class OfflineStore {
  abstract getCache(userId: string, key: string): Promise<CachedValue | null>;
  abstract putCache(userId: string, key: string, value: unknown, savedAt: string): Promise<void>;
  /** Apaga só o cache de leitura do usuário (a fila de escrita fica). */
  abstract clearCache(userId: string): Promise<void>;
  /** Fila do usuário em ordem de enfileiramento. */
  abstract listOutbox(userId: string): Promise<readonly OutboxOperation[]>;
  abstract putOutbox(operation: OutboxOperation): Promise<void>;
  abstract deleteOutbox(opId: string): Promise<void>;
}

const CACHE = 'cache';
const OUTBOX = 'outbox';
const BY_USER = 'byUser';

interface CacheRecord {
  readonly id: string;
  readonly userId: string;
  readonly savedAt: string;
  readonly data: string;
}

type OutboxRecord = Omit<OutboxOperation, 'conflict' | 'payload'> & {
  readonly payload: string;
  readonly conflict?: string;
};

/** Resolve quando a transação TERMINA (`oncomplete`), não quando o pedido individual responde. */
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = (): void => resolve();
    tx.onabort = (): void => reject(tx.error ?? new Error('Transação local cancelada.'));
  });
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error ?? new Error('Falha na leitura local.'));
  });
}

/**
 * Armazenamento local sobre o IndexedDB nativo, sem biblioteca (ADR-003): dois repositórios, `cache` (chave
 * `usuário|chave`) e `outbox` (chave `opId`, índice por usuário). Valor em cache e `payload` passam pelo `OfflineCodec`
 * (hoje identidade); campos de índice ficam em claro. A conexão é aberta uma vez e reaproveitada.
 */
export class IndexedDbOfflineStore extends OfflineStore {
  private connection: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly name: string,
    private readonly codec: OfflineCodec,
  ) {
    super();
  }

  async getCache(userId: string, key: string): Promise<CachedValue | null> {
    const db = await this.open();
    const record = await result<CacheRecord | undefined>(
      db.transaction(CACHE, 'readonly').objectStore(CACHE).get(`${userId}|${key}`),
    );

    if (record === undefined) {
      return null;
    }

    return { savedAt: record.savedAt, value: JSON.parse(await this.codec.decode(record.data)) as unknown };
  }

  async putCache(userId: string, key: string, value: unknown, savedAt: string): Promise<void> {
    const data = await this.codec.encode(JSON.stringify(value ?? null));
    const db = await this.open();
    const tx = db.transaction(CACHE, 'readwrite');

    tx.objectStore(CACHE).put({ data, id: `${userId}|${key}`, savedAt, userId } satisfies CacheRecord);
    await done(tx);
  }

  async clearCache(userId: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(CACHE, 'readwrite');
    const store = tx.objectStore(CACHE);

    store.index(BY_USER).openKeyCursor(IDBKeyRange.only(userId)).onsuccess = (event): void => {
      const cursor = (event.target as IDBRequest<IDBCursor | null>).result;

      if (cursor !== null) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    await done(tx);
  }

  async listOutbox(userId: string): Promise<readonly OutboxOperation[]> {
    const db = await this.open();
    const records = await result<OutboxRecord[]>(
      db.transaction(OUTBOX, 'readonly').objectStore(OUTBOX).index(BY_USER).getAll(IDBKeyRange.only(userId)),
    );
    const operations = await Promise.all(records.map(r => this.fromRecord(r)));

    return operations.sort((a, b) => a.seq - b.seq);
  }

  async putOutbox(operation: OutboxOperation): Promise<void> {
    const record = await this.toRecord(operation);
    const db = await this.open();
    const tx = db.transaction(OUTBOX, 'readwrite');

    tx.objectStore(OUTBOX).put(record);
    await done(tx);
  }

  async deleteOutbox(opId: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(OUTBOX, 'readwrite');

    tx.objectStore(OUTBOX).delete(opId);
    await done(tx);
  }

  private async toRecord(operation: OutboxOperation): Promise<OutboxRecord> {
    const { conflict, payload, ...rest } = operation;

    return {
      ...rest,
      payload: await this.codec.encode(JSON.stringify(payload)),
      ...(conflict === undefined ? {} : { conflict: await this.codec.encode(JSON.stringify(conflict)) }),
    };
  }

  private async fromRecord(record: OutboxRecord): Promise<OutboxOperation> {
    const { conflict, payload, ...rest } = record;

    return {
      ...rest,
      payload: JSON.parse(await this.codec.decode(payload)) as OutboxOperation['payload'],
      ...(conflict === undefined ? {} : { conflict: JSON.parse(await this.codec.decode(conflict)) as OutboxConflict }),
    };
  }

  private open(): Promise<IDBDatabase> {
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);

      request.onupgradeneeded = (): void => {
        const db = request.result;

        db.createObjectStore(CACHE, { keyPath: 'id' }).createIndex(BY_USER, 'userId');
        db.createObjectStore(OUTBOX, { keyPath: 'opId' }).createIndex(BY_USER, 'userId');
      };
      request.onsuccess = (): void => resolve(request.result);
      request.onerror = (): void => {
        this.connection = null;
        reject(request.error ?? new Error('Armazenamento local indisponível.'));
      };
    });

    return this.connection;
  }
}
