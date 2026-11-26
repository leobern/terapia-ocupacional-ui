import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from '../../features/auth/local-session-store';
import { NOW } from '../../features/home/professional-profile';
import { OfflineStore } from './offline-store';
import { InMemoryOfflineStore, tokenFor } from './offline-testing.spec';
import { newOpId, NewOutboxOperation, OutboxService } from './outbox.service';

const input = (extra: Partial<NewOutboxOperation> = {}): NewOutboxOperation => ({
  day: '2026-11-26',
  occurredAt: '2026-11-26T10:00:00.000Z',
  patientId: '42',
  payload: { text: 'oi' },
  type: 'evolution-text',
  ...extra,
});

describe('OutboxService', () => {
  let service: OutboxService;
  let store: InMemoryOfflineStore;
  const clock = new Date('2026-11-26T12:00:00.000Z');

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: OfflineStore, useFactory: (): InMemoryOfflineStore => new InMemoryOfflineStore() },
        { provide: NOW, useValue: (): Date => clock },
      ],
    });
    TestBed.inject(LocalSessionStore).open({ accessToken: tokenFor({ upn: 'ana@x.com' }), refreshToken: 'r' });
    store = TestBed.inject(OfflineStore) as InMemoryOfflineStore;
    service = TestBed.inject(OutboxService);
  });

  afterEach(() => localStorage.clear());

  it('enfileira com chave nova, ordem crescente e espelha nos sinais', async () => {
    const a = await service.enqueue(input());
    const b = await service.enqueue(input({ type: 'parameters' }));

    expect(a.opId).not.toBe(b.opId);
    expect(b.seq).toBeGreaterThan(a.seq);
    expect(a).toEqual(
      jasmine.objectContaining({ attempted: false, attempts: 0, status: 'pending', userId: 'ana@x.com' }),
    );
    expect(service.pendingCount()).toBe(2);
    expect(store.outbox.size).toBe(2);
    expect(service.totalCount()).toBe(2);
  });

  it('rejeita sem sessão e quando o armazenamento local falha (nada entra na fila)', async () => {
    store.failWrites = true;
    await expectAsync(service.enqueue(input())).toBeRejected();
    expect(service.totalCount()).toBe(0);

    TestBed.inject(LocalSessionStore).clear();
    store.failWrites = false;
    await expectAsync(service.enqueue(input())).toBeRejectedWithError('Sem sessão para guardar o registro.');
  });

  it('recarrega a fila do usuário e esvazia sem sessão', async () => {
    await service.enqueue(input());
    service.operations.set([]);

    expect((await service.reload()).length).toBe(1);
    expect(service.operations().length).toBe(1);
    TestBed.inject(LocalSessionStore).clear();

    expect(await service.reload()).toEqual([]);
  });

  it('atualiza, remove e filtra por paciente e dia', async () => {
    const a = await service.enqueue(input());

    await service.enqueue(input({ day: '2026-11-25', patientId: '7' }));
    await service.update({ ...a, status: 'sending' });

    expect(service.pendingCount()).toBe(2);
    expect(service.forPatient('42').length).toBe(1);
    expect(service.forPatient('42', '2026-11-25').length).toBe(0);
    expect(service.forPatient('7', '2026-11-25').length).toBe(1);
    await service.remove(a.opId);

    expect(service.forPatient('42')).toEqual([]);
    expect(store.outbox.has(a.opId)).toBeFalse();
  });

  it('conta falhas e conflitos à parte', async () => {
    const a = await service.enqueue(input());
    const b = await service.enqueue(input());

    await service.update({ ...a, status: 'failed' });
    await service.update({ ...b, status: 'conflict' });

    expect(service.failedCount()).toBe(1);
    expect(service.conflictCount()).toBe(1);
    expect(service.pendingCount()).toBe(0);
  });

  it('"tentar de novo" só vale para falha e preserva chave e corpo', async () => {
    const a = await service.enqueue(input());

    await service.retry(a.opId);
    expect(service.operations()[0].status).toBe('pending');
    await service.update({ ...a, attempted: true, attempts: 3, reason: 'x', status: 'failed' });
    await service.retry(a.opId);
    const [again] = service.operations();

    expect('reason' in again).toBeFalse();
    expect(again).toEqual(
      jasmine.objectContaining({ attempts: 0, opId: a.opId, payload: a.payload, status: 'pending' }),
    );
  });

  it('resolver conflito troca a operação por uma nova com chave nova, mesma posição e a versão vigente como base', async () => {
    const a = await service.enqueue(input({ baseVersion: 3 }));

    await service.update({
      ...a,
      attempted: true,
      conflict: { currentVersion: 9, mine: 'meu', others: [] },
      status: 'conflict',
    });
    await service.resolveConflict(a.opId, 'escolhido');
    const [next] = service.operations();

    expect(next.opId).not.toBe(a.opId);
    expect(next).toEqual(
      jasmine.objectContaining({
        attempted: false,
        baseVersion: 9,
        payload: { text: 'escolhido' },
        seq: a.seq,
        status: 'pending',
      }),
    );
    expect(store.outbox.has(a.opId)).toBeFalse();
    await service.resolveConflict(next.opId, 'de novo');

    expect(service.operations()[0].opId).toBe(next.opId);
  });

  it('newOpId gera UUID v4, também sem randomUUID', () => {
    expect(newOpId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
    try {
      expect(newOpId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
  });
});
