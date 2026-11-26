import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from '../../../features/auth/local-session-store';
import { OfflineStore, OutboxOperation } from '../../../shared/offline/offline-store';
import { InMemoryOfflineStore, tokenFor } from '../../../shared/offline/offline-testing.spec';
import { OutboxService } from '../../../shared/offline/outbox.service';
import { OUTBOX_SYNC_CONFIG, OutboxSyncService } from '../../../shared/offline/outbox-sync.service';
import { OutboxTransport } from '../../../shared/offline/outbox-transport';
import { NOW } from '../../home/professional-profile';
import { OfflineDailyEvolutionSource } from './offline-daily-evolution-source';
import { OfflineDailyRecordSource, OfflineDailyRecordWriter } from './offline-daily-record';
import { ProvisionalDailyEvolutionSource } from './provisional-daily-evolution-source';
import { ProvisionalDailyRecordSource } from './provisional-daily-record-source';

/** Mantém tudo pendente: toda tentativa de envio falha por rede. */
class OfflineTransport extends OutboxTransport {
  send(): Promise<never> {
    return Promise.reject(new HttpErrorResponse({ status: 0 }));
  }
}

const dto = (date: string, text: string): object => ({
  at: `${date}T09:00:00-03:00`,
  author: 'Dra. Ana',
  conflict: false,
  date,
  origin: 'MANUAL',
  parameters: [],
  reevaluations: [],
  text,
  version: 3,
});

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 5));
const failNetwork = (ctrl: HttpTestingController, match: (r: { url: string }) => boolean): void =>
  ctrl.expectOne(match).error(new ProgressEvent('error'), { status: 0 });

