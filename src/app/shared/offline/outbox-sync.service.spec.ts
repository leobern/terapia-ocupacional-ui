import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from '../../features/auth/local-session-store';
import { NOW } from '../../features/home/professional-profile';
import { NetworkStateService } from './network-state.service';
import { OfflineStore, OutboxOperation } from './offline-store';
import { InMemoryOfflineStore, tokenFor } from './offline-testing.spec';
import { NewOutboxOperation, OutboxService } from './outbox.service';
import { backoffDelay, OUTBOX_SYNC_CONFIG, OutboxSyncService } from './outbox-sync.service';
import { OutboxTransport, SendOutcome } from './outbox-transport';

type Step = SendOutcome | HttpErrorResponse | Error;

/** Transporte roteirizado: cada envio consome o próximo passo da lista (padrão: sucesso). */
class ScriptedTransport extends OutboxTransport {
  readonly sent: OutboxOperation[] = [];
  readonly script: Step[] = [];
  onSend: (() => void) | null = null;
  gate: Promise<void> | null = null;

  async send(operation: OutboxOperation): Promise<SendOutcome> {
    this.sent.push(operation);
    this.onSend?.();
    if (this.gate !== null) {
      await this.gate;
    }
    const step = this.script.shift() ?? {};

    if (step instanceof Error || step instanceof HttpErrorResponse) {
      throw step;
    }

    return step;
  }
}

const http = (status: number, message?: string): HttpErrorResponse =>
  new HttpErrorResponse({ error: message === undefined ? null : { message }, status });

const input = (extra: Partial<NewOutboxOperation> = {}): NewOutboxOperation => ({
  day: '2026-11-26',
  occurredAt: '2026-11-26T10:00:00.000Z',
  patientId: '42',
  payload: { text: 'oi' },
  type: 'evolution-text',
  ...extra,
});

describe('backoffDelay', () => {
  it('dobra a cada tentativa e respeita o teto', () => {
    const config = { baseDelayMs: 5000, maxDelayMs: 40_000 };

    expect([1, 2, 3, 4, 5, 9].map(n => backoffDelay(n, config))).toEqual([
      5000, 10_000, 20_000, 40_000, 40_000, 40_000,
    ]);
    expect(backoffDelay(0, config)).toBe(5000);
  });

  it('a configuração padrão: 30 s de temporizador, 5 s de espera inicial, teto de 1 min', () => {
    TestBed.resetTestingModule();

    expect(TestBed.inject(OUTBOX_SYNC_CONFIG)).toEqual({
      baseDelayMs: 5000,
      intervalMs: 30_000,
      maxDelayMs: 60_000,
      maxServerErrors: 5,
    });
  });
});

