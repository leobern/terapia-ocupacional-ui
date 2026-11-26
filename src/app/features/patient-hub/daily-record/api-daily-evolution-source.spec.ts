import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiDailyEvolutionSource } from './api-daily-evolution-source';
import { EvolucaoDiariaDto } from './api-evolutions';
import { EvolutionSaveRequest } from './daily-record.models';
import { ProvisionalDailyEvolutionSource } from './provisional-daily-evolution-source';

const dto = (date: string, extra: Partial<EvolucaoDiariaDto> = {}): EvolucaoDiariaDto => ({
  at: `${date}T10:00:00-03:00`,
  author: 'Dra. Ana',
  date,
  origin: 'MANUAL',
  parameters: [],
  reevaluations: [],
  text: `Texto ${date}`,
  ...extra,
});

const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve));
const noContent = { status: 204, statusText: 'No Content' };
const failure = { status: 500, statusText: 'Erro' };

describe('ApiDailyEvolutionSource', () => {
  let source: ApiDailyEvolutionSource;
  let http: HttpTestingController;
  const base: EvolutionSaveRequest = {
    at: '2026-11-25T10:00:00Z',
    author: 'Ignorado',
    day: '2026-11-25',
    origin: 'ai',
    patientId: '42',
    text: 'Novo texto',
  };
  const dayUrl = (day: string): string => `/api/v1/pacientes/42/evolucoes/${day}`;
  const listUrl = (r: { url: string }): boolean => r.url === '/api/v1/pacientes/42/evolucoes';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiDailyEvolutionSource,
        ProvisionalDailyEvolutionSource,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    source = TestBed.inject(ApiDailyEvolutionSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('load: lê o dia, 204 é null e erro sobe', async () => {
    const ok = source.load('42', '2026-11-25');

    http.expectOne(dayUrl('2026-11-25')).flush(dto('2026-11-25'));
    expect((await ok)?.author).toBe('Dra. Ana');

    const empty = source.load('42', '2026-11-24');

    http.expectOne(dayUrl('2026-11-24')).flush(null, noContent);
    expect(await empty).toBeNull();

    const failed = source.load('42', '2026-11-23');

    http.expectOne(dayUrl('2026-11-23')).flush({ message: 'x' }, failure);
    await expectAsync(failed).toBeRejected();
  });

  it('load: dia só com parâmetros não é evolução', async () => {
    const result = source.load('42', '2026-11-25');

    http.expectOne(dayUrl('2026-11-25')).flush(dto('2026-11-25', { text: '' }));
    expect(await result).toBeNull();
  });

  it('save: lê o dia, preserva os parâmetros e as reavaliações e não envia autor nem hora', async () => {
    const parameters = [{ parameterId: 'glycemia', value: 120 }];
    const reevaluations = [{ dueAt: '2026-11-27T10:00:00Z', id: 'r1', name: 'Diarreia' }];
    const result = source.save(base);

    http.expectOne(dayUrl('2026-11-25')).flush(dto('2026-11-25', { parameters, reevaluations }));
    await tick();
    const put = http.expectOne(r => r.method === 'PUT');

    expect(put.request.body).toEqual({ origin: 'AI', parameters, reevaluations, text: 'Novo texto' });
    put.flush(dto('2026-11-25', { origin: 'AI', parameters, reevaluations, text: 'Novo texto' }));

    expect(await result).toEqual({
      at: '2026-11-25T10:00:00-03:00',
      author: 'Dra. Ana',
      origin: 'ai',
      reevaluations,
      text: 'Novo texto',
    });
  });

  it('save: as reavaliações da tela substituem as do servidor', async () => {
    const reevaluations = [{ dueAt: '2026-11-28T10:00:00Z', id: 'r2', name: 'Edema' }];
    const result = source.save({ ...base, origin: 'manual', reevaluations });

    http.expectOne(dayUrl('2026-11-25')).flush(null, noContent);
    await tick();
    const put = http.expectOne(r => r.method === 'PUT');

    expect(put.request.body).toEqual({ origin: 'MANUAL', parameters: [], reevaluations, text: 'Novo texto' });
    put.flush(dto('2026-11-25', { reevaluations, text: 'Novo texto' }));
    await result;
  });

  it('save: sem reavaliações na tela nem no servidor envia lista vazia; erro do PUT sobe', async () => {
    const result = source.save(base);

    http.expectOne(dayUrl('2026-11-25')).flush(null, noContent);
    await tick();
    const put = http.expectOne(r => r.method === 'PUT');

    expect((put.request.body as { reevaluations: unknown[] }).reevaluations).toEqual([]);
    put.flush({ message: 'x' }, { status: 400, statusText: 'x' });
    await expectAsync(result).toBeRejected();
  });

  it('list: uma página cobre a janela; ignora dias fora dela e dias só com parâmetros', async () => {
    const result = source.list('42', ['2026-11-25', '2026-11-24', '2026-11-23']);
    const req = http.expectOne(listUrl);

    expect(req.request.params.get('limit')).toBe('3');
    expect(req.request.params.has('before')).toBe(false);
    req.flush({
      items: [dto('2026-11-26'), dto('2026-11-25'), dto('2026-11-24', { text: '' }), dto('2026-11-23')],
      nextBefore: null,
    });

    expect((await result).map(d => d.day)).toEqual(['2026-11-25', '2026-11-23']);
  });

  it('list: pagina com before enquanto a próxima página ainda alcança a janela', async () => {
    const result = source.list('42', ['2026-11-25', '2026-11-20']);

    http.expectOne(listUrl).flush({ items: [dto('2026-11-25')], nextBefore: '2026-11-25' });
    await tick();
    const next = http.expectOne(listUrl);

    expect(next.request.params.get('before')).toBe('2026-11-25');
    next.flush({ items: [dto('2026-11-20')], nextBefore: '2026-11-20' });

    expect((await result).map(d => d.day)).toEqual(['2026-11-25', '2026-11-20']);
  });

  it('list: sem dias não chama a API; erro sobe', async () => {
    expect(await source.list('42', [])).toEqual([]);

    const failed = source.list('42', ['2026-11-25']);

    http.expectOne(listUrl).flush({ message: 'x' }, { status: 404, statusText: 'x' });
    await expectAsync(failed).toBeRejected();
  });

  it('ids de exemplo ficam no provisório, sem HTTP', async () => {
    expect(await source.load('p1', '2026-11-25')).toBeNull();
    await source.save({ ...base, patientId: 'p1' });
    expect((await source.load('p1', '2026-11-25'))?.text).toBe('Novo texto');
    expect((await source.list('p1', ['2026-11-25'])).length).toBe(1);
  });
});
