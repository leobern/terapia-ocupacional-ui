import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiAssessmentSource, toNutritionFunctionalAssessment } from './api-assessment-source';
import { ProvisionalAssessmentSource } from './provisional-assessment-source';

describe('ApiAssessmentSource', () => {
  let source: ApiAssessmentSource;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiAssessmentSource, ProvisionalAssessmentSource, provideHttpClient(), provideHttpClientTesting()],
    });
    source = TestBed.inject(ApiAssessmentSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('id numérico lê GET avaliacao-nutricional e devolve valores e anterior', async () => {
    const result = source.loadLatest('42');
    const req = http.expectOne('/api/v1/pacientes/42/avaliacao-nutricional');

    expect(req.request.method).toBe('GET');
    req.flush({
      at: '2026-11-25T10:00:00-03:00',
      author: 'Dra. Ana',
      previous: { weight: { at: '2026-11-20T10:00:00-03:00', value: '50,4' } },
      values: { calfSide: 'Direito', weight: '51,0' },
    });

    expect(await result).toEqual({
      previous: { weight: { at: '2026-11-20T10:00:00-03:00', value: '50,4' } },
      values: { calfSide: 'Direito', weight: '51,0' },
    });
  });

  it('204 (sem avaliação) vira null', async () => {
    const result = source.loadLatest('7');

    http.expectOne('/api/v1/pacientes/7/avaliacao-nutricional').flush(null, { status: 204, statusText: 'No Content' });

    expect(await result).toBeNull();
  });

  it('toNutritionFunctionalAssessment descarta autor e data da versão', () => {
    expect(toNutritionFunctionalAssessment({ at: 'x', author: 'a', previous: {}, values: { height: '163' } })).toEqual({
      previous: {},
      values: { height: '163' },
    });
  });

  it('salvar envia PUT só com values', async () => {
    const done = source.save('42', { dysphagia: 'Risco baixo', weight: '51,0' });
    const req = http.expectOne('/api/v1/pacientes/42/avaliacao-nutricional');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ values: { dysphagia: 'Risco baixo', weight: '51,0' } });
    req.flush({ at: '2026-11-25T10:00:00-03:00', author: 'Dra. Ana', previous: {}, values: {} });
    await done;
  });

  it('erros do servidor sobem', async () => {
    const done = source.save('9', { weight: '51,0' });

    http.expectOne('/api/v1/pacientes/9/avaliacao-nutricional').flush({}, { status: 400, statusText: 'Bad Request' });
    await expectAsync(done).toBeRejected();

    const load = source.loadLatest('9');

    http.expectOne('/api/v1/pacientes/9/avaliacao-nutricional').flush({}, { status: 404, statusText: 'Not Found' });
    await expectAsync(load).toBeRejected();
  });

  it('id de exemplo usa o provisório e não chama a API', async () => {
    expect((await source.loadLatest('p1'))?.values.weight).toBe('51,0');
    expect(await source.loadLatest('p-vazio')).toBeNull();

    await source.save('p-spec', { weight: '60' });

    http.expectNone('/api/v1/pacientes/p1/avaliacao-nutricional');

    expect((await source.loadLatest('p-spec'))?.values.weight).toBe('60');
  });
});
