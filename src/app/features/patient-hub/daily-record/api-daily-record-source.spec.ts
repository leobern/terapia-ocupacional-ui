import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiDailyRecordSource } from './api-daily-record-source';
import { EvolucaoDiariaDto } from './api-evolutions';
import { ProvisionalDailyRecordSource } from './provisional-daily-record-source';

const dto = (date: string, ids: string[]): EvolucaoDiariaDto => ({
  at: `${date}T10:00:00-03:00`,
  author: 'Dra. Ana',
  date,
  origin: 'MANUAL',
  parameters: ids.map(parameterId => ({ parameterId, value: 1 })),
  reevaluations: [],
  text: '',
});

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve));
const listUrl = (r: { url: string }): boolean => r.url === '/api/v1/pacientes/42/evolucoes';

describe('ApiDailyRecordSource', () => {
  let source: ApiDailyRecordSource;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiDailyRecordSource, ProvisionalDailyRecordSource, provideHttpClient(), provideHttpClientTesting()],
    });
    source = TestBed.inject(ApiDailyRecordSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('percorre as páginas e devolve os lançamentos em ordem cronológica', async () => {
    const result = source.loadEntries('42');
    const first = http.expectOne(listUrl);

    expect(first.request.params.get('limit')).toBe('100');
    first.flush({ items: [dto('2026-11-25', ['a', 'b'])], nextBefore: '2026-11-25' });
    await tick();
    const next = http.expectOne(listUrl);

    expect(next.request.params.get('before')).toBe('2026-11-25');
    next.flush({ items: [dto('2026-11-24', ['c'])], nextBefore: null });

    expect((await result).map(e => e.parameterId)).toEqual(['c', 'a', 'b']);
  });

  it('erro sobe; id de exemplo usa o provisório', async () => {
    const failed = source.loadEntries('42');

    http.expectOne(listUrl).flush({ message: 'x' }, { status: 404, statusText: 'x' });
    await expectAsync(failed).toBeRejected();
    expect(await source.loadEntries('p1')).toEqual([]);
  });
});
