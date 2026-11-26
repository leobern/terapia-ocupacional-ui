import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProfessionalProfileReader } from '../../home/professional-profile';
import { ApiPrescriptionSource } from './api-prescription-source';
import { Prescription } from './prescription.models';
import { ProvisionalPrescriptionSource } from './provisional-prescription-source';

describe('ApiPrescriptionSource', () => {
  let source: ApiPrescriptionSource;
  let http: HttpTestingController;
  const url = '/api/v1/pacientes/42/prescricao';
  const dto = {
    at: '2026-11-26T10:00:00-03:00',
    author: 'Dra. Ana',
    formulaId: 7,
    formulaName: 'Fórmula X',
    kcalPerMl: 1.5,
    modality: 'continuous',
    nursingNotes: '',
    pauseTimes: [],
    proteinPerMl: 0.06,
    route: 'NE',
    startTime: '08:00',
    volumeMl: 1200,
  };
  const prescription: Prescription = {
    ...dto,
    at: 'ignorado',
    author: 'ignorado',
    formulaId: '7',
    modality: 'continuous',
    route: 'NE',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiPrescriptionSource,
        ProvisionalPrescriptionSource,
        { provide: ProfessionalProfileReader, useValue: { read: (): object => ({ role: 'doctor' }) } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    source = TestBed.inject(ApiPrescriptionSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lê a prescrição vigente convertendo o id da fórmula para texto', async () => {
    const result = source.load('42');

    http.expectOne(url).flush({ prescriptions: [dto] });

    expect(await result).toEqual([{ ...dto, formulaId: '7' } as unknown as Prescription]);
  });

  it('204 vira lista vazia', async () => {
    const result = source.load('42');

    http.expectOne(url).flush(null, { status: 204, statusText: 'No Content' });

    expect(await result).toEqual([]);
  });

  it('grava só os campos do contrato (id numérico, sem snapshot, autor nem hora) e devolve o do servidor', async () => {
    const result = source.save({ patientId: '42', prescriptions: [prescription] });
    const req = http.expectOne(url);

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      prescriptions: [
        {
          formulaId: 7,
          modality: 'continuous',
          nursingNotes: '',
          pauseTimes: [],
          route: 'NE',
          startTime: '08:00',
          volumeMl: 1200,
        },
      ],
    });
    req.flush({ prescriptions: [dto] });

    expect((await result)[0].author).toBe('Dra. Ana');
  });

  it('recusa fórmula de exemplo sem chamar a API', async () => {
    await expectAsync(
      source.save({ patientId: '42', prescriptions: [{ ...prescription, formulaId: 'enteral-1' }] }),
    ).toBeRejectedWithError(/catálogo real/u);
  });

  it('propaga erro do servidor', async () => {
    const result = source.save({ patientId: '42', prescriptions: [prescription] });

    http.expectOne(url).flush({ message: 'não padronizada' }, { status: 400, statusText: 'Bad Request' });

    await expectAsync(result).toBeRejected();
  });

  it('a projeção ativa sai da prescrição lida', async () => {
    const result = source.loadActive('42');

    http.expectOne(url).flush({ prescriptions: [dto] });

    expect(await result).toEqual([jasmine.objectContaining({ formula: 'Fórmula X', kcal: 1800 })]);
  });

  it('paciente de exemplo usa o provisório, inclusive a revisão diária', async () => {
    expect((await source.load('p1'))[0].formulaId).toBe('enteral-1');
    expect(await source.loadActive('p1')).toHaveSize(1);
    expect(await source.save({ patientId: 'p1', prescriptions: [] })).toEqual([]);
    expect(await source.loadReview('42', '2026-11-26')).toBeNull();

    const review = await source.keep({ at: 'a', author: 'b', day: '2026-11-26', patientId: '42' });

    expect(await source.loadReview('42', '2026-11-26')).toEqual(review);
  });
});
