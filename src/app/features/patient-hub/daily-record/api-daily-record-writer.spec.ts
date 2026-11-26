import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiDailyRecordWriter } from './api-daily-record-writer';
import { EvolucaoDiariaDto } from './api-evolutions';
import { ProvisionalDailyRecordSource } from './provisional-daily-record-source';

const dto = (extra: Partial<EvolucaoDiariaDto> = {}): EvolucaoDiariaDto => ({
  at: '2026-11-25T10:00:00-03:00',
  author: 'Dra. Ana',
  date: '2026-11-25',
  origin: 'AI',
  parameters: [],
  reevaluations: [],
  text: 'Estável.',
  ...extra,
});

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve));
const dayUrl = '/api/v1/pacientes/42/evolucoes/2026-11-25';

describe('ApiDailyRecordWriter', () => {
  let writer: ApiDailyRecordWriter;
  let http: HttpTestingController;
  const at = new Date(2026, 10, 25, 9, 0).toISOString();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiDailyRecordWriter, ProvisionalDailyRecordSource, provideHttpClient(), provideHttpClientTesting()],
    });
    writer = TestBed.inject(ApiDailyRecordWriter);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('acrescenta os lançamentos ao dia, preserva texto, origem e reavaliações e devolve só os novos', async () => {
    const old = { parameterId: 'bowel', value: 2 };
    const reevaluations = [{ dueAt: '2026-11-27T10:00:00Z', id: 'r1', name: 'Diarreia' }];
    const result = writer.record('42', [
      { at, author: 'Ignorado', parameterId: 'glycemia', value: 130 },
      { at, author: 'Ignorado', parameterId: 'custom:x', parameterLabel: 'X', unit: 'u', value: 1 },
    ]);

    http.expectOne(dayUrl).flush(dto({ parameters: [old], reevaluations }));
    await tick();
    const put = http.expectOne(r => r.method === 'PUT');
    const sent = [
      old,
      { parameterId: 'glycemia', value: 130 },
      { parameterId: 'custom:x', parameterLabel: 'X', unit: 'u', value: 1 },
    ];

    expect(put.request.body).toEqual({ origin: 'AI', parameters: sent, reevaluations, text: 'Estável.' });
    put.flush(dto({ parameters: sent, reevaluations }));

    const created = await result;

    expect(created.map(e => e.id)).toEqual(['2026-11-25#1', '2026-11-25#2']);
    expect(created[0].author).toBe('Dra. Ana');
  });

  it('dia sem registro começa vazio, origem manual', async () => {
    const result = writer.record('42', [{ at, author: 'x', parameterId: 'glycemia', value: 130 }]);

    http.expectOne(dayUrl).flush(null, { status: 204, statusText: 'No Content' });
    await tick();
    const put = http.expectOne(r => r.method === 'PUT');

    expect(put.request.body).toEqual({
      origin: 'MANUAL',
      parameters: [{ parameterId: 'glycemia', value: 130 }],
      reevaluations: [],
      text: '',
    });
    put.flush(dto({ origin: 'MANUAL', parameters: [{ parameterId: 'glycemia', value: 130 }], text: '' }));
    expect((await result).length).toBe(1);
  });

  it('sem lançamentos não chama a API; erro sobe; id de exemplo usa o provisório', async () => {
    expect(await writer.record('42', [])).toEqual([]);

    const failed = writer.record('42', [{ at, author: 'x', parameterId: 'glycemia', value: 1 }]);

    http.expectOne(dayUrl).flush({ message: 'x' }, { status: 404, statusText: 'x' });
    await expectAsync(failed).toBeRejected();

    expect((await writer.record('p1', [{ at, author: 'x', parameterId: 'glycemia', value: 1 }])).length).toBe(1);
  });
});
