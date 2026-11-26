import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiMeasuresSource } from './api-measures-source';
import { PatientMeasures } from './measures-source';
import { ProvisionalMeasuresSource } from './provisional-measures-source';

describe('ApiMeasuresSource', () => {
  let source: ApiMeasuresSource;
  let http: HttpTestingController;

  const body: PatientMeasures = {
    admissionDate: '2026-11-01',
    admissionWeightKg: 60,
    bmiIdealRange: { max: 24.9, min: 18.5 },
    points: [{ at: '2026-11-01T10:00:00', bmi: 22.6, heightCm: 163, weightKg: 60 }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiMeasuresSource, ProvisionalMeasuresSource, provideHttpClient(), provideHttpClientTesting()],
    });
    source = TestBed.inject(ApiMeasuresSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('id numérico lê GET /api/v1/pacientes/{id}/medidas', async () => {
    const result = source.load('42');
    const req = http.expectOne('/api/v1/pacientes/42/medidas');

    expect(req.request.method).toBe('GET');
    req.flush(body);

    expect(await result).toEqual(body);
  });

  it('paciente sem medições recebe a série vazia (200, sem dados inventados)', async () => {
    const empty: PatientMeasures = { ...body, admissionDate: null, admissionWeightKg: null, points: [] };
    const result = source.load('7');

    http.expectOne('/api/v1/pacientes/7/medidas').flush(empty);

    expect((await result).points).toEqual([]);
  });

  it('campos nulos omitidos pelo servidor viram null', async () => {
    const result = source.load('7');

    http.expectOne('/api/v1/pacientes/7/medidas').flush({ bmiIdealRange: body.bmiIdealRange, points: [] });

    expect(await result).toEqual({
      admissionDate: null,
      admissionWeightKg: null,
      bmiIdealRange: body.bmiIdealRange,
      points: [],
    });
  });

  it('ponto sem altura e IMC (campos omitidos) fica com heightCm e bmi nulos', async () => {
    const result = source.load('7');

    http.expectOne('/api/v1/pacientes/7/medidas').flush({
      bmiIdealRange: body.bmiIdealRange,
      points: [{ at: '2026-11-26T11:09:18Z', source: 'AVALIACAO_CLINICA', weightKg: 70 }],
    });

    expect((await result).points).toEqual([
      { at: '2026-11-26T11:09:18Z', bmi: null, heightCm: null, source: 'AVALIACAO_CLINICA', weightKg: 70 },
    ] as never);
  });

  it('erro da API sobe para a tela', async () => {
    const result = source.load('42');

    http.expectOne('/api/v1/pacientes/42/medidas').flush({ message: 'x' }, { status: 500, statusText: 'Erro' });

    await expectAsync(result).toBeRejected();
  });

  it('id de exemplo (p1) vai ao provisório, sem HTTP', async () => {
    const result = await source.load('p1');

    expect(result.points.length).toBe(6);
    expect(result.points[0].weightKg).toBe(48.5);
    expect(result.points[5].bmi).toBe(19.2);
    http.expectNone(() => true);
  });
});
