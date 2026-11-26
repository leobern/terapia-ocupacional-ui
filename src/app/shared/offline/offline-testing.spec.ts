import { CachedValue, OfflineStore, OutboxOperation } from './offline-store';

/** JWT de teste (sem assinatura) com as claims dadas, só para os specs. */
export function tokenFor(claims: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replaceAll('=', '');

  return `${encode({ alg: 'none' })}.${encode(claims)}.assinatura`;
}

/** Armazenamento em memória para os specs: mesmo contrato da porta, com falha injetável. */
export class InMemoryOfflineStore extends OfflineStore {
  readonly cache = new Map<string, CachedValue & { userId: string }>();
  readonly outbox = new Map<string, OutboxOperation>();
  failWrites = false;
  failReads = false;

  getCache(userId: string, key: string): Promise<CachedValue | null> {
    if (this.failReads) {
      return Promise.reject(new Error('leitura local falhou'));
    }

    return Promise.resolve(this.cache.get(`${userId}|${key}`) ?? null);
  }

  putCache(userId: string, key: string, value: unknown, savedAt: string): Promise<void> {
    if (this.failWrites) {
      return Promise.reject(new Error('gravação local falhou'));
    }
    this.cache.set(`${userId}|${key}`, { savedAt, userId, value });

    return Promise.resolve();
  }

  clearCache(userId: string): Promise<void> {
    for (const [key, entry] of this.cache) {
      if (entry.userId === userId) {
        this.cache.delete(key);
      }
    }

    return Promise.resolve();
  }

  listOutbox(userId: string): Promise<readonly OutboxOperation[]> {
    return Promise.resolve([...this.outbox.values()].filter(o => o.userId === userId).sort((a, b) => a.seq - b.seq));
  }

  putOutbox(operation: OutboxOperation): Promise<void> {
    if (this.failWrites) {
      return Promise.reject(new Error('gravação local falhou'));
    }
    this.outbox.set(operation.opId, operation);

    return Promise.resolve();
  }

  deleteOutbox(opId: string): Promise<void> {
    this.outbox.delete(opId);

    return Promise.resolve();
  }
}
