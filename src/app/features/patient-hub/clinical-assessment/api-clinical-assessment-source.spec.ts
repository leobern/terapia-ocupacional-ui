import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClinicalAssessmentSource, toClinicalAssessment } from './api-clinical-assessment-source';
import { ClinicalAssessment } from './clinical-assessment.models';
import { ProvisionalClinicalAssessmentSource } from './provisional-clinical-assessment-source';

describe('ApiClinicalAssessmentSource', () => {
  let source: ApiClinicalAssessmentSource;
  let http: HttpTestingController;
  const range = { from: 0, label: 'Sem risco', to: 2, tone: 'success' as const };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ApiClinicalAssessmentSource,
        ProvisionalClinicalAssessmentSource,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    source = TestBed.inject(ApiClinicalAssessmentSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('id numérico lê GET avaliacao-clinica e traduz para o modelo da tela', async () => {
    const result = source.load('42');
    const req = http.expectOne('/api/v1/pacientes/42/avaliacao-clinica');

    expect(req.request.method).toBe('GET');
    req.flush({
      device: 'SNE',
      heightCm: 153,
      items: [
        { fixed: true, id: 'nrs', ranges: [range], title: 'NRS-2002', unit: 'pontos', value: '4' },
        { fixed: null, id: 'g', ranges: [], title: 'Glicemia', unit: 'mg/dL', value: '90' },
      ],
      previousWeight: { at: '2026-11-20T10:00:00-03:00', kg: 50.4 },
      tnType: 'NE',
      weightKg: 55,
    });

    expect(await result).toEqual({
      device: 'SNE',
      heightCm: 153,
      items: [
        { fixed: true, id: 'nrs', ranges: [range], title: 'NRS-2002', unit: 'pontos', value: '4' },
        { id: 'g', ranges: [], title: 'Glicemia', unit: 'mg/dL', value: '90' },
      ],
      previousWeight: { at: '2026-11-20T10:00:00-03:00', kg: 50.4 },
      tnType: 'NE',
      weightKg: 55,
    });
  });

  it('paciente sem avaliação volta vazio, sem peso anterior', async () => {
    const result = source.load('7');

    http
      .expectOne('/api/v1/pacientes/7/avaliacao-clinica')
      .flush({ device: '', heightCm: null, items: [], previousWeight: null, tnType: '', weightKg: null });

    expect(await result).toEqual({ device: '', heightCm: null, items: [], tnType: '', weightKg: null });
  });

  it('toClinicalAssessment mantém fixed só quando verdadeiro', () => {
    const base = { device: '', heightCm: null, previousWeight: null, tnType: '', weightKg: null };
    const item = { id: 'a', ranges: [], title: 'A', unit: '', value: '1' };

    expect(toClinicalAssessment({ ...base, items: [{ ...item, fixed: false }] }).items).toEqual([item]);
    expect(toClinicalAssessment({ ...base, items: [{ ...item, fixed: true }] }).items).toEqual([
      { ...item, fixed: true },
    ]);
  });

  it('salvar envia PUT sem o peso anterior (é do servidor)', async () => {
    const assessment: ClinicalAssessment = {
      device: 'SNE',
      heightCm: 153,
      items: [{ id: 'g', ranges: [range], title: 'Glicemia', unit: 'mg/dL', value: '90' }],
      previousWeight: { at: '2026-11-20T10:00:00-03:00', kg: 50.4 },
      tnType: 'NE',
      weightKg: 55,
    };
    const done = source.save('42', assessment);
    const req = http.expectOne('/api/v1/pacientes/42/avaliacao-clinica');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      device: 'SNE',
      heightCm: 153,
      items: assessment.items,
      tnType: 'NE',
      weightKg: 55,
    });
    req.flush({});
    await done;
  });

  it('erro do servidor sobe', async () => {
    const done = source.save('9', { device: '', heightCm: null, items: [], tnType: '', weightKg: null });

    http.expectOne('/api/v1/pacientes/9/avaliacao-clinica').flush({}, { status: 400, statusText: 'Bad Request' });
    await expectAsync(done).toBeRejected();

    const load = source.load('9');

    http.expectOne('/api/v1/pacientes/9/avaliacao-clinica').flush({}, { status: 404, statusText: 'Not Found' });
    await expectAsync(load).toBeRejected();
  });

  it('id de exemplo usa o provisório e não chama a API', async () => {
    const seed = await source.load('p1');

    expect(seed.tnType).toBe('NE');

    await source.save('p-spec', { device: '', heightCm: null, items: [], tnType: 'NE', weightKg: 60 });

    http.expectNone('/api/v1/pacientes/p1/avaliacao-clinica');

    expect((await source.load('p-spec')).weightKg).toBe(60);
  });
});
