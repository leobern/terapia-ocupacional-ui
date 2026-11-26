import { TestBed } from '@angular/core/testing';

import { OFFLINE_CODEC, OFFLINE_DB_NAME, OfflineCodec, OfflineStore, OutboxOperation } from './offline-store';

let counter = 0;

export const operation = (
  opId: string,
  seq: number,
  userId = 'u1',
  extra: Partial<OutboxOperation> = {},
): OutboxOperation => ({
  attempted: false,
  attempts: 0,
  day: '2026-11-26',
  nextAttemptAt: '2026-11-26T10:00:00.000Z',
  occurredAt: '2026-11-26T10:00:00.000Z',
  opId,
  patientId: '42',
  payload: { text: `texto ${opId}` },
  seq,
  status: 'pending',
  type: 'evolution-text',
  userId,
  ...extra,
});

function create(codec?: OfflineCodec): OfflineStore {
  TestBed.configureTestingModule({
    providers: [
      { provide: OFFLINE_DB_NAME, useValue: `teste-${Date.now()}-${counter++}` },
      ...(codec ? [{ provide: OFFLINE_CODEC, useValue: codec }] : []),
    ],
  });

  return TestBed.inject(OfflineStore);
}

describe('OfflineStore', () => {
  it('guarda e lê o cache por usuário, distinguindo null guardado de ausente', async () => {
    const store = create();

    expect(await store.getCache('u1', 'k')).toBeNull();
    await store.putCache('u1', 'k', null, '2026-11-26T10:00:00Z');
    await store.putCache('u2', 'k', { a: 1 }, '2026-11-26T11:00:00Z');

    expect(await store.getCache('u1', 'k')).toEqual({ savedAt: '2026-11-26T10:00:00Z', value: null });
    expect(await store.getCache('u2', 'k')).toEqual({ savedAt: '2026-11-26T11:00:00Z', value: { a: 1 } });
  });

  it('guarda undefined como null', async () => {
    const store = create();

    await store.putCache('u1', 'k', undefined, 'agora');

    expect((await store.getCache('u1', 'k'))?.value).toBeNull();
  });

  it('clearCache apaga só o cache do usuário e mantém a fila', async () => {
    const store = create();

    await store.putCache('u1', 'a', 1, 'x');
    await store.putCache('u1', 'b', 2, 'x');
    await store.putCache('u2', 'a', 3, 'x');
    await store.putOutbox(operation('o1', 1));
    await store.clearCache('u1');

    expect(await store.getCache('u1', 'a')).toBeNull();
    expect(await store.getCache('u1', 'b')).toBeNull();
    expect((await store.getCache('u2', 'a'))?.value).toBe(3);
    expect((await store.listOutbox('u1')).length).toBe(1);
  });

  it('lista a fila do usuário em ordem de enfileiramento, sem misturar usuários', async () => {
    const store = create();

    await store.putOutbox(operation('b', 2));
    await store.putOutbox(operation('a', 1));
    await store.putOutbox(operation('c', 3, 'u2'));

    expect((await store.listOutbox('u1')).map(o => o.opId)).toEqual(['a', 'b']);
    expect((await store.listOutbox('u2')).map(o => o.opId)).toEqual(['c']);
  });

  it('atualiza e remove uma operação, preservando o conflito', async () => {
    const store = create();
    const conflict = { currentVersion: 7, mine: 'meu', others: [{ at: 'x', author: 'Ana', text: 'dela' }] };

    await store.putOutbox(operation('a', 1));
    await store.putOutbox(operation('a', 1, 'u1', { conflict, status: 'conflict' }));

    const [saved] = await store.listOutbox('u1');

    expect(saved.status).toBe('conflict');
    expect(saved.conflict).toEqual(conflict);

    await store.deleteOutbox('a');

    expect(await store.listOutbox('u1')).toEqual([]);
  });

  it('passa valor em cache e payload pelo codec, deixando os campos de índice em claro', async () => {
    const codec: OfflineCodec = {
      decode: s => Promise.resolve(s.split('').toReversed().join('')),
      encode: s => Promise.resolve(s.split('').toReversed().join('')),
    };
    const store = create(codec);

    await store.putCache('u1', 'k', { segredo: 'abc' }, 'x');
    await store.putOutbox(operation('a', 1, 'u1', { conflict: { currentVersion: 1, mine: 'm', others: [] } }));

    expect((await store.getCache('u1', 'k'))?.value).toEqual({ segredo: 'abc' });
    const [saved] = await store.listOutbox('u1');

    expect(saved.payload).toEqual({ text: 'texto a' });
    expect(saved.conflict?.mine).toBe('m');
  });

  it('rejeita quando o IndexedDB não abre e tenta de novo na próxima chamada', async () => {
    const store = create();
    const spy = spyOn(indexedDB, 'open').and.callFake(() => {
      const request = {} as IDBOpenDBRequest;

      setTimeout(() => request.onerror?.(new Event('error')));

      return request;
    });

    await expectAsync(store.getCache('u1', 'k')).toBeRejectedWithError('Armazenamento local indisponível.');
    spy.and.callThrough();

    expect(await store.getCache('u1', 'k')).toBeNull();
  });

  it('rejeita a gravação quando a transação é cancelada', async () => {
    const store = create();

    await expectAsync(store.putCache('u1', 'k', { circular: 1n } as never, 'x')).toBeRejected();
    await store.putCache('u1', 'k', 1, 'x');
    spyOn(IDBObjectStore.prototype, 'put').and.callFake(function (this: IDBObjectStore) {
      this.transaction.abort();

      return undefined as never;
    });

    await expectAsync(store.putCache('u1', 'k2', 1, 'x')).toBeRejected();
  });

  it('os valores padrão: banco "conductia-offline" e codec identidade', async () => {
    TestBed.configureTestingModule({});
    const codec = TestBed.inject(OFFLINE_CODEC);

    expect(TestBed.inject(OFFLINE_DB_NAME)).toBe('conductia-offline');
    expect(await codec.encode('abc')).toBe('abc');
    expect(await codec.decode('abc')).toBe('abc');
    expect(TestBed.inject(OfflineStore)).toBeTruthy();
  });

  it('rejeita a leitura quando o pedido ao IndexedDB falha', async () => {
    const store = create();

    spyOn(IDBObjectStore.prototype, 'get').and.callFake(() => {
      const request = {} as IDBRequest;

      setTimeout(() => request.onerror?.(new Event('error')));

      return request;
    });

    await expectAsync(store.getCache('u1', 'k')).toBeRejectedWithError('Falha na leitura local.');
  });
});