describe('OutboxSyncService', () => {
  let sync: OutboxSyncService;
  let outbox: OutboxService;
  let transport: ScriptedTransport;
  let network: NetworkStateService;
  let store: InMemoryOfflineStore;
  let now: Date;
  let lockSequence = 0;
  const config = (): object => ({
    baseDelayMs: 1000,
    intervalMs: 20,
    lockName: `teste-sync-${lockSequence++}`,
    maxDelayMs: 4000,
    sendTimeoutMs: 40,
    maxServerErrors: 3,
  });

  const ops = (): readonly OutboxOperation[] => outbox.operations();
  const find = (patientId: string, type: string): OutboxOperation[] =>
    ops().filter(o => o.patientId === patientId && o.type === type);

  beforeEach(() => {
    localStorage.clear();
    now = new Date('2026-11-26T12:00:00.000Z');
    TestBed.configureTestingModule({
      providers: [
        { provide: OfflineStore, useFactory: (): InMemoryOfflineStore => new InMemoryOfflineStore() },
        { provide: OutboxTransport, useClass: ScriptedTransport },
        { provide: NOW, useValue: (): Date => now },
        { provide: OUTBOX_SYNC_CONFIG, useValue: config() },
      ],
    });
    TestBed.inject(LocalSessionStore).open({ accessToken: tokenFor({ upn: 'ana@x.com' }), refreshToken: 'r' });
    sync = TestBed.inject(OutboxSyncService);
    outbox = TestBed.inject(OutboxService);
    transport = TestBed.inject(OutboxTransport) as ScriptedTransport;
    network = TestBed.inject(NetworkStateService);
    store = TestBed.inject(OfflineStore) as InMemoryOfflineStore;
  });

  afterEach(() => {
    sync.stop();
    localStorage.clear();
  });

  it('envia em ordem por paciente, com a opId como chave, e tira da fila o que o servidor aceitou', async () => {
    const a = await outbox.enqueue(input());
    const b = await outbox.enqueue(input({ patientId: '7', type: 'parameters' }));
    const c = await outbox.enqueue(input({ type: 'reevaluations' }));
    const tick = outbox.syncedTick();

    await sync.drain(true);

    expect(transport.sent.map(o => o.opId)).toEqual([a.opId, c.opId, b.opId]);
    expect(transport.sent.every(o => o.status === 'sending' && o.attempted)).toBeTrue();
    expect(ops()).toEqual([]);
    expect(store.outbox.size).toBe(0);
    expect(outbox.syncedTick()).toBe(tick + 3);
    expect(network.reachable()).toBeTrue();
  });

  it('enfileirar já tenta enviar sozinho', async () => {
    const operation = await sync.enqueue(input());

    await sync.drain(true);

    expect(transport.sent.map(o => o.opId)).toEqual([operation.opId]);
    expect(ops()).toEqual([]);
  });

  it('textos do mesmo dia em sequência partem da versão gravada pelo anterior (não conflitam com o próprio texto)', async () => {
    await outbox.enqueue(input({ baseVersion: 5 }));
    await outbox.enqueue(input({ baseVersion: 5, payload: { text: 'segundo' } }));
    transport.script.push({ version: 6 }, { version: 7 });

    await sync.drain(true);

    expect(transport.sent.map(o => o.baseVersion)).toEqual([5, 6]);
  });

  it('rede caiu: a operação continua pendente com espera, nada mais sai e a rede fica "sem conexão"', async () => {
    const a = await outbox.enqueue(input());

    await outbox.enqueue(input({ patientId: '7' }));
    transport.script.push(http(0));

    await sync.drain(true);

    expect(transport.sent.length).toBe(1);
    const [first, second] = ops();

    expect(first).toEqual(
      jasmine.objectContaining({
        attempted: true,
        attempts: 1,
        nextAttemptAt: '2026-11-26T12:00:01.000Z',
        opId: a.opId,
        status: 'pending',
      }),
    );
    expect(second.attempts).toBe(0);
    expect(network.reachable()).toBeFalse();
  });

  it('backoff exponencial com teto; o temporizador respeita a espera e a reconexão a ignora; a chave não muda', async () => {
    const a = await outbox.enqueue(input());

    transport.script.push(http(504), http(504), http(504), http(504));
    await sync.drain(true);
    expect(ops()[0].nextAttemptAt).toBe('2026-11-26T12:00:01.000Z');

    await sync.drain(false);
    expect(transport.sent.length).toBe(1);

    now = new Date('2026-11-26T12:00:01.000Z');
    await sync.drain(false);
    expect(ops()[0].nextAttemptAt).toBe('2026-11-26T12:00:03.000Z');
    expect(ops()[0].attempts).toBe(2);

    await sync.drain(true);
    expect(ops()[0].nextAttemptAt).toBe('2026-11-26T12:00:05.000Z');
    expect(transport.sent.length).toBe(3);

    await sync.drain(true);
    expect(ops()[0].nextAttemptAt).toBe('2026-11-26T12:00:05.000Z');
    expect(transport.sent.every(o => o.opId === a.opId)).toBeTrue();

    await sync.drain(true);
    expect(ops()).toEqual([]);
  });

  it('a espera de uma operação segura as seguintes do mesmo paciente, mas não de outros', async () => {
    await outbox.enqueue(input());
    await outbox.enqueue(input({ type: 'parameters' }));
    await outbox.enqueue(input({ patientId: '7' }));

    transport.script.push(http(0));
    await sync.drain(true);
    now = new Date('2026-11-26T12:00:00.500Z');
    transport.sent.length = 0;
    await sync.drain(false);

    expect(transport.sent.map(o => o.patientId)).toEqual(['7']);
  });

  it('401 que o interceptor não renovou: continua pendente, sem contar tentativa, e para tudo', async () => {
    await outbox.enqueue(input());
    await outbox.enqueue(input({ patientId: '7' }));
    transport.script.push(http(401));

    await sync.drain(true);

    expect(transport.sent.length).toBe(1);
    expect(ops()[0]).toEqual(jasmine.objectContaining({ attempts: 0, status: 'pending' }));
  });

  it('4xx de validação vira falha com o motivo do servidor e não trava as demais', async () => {
    await outbox.enqueue(input());
    await outbox.enqueue(input({ type: 'parameters' }));
    transport.script.push(http(400, 'Texto em branco'));

    await sync.drain(true);

    const [failed] = ops();

    expect(failed).toEqual(jasmine.objectContaining({ attempts: 1, reason: 'Texto em branco', status: 'failed' }));
    expect(ops().length).toBe(1);
    expect(transport.sent.length).toBe(2);

    await sync.drain(true);
    expect(transport.sent.length).toBe(2);
    expect(outbox.failedCount()).toBe(1);
  });

  it('erro não HTTP também vira falha com texto padrão', async () => {
    await outbox.enqueue(input());
    transport.script.push(new Error('bug'));

    await sync.drain(true);

    expect(ops()[0]).toEqual(
      jasmine.objectContaining({ reason: 'Não foi possível enviar o registro.', status: 'failed' }),
    );
  });

  it('erro de servidor (5xx, 408, 429) tenta de novo com espera e só vira falha depois de 3 tentativas do temporizador; outro paciente segue', async () => {
    await outbox.enqueue(input());
    await outbox.enqueue(input({ type: 'parameters' }));
    await outbox.enqueue(input({ patientId: '7' }));
    transport.script.push(http(500), {}, http(408), http(429), http(500));

    await sync.drain(true);
    // A espera segura o paciente 42 (a ordem importa); o paciente 7 segue.
    expect(ops().map(o => o.status)).toEqual(['pending', 'pending']);
    expect(ops()[0].attempts).toBe(1);
    expect(find('7', 'evolution-text').length).toBe(0);
    expect(transport.sent.map(o => o.patientId)).toEqual(['42', '7']);

    for (const seconds of [1, 3, 7]) {
      now = new Date(Date.parse('2026-11-26T12:00:00.000Z') + seconds * 1000);
      // eslint-disable-next-line no-await-in-loop
      await sync.drain(false);
    }
    expect(ops()[0]).toEqual(jasmine.objectContaining({ attempts: 4, serverErrors: 3, status: 'failed' }));
    // Falha não segura as operações seguintes do paciente (só conflito segura textos do mesmo dia).
    expect(ops().length).toBe(1);
    expect(network.reachable()).toBeTrue();
  });

  it('envios forçados (cada gravação nova) não gastam o limite de erros de servidor', async () => {
    await outbox.enqueue(input());
    transport.script.push(http(500), http(500), http(500), http(500), http(500), http(500));

    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await sync.drain(true);
    }

    expect(ops()[0]).toEqual(jasmine.objectContaining({ attempts: 6, status: 'pending' }));
    expect(ops()[0].serverErrors).toBe(0);
  });

  it('um envio parado vira falha de rede depois do tempo limite e não trava a fila', async () => {
    await outbox.enqueue(input());
    transport.gate = new Promise<void>(() => undefined);

    await sync.drain(true);

    expect(ops()[0]).toEqual(jasmine.objectContaining({ attempts: 1, status: 'pending' }));
    expect(network.reachable()).toBeFalse();
    transport.gate = null;
    await sync.drain(true);

    expect(ops()).toEqual([]);
  });

  it('o texto seguinte do dia parte da versão que este aparelho já gravou, mesmo com a tela ainda na base antiga', async () => {
    transport.script.push({ version: 6 });
    await sync.enqueue(input({ baseVersion: 5 }));
    await sync.drain(true);
    expect(ops()).toEqual([]);

    await sync.enqueue(input({ baseVersion: 5, payload: { text: 'segundo' } }));
    await sync.drain(true);
    // Uma tela que já viu algo mais novo mantém a sua base; outro dia ou outro paciente não herdam.
    await sync.enqueue(input({ baseVersion: 9, payload: { text: 'terceiro' } }));
    await sync.enqueue(input({ baseVersion: 1, day: '2026-11-25', payload: { text: 'outro dia' } }));
    await sync.drain(true);

    expect(transport.sent.map(o => o.baseVersion)).toEqual([5, 6, 9, 1]);
  });

  it('falha ao guardar a versão conhecida não derruba o envio que deu certo', async () => {
    await outbox.enqueue(input());
    spyOn(store, 'putCache').and.callFake(() => Promise.reject(new Error('IDB')));
    transport.script.push({ version: 3 });

    await sync.drain(true);

    expect(ops()).toEqual([]);
  });

  it('versão conhecida ilegível não impede enfileirar', async () => {
    store.failReads = true;

    const operation = await sync.enqueue(input({ baseVersion: 2 }));

    expect(operation.baseVersion).toBe(2);
    await sync.drain(true);
  });

  it('ao entrar uma sessão nova a fila desse usuário é enviada sem esperar o temporizador', async () => {
    await outbox.enqueue(input());
    TestBed.inject(LocalSessionStore).clear();
    await sync.start();
    expect(ops()).toEqual([]);
    expect(transport.sent.length).toBe(0);

    TestBed.inject(LocalSessionStore).open({ accessToken: tokenFor({ upn: 'ana@x.com' }), refreshToken: 'r' });
    TestBed.tick();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(transport.sent.length).toBe(1);
  });

  it('conflito de texto: grava como conflito com as duas versões e segura os textos seguintes do dia', async () => {
    await outbox.enqueue(input({ baseVersion: 1, payload: { text: 'meu' } }));
    await outbox.enqueue(input({ baseVersion: 1, payload: { text: 'depois' } }));
    await outbox.enqueue(input({ type: 'parameters' }));
    await outbox.enqueue(input({ day: '2026-11-25', payload: { text: 'outro dia' } }));
    transport.script.push({
      conflict: { currentVersion: 4, others: [{ at: '2026-11-26T09:00:00Z', author: 'Bia', text: 'dela' }] },
      version: 4,
    });

    await sync.drain(true);

    const [conflict, held] = ops();

    expect(conflict).toEqual(
      jasmine.objectContaining({
        conflict: {
          currentVersion: 4,
          mine: 'meu',
          others: [{ at: '2026-11-26T09:00:00Z', author: 'Bia', text: 'dela' }],
        },
        status: 'conflict',
      }),
    );
    expect(held.status).toBe('pending');
    expect(transport.sent.map(o => o.type + o.day)).toEqual([
      'evolution-text2026-11-26',
      'parameters2026-11-26',
      'evolution-text2026-11-25',
    ]);
    expect(outbox.conflictCount()).toBe(1);
  });

  it('depois de escolher a versão, o texto escolhido sai com a base vigente e os seguintes partem dele', async () => {
    const first = await outbox.enqueue(input({ baseVersion: 1, payload: { text: 'meu' } }));

    await outbox.enqueue(input({ baseVersion: 1, payload: { text: 'depois' } }));
    transport.script.push({ conflict: { currentVersion: 4, others: [] }, version: 4 });
    await sync.drain(true);

    await outbox.resolveConflict(first.opId, 'escolhido');
    transport.sent.length = 0;
    transport.script.push({ version: 5 }, { version: 6 });
    await sync.drain(true);

    expect(transport.sent.map(o => [o.payload['text'], o.baseVersion])).toEqual([
      ['escolhido', 4],
      ['depois', 5],
    ]);
    expect(ops()).toEqual([]);
  });

  it('operações que ficaram "enviando" (app fechado no meio) voltam a pendente e são reenviadas com a mesma chave', async () => {
    const a = await outbox.enqueue(input());

    await outbox.update({ ...a, attempted: true, status: 'sending' });

    await sync.drain(true);

    expect(transport.sent.map(o => o.opId)).toEqual([a.opId]);
    expect(ops()).toEqual([]);
  });

  it('para quando o usuário da sessão muda no meio do envio', async () => {
    await outbox.enqueue(input());
    await outbox.enqueue(input({ type: 'parameters' }));
    transport.onSend = (): void => {
      TestBed.inject(LocalSessionStore).open({ accessToken: tokenFor({ upn: 'outra@x.com' }), refreshToken: 'r' });
    };

    await sync.drain(true);

    expect(transport.sent.length).toBe(1);
  });

  it('sem sessão não envia e esvazia o que a tela mostra', async () => {
    await outbox.enqueue(input());
    TestBed.inject(LocalSessionStore).clear();

    await sync.drain(true);

    expect(transport.sent.length).toBe(0);
    expect(ops()).toEqual([]);
  });

  it('esvaziamentos simultâneos se juntam: cada operação sai uma vez e há uma varredura extra no máximo', async () => {
    await outbox.enqueue(input());
    let release!: () => void;

    transport.gate = new Promise<void>(resolve => (release = resolve));
    const first = sync.drain(true);
    const second = sync.drain(false);
    const third = sync.drain(true);

    release();
    await Promise.all([first, second, third]);
    await sync.drain(true);

    expect(transport.sent.length).toBe(1);
  });

  it('erro ao ler o armazenamento local não vira exceção solta: tenta de novo no próximo gatilho', async () => {
    spyOn(store, 'listOutbox').and.callFake(() => Promise.reject(new Error('IDB')));

    await expectAsync(sync.drain(true)).toBeResolved();
  });

  it('outra aba já está enviando: esta não repete', async () => {
    await outbox.enqueue(input());
    spyOn(navigator.locks, 'request').and.callFake(((...args: unknown[]) =>
      (args[2] as (lock: null) => Promise<void>)(null)) as never);

    await sync.drain(true);

    expect(transport.sent.length).toBe(0);
  });

  it('sem navigator.locks envia direto', async () => {
    await outbox.enqueue(input());
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    try {
      await sync.drain(true);
    } finally {
      delete (navigator as { locks?: unknown }).locks;
    }

    expect(transport.sent.length).toBe(1);
  });

  describe('gatilhos', () => {
    it('envia na abertura e de novo ao voltar a rede, ao voltar para o app e pelo temporizador', async () => {
      spyOnProperty(Document.prototype, 'visibilityState', 'get').and.returnValue('visible');
      await outbox.enqueue(input());
      await sync.start();
      expect(transport.sent.length).toBe(1);

      await outbox.enqueue(input({ type: 'parameters' }));
      window.dispatchEvent(new Event('online'));
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(transport.sent.length).toBe(2);

      await outbox.enqueue(input({ type: 'reevaluations' }));
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(transport.sent.length).toBe(3);

      await outbox.enqueue(input({ patientId: '9' }));
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(transport.sent.length).toBe(4);
    });

    it('iniciar duas vezes não duplica os gatilhos', async () => {
      const add = spyOn(window, 'addEventListener').and.callThrough();

      await sync.start();
      await sync.start();

      expect(add.calls.allArgs().filter(a => a[0] === 'online').length).toBe(1);
    });

    it('visibilitychange para "oculto" não dispara o envio; para "visível" dispara', async () => {
      await sync.start();
      // Deixa passar o efeito de troca de sessão e os esvaziamentos de abertura antes de contar chamadas.
      TestBed.tick();
      await new Promise(resolve => setTimeout(resolve, 40));
      const drain = spyOn(sync, 'drain').and.callThrough();
      const visibility = spyOnProperty(Document.prototype, 'visibilityState', 'get');

      visibility.and.returnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(drain).not.toHaveBeenCalled();

      visibility.and.returnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(drain).toHaveBeenCalledOnceWith(true);
    });
  });
});