describe('evolução e registro diário offline', () => {
  let ctrl: HttpTestingController;
  let outbox: OutboxService;
  let evolutions: OfflineDailyEvolutionSource;
  let entries: OfflineDailyRecordSource;
  let writer: OfflineDailyRecordWriter;
  let sync: OutboxSyncService;
  const dayUrl = '/api/v1/pacientes/42/evolucoes/2026-11-26';
  const listUrl = (r: { url: string }): boolean => r.url === '/api/v1/pacientes/42/evolucoes';
  const author = 'Dra. Ana';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        OfflineDailyEvolutionSource,
        OfflineDailyRecordSource,
        OfflineDailyRecordWriter,
        ProvisionalDailyEvolutionSource,
        ProvisionalDailyRecordSource,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OfflineStore, useFactory: (): InMemoryOfflineStore => new InMemoryOfflineStore() },
        { provide: OutboxTransport, useClass: OfflineTransport },
        { provide: NOW, useValue: (): Date => new Date('2026-11-26T12:00:00.000Z') },
        {
          provide: OUTBOX_SYNC_CONFIG,
          useValue: { baseDelayMs: 1000, intervalMs: 60_000, maxDelayMs: 4000, maxServerErrors: 3 },
        },
      ],
    });
    TestBed.inject(LocalSessionStore).open({ accessToken: tokenFor({ upn: 'ana@x.com' }), refreshToken: 'r' });
    ctrl = TestBed.inject(HttpTestingController);
    outbox = TestBed.inject(OutboxService);
    sync = TestBed.inject(OutboxSyncService);
    evolutions = TestBed.inject(OfflineDailyEvolutionSource);
    entries = TestBed.inject(OfflineDailyRecordSource);
    writer = TestBed.inject(OfflineDailyRecordWriter);
  });

  afterEach(() => {
    sync.stop();
    localStorage.clear();
  });

  const pendingOps = (): readonly OutboxOperation[] => outbox.operations();

  describe('OfflineDailyEvolutionSource', () => {
    it('gravar enfileira o texto com a versão que a tela viu e responde na hora, marcado como pendente', async () => {
      const saved = await evolutions.save({
        at: '2026-11-26T11:00:00.000Z',
        author,
        baseVersion: 3,
        day: '2026-11-26',
        origin: 'ai-edited',
        patientId: '42',
        text: 'Paciente estável',
      });

      expect(saved).toEqual(
        jasmine.objectContaining({ author, origin: 'ai-edited', pending: true, text: 'Paciente estável', version: 3 }),
      );
      const [op] = pendingOps();

      expect(op).toEqual(
        jasmine.objectContaining({
          baseVersion: 3,
          day: '2026-11-26',
          occurredAt: '2026-11-26T11:00:00.000Z',
          patientId: '42',
          type: 'evolution-text',
        }),
      );
      expect(op.payload).toEqual({ author, origin: 'AI_EDITED', text: 'Paciente estável' });
    });

    it('reavaliações viram uma segunda operação aditiva, depois do texto', async () => {
      const reevaluations = [{ dueAt: '2026-11-28T10:00:00.000Z', id: 'r1', name: 'Diarreia' }];

      await evolutions.save({
        at: '2026-11-26T11:00:00.000Z',
        author,
        day: '2026-11-26',
        origin: 'manual',
        patientId: '42',
        reevaluations,
        text: 'x',
      });

      expect(pendingOps().map(o => o.type)).toEqual(['evolution-text', 'reevaluations']);
      expect(pendingOps()[0].baseVersion).toBeUndefined();
      expect(pendingOps()[1].payload['reevaluations']).toEqual(reevaluations);
    });

    it('texto inalterado só enfileira as reavaliações (não cria versão de texto nem falso conflito)', async () => {
      const reevaluations = [{ dueAt: '2026-11-28T10:00:00.000Z', id: 'r1', name: 'Diarreia' }];
      const saved = await evolutions.save({
        at: '2026-11-26T11:00:00.000Z',
        author,
        day: '2026-11-26',
        origin: 'manual',
        patientId: '42',
        reevaluations,
        text: 'igual',
        textUnchanged: true,
      });

      expect(pendingOps().map(o => o.type)).toEqual(['reevaluations']);
      expect(saved.text).toBe('igual');
    });

    it('gravar rejeita (a tela mantém o texto) quando o armazenamento local falha', async () => {
      (TestBed.inject(OfflineStore) as InMemoryOfflineStore).failWrites = true;

      await expectAsync(
        evolutions.save({ at: 'x', author, day: '2026-11-26', origin: 'manual', patientId: '42', text: 'x' }),
      ).toBeRejected();
    });

    it('ler: o texto pendente aparece por cima do servidor, com a versão do servidor', async () => {
      await evolutions.save({
        at: '2026-11-26T11:00:00.000Z',
        author,
        day: '2026-11-26',
        origin: 'manual',
        patientId: '42',
        text: 'meu texto offline',
      });
      const promise = evolutions.load('42', '2026-11-26');

      await tick();
      ctrl.expectOne(dayUrl).flush(dto('2026-11-26', 'do servidor'));
      const loaded = await promise;

      expect(loaded).toEqual(jasmine.objectContaining({ pending: true, text: 'meu texto offline', version: 3 }));
    });

    it('ler sem nada pendente devolve o do servidor; sem rede e sem pendência o erro sobe', async () => {
      const ok = evolutions.load('42', '2026-11-26');

      ctrl.expectOne(dayUrl).flush(dto('2026-11-26', 'do servidor'));
      expect((await ok)?.pending).toBeUndefined();

      const failing = evolutions.load('42', '2026-11-26');

      failNetwork(ctrl, r => r.url === dayUrl);
      await expectAsync(failing).toBeRejected();
    });

    it('ler sem rede e sem cópia mostra o que está na fila', async () => {
      await evolutions.save({
        at: '2026-11-26T11:00:00.000Z',
        author,
        day: '2026-11-26',
        origin: 'manual',
        patientId: '42',
        text: 'só local',
      });
      const promise = evolutions.load('42', '2026-11-26');

      await tick();
      failNetwork(ctrl, r => r.url === dayUrl);

      expect(await promise).toEqual(jasmine.objectContaining({ pending: true, text: 'só local', version: 0 }));
    });

    it('listar mescla o pendente aos dias do servidor, do mais recente ao mais antigo', async () => {
      await evolutions.save({
        at: '2026-11-26T11:00:00.000Z',
        author,
        day: '2026-11-26',
        origin: 'manual',
        patientId: '42',
        text: 'hoje offline',
      });
      const promise = evolutions.list('42', ['2026-11-26', '2026-11-25']);

      await tick();
      ctrl.expectOne(listUrl).flush({ items: [dto('2026-11-25', 'ontem')], nextBefore: null });
      const list = await promise;

      expect(list.map(d => [d.day, d.evolution.text])).toEqual([
        ['2026-11-26', 'hoje offline'],
        ['2026-11-25', 'ontem'],
      ]);
    });

    it('listar: sem rede e sem pendência o erro sobe; com pendência mostra só o local', async () => {
      const failing = evolutions.list('42', ['2026-11-26']);

      await tick();
      failNetwork(ctrl, listUrl);
      await expectAsync(failing).toBeRejected();

      await evolutions.save({
        at: '2026-11-26T11:00:00.000Z',
        author,
        day: '2026-11-26',
        origin: 'manual',
        patientId: '42',
        text: 'local',
      });
      const local = evolutions.list('42', ['2026-11-26']);

      await tick();
      failNetwork(ctrl, listUrl);

      expect((await local).map(d => d.evolution.text)).toEqual(['local']);
    });

    it('ids de exemplo seguem no provisório, sem fila', async () => {
      const provisional = TestBed.inject(ProvisionalDailyEvolutionSource);
      const spy = spyOn(provisional, 'save').and.callThrough();

      await evolutions.save({ at: 'x', author, day: '2026-11-26', origin: 'manual', patientId: 'p1', text: 'x' });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(pendingOps()).toEqual([]);
      expect(await evolutions.load('p1', '2026-11-26')).toBeTruthy();
      expect((await evolutions.list('p1', ['2026-11-26'])).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Registro diário', () => {
    const entry = { at: '2026-11-26T11:00:00.000Z', author, parameterId: 'glycemia', value: 132 };

    it('gravar parâmetros enfileira uma entrada aditiva no dia do lançamento e devolve os lançamentos pendentes', async () => {
      const saved = await writer.record('42', [
        entry,
        { ...entry, parameterId: 'custom:albumina', parameterLabel: 'Albumina', unit: 'g/dL', value: 3.1 },
      ]);
      const [op] = pendingOps();

      expect(op).toEqual(jasmine.objectContaining({ day: '2026-11-26', occurredAt: entry.at, type: 'parameters' }));
      expect(op.payload['parameters']).toEqual([
        { parameterId: 'glycemia', value: 132 },
        { parameterId: 'custom:albumina', parameterLabel: 'Albumina', unit: 'g/dL', value: 3.1 },
      ]);
      expect(saved.map(s => s.id)).toEqual([`pendente:${op.opId}#0`, `pendente:${op.opId}#1`]);
    });

    it('gravar sem lançamentos não enfileira; ids de exemplo vão ao provisório', async () => {
      expect(await writer.record('42', [])).toEqual([]);
      expect(pendingOps()).toEqual([]);
      const created = await writer.record('p1', [entry]);

      expect(created.length).toBe(1);
      expect(pendingOps()).toEqual([]);
    });

    it('ler junta os lançamentos do servidor aos pendentes (com os dados do autor)', async () => {
      await writer.record('42', [{ ...entry, parameterLabel: undefined }]);
      const promise = entries.loadEntries('42');

      await tick();
      ctrl.expectOne(listUrl).flush({
        items: [{ ...dto('2026-11-25', ''), parameters: [{ parameterId: 'bowel', value: 2 }] }],
        nextBefore: null,
      });
      const list = await promise;

      expect(list.map(e => [e.parameterId, e.value])).toEqual([
        ['bowel', 2],
        ['glycemia', 132],
      ]);
      expect(list[1].author).toBe(author);
    });

    it('ler sem rede: só o pendente aparece; sem pendência o erro sobe; id de exemplo no provisório', async () => {
      const failing = entries.loadEntries('42');

      failNetwork(ctrl, listUrl);
      await expectAsync(failing).toBeRejected();

      await writer.record('42', [entry]);
      const local = entries.loadEntries('42');

      await tick();
      failNetwork(ctrl, listUrl);

      expect((await local).length).toBe(1);
      expect(await entries.loadEntries('p1')).toEqual([]);
    });
  });
});
