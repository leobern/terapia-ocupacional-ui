import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiPatientListSource, CensoPacienteDto, isoDay, toCensusPatient } from './api-patient-list-source';
import { assemblePatientList } from './patient-list-assembly';
import { provisionalCensusSeed } from './provisional-patient-list';

const dto = (over: Partial<CensoPacienteDto> = {}): CensoPacienteDto => ({
  bedNumber: '12',
  birthDate: '1980-02-03',
  fullName: 'Fulana de Tal',
  id: 42,
  internacaoId: 7,
  nutritionalTherapyStartDate: '2026-11-10',
  unit: 'UTI',
  ward: 'Ala 2',
  ...over,
});

describe('ApiPatientListSource', () => {
  let source: ApiPatientListSource;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiPatientListSource, provideHttpClient(), provideHttpClientTesting()],
    });
    source = TestBed.inject(ApiPatientListSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lê o censo com a data local AAAA-MM-DD e mapeia para o modelo', async () => {
    const result = source.loadCensus(5, new Date(2026, 0, 9, 23, 30));
    const req = http.expectOne(r => r.url === '/api/v1/hospitais/5/pacientes');

    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('data')).toBe('2026-01-09');
    req.flush({ date: '2026-01-09', hospitalId: 5, patients: [dto()] });
    const [patient] = await result;

    expect(patient).toEqual(
      jasmine.objectContaining({
        bed: '12',
        hospitalId: 5,
        id: '42',
        name: 'Fulana de Tal',
        therapy: null,
        therapyStartDate: '2026-11-10',
        ward: 'Ala 2',
      }),
    );
  });

  it('rejeita em erro HTTP (403) para a tela mostrar o aviso', async () => {
    const result = source.loadCensus(5, new Date());

    http
      .expectOne(r => r.url === '/api/v1/hospitais/5/pacientes')
      .flush({ message: 'x' }, { status: 403, statusText: 'Forbidden' });

    await expectAsync(result).toBeRejectedWith(jasmine.any(HttpErrorResponse));
  });

  it('paciente real fica neutro e visível na lista, sem inventar dado clínico', async () => {
    const result = source.loadCensus(5, new Date(2026, 10, 25));

    http.expectOne(r => r.url === '/api/v1/hospitais/5/pacientes').flush({ patients: [dto()] });
    const list = assemblePatientList(await result, 5, new Date(2026, 10, 25));

    expect(list.length).toBe(1);
    expect(list[0]).toEqual(
      jasmine.objectContaining({ adequacy: null, finished: false, firstEvaluation: false, therapy: null }),
    );

    expect(list[0].therapyDays).toBe(15);
  });
});

describe('toCensusPatient', () => {
  it('usa a unidade quando a ala está vazia, e "" quando ambas e o leito faltam', () => {
    expect(toCensusPatient(dto({ ward: '  ' }), 1).ward).toBe('UTI');
    expect(toCensusPatient(dto({ ward: null }), 1).ward).toBe('UTI');

    const bare = toCensusPatient(dto({ bedNumber: null, unit: undefined, ward: undefined }), 1);

    expect(bare.ward).toBe('');
    expect(bare.bed).toBe('');
  });

  it('início da terapia ausente vira null e a montagem não calcula dias', () => {
    const patient = toCensusPatient(dto({ nutritionalTherapyStartDate: null }), 1);

    expect(patient.therapyStartDate).toBeNull();
    expect(assemblePatientList([patient], 1, new Date())[0].therapyDays).toBeNull();
  });

  it('com paciente de exemplo de mesmo id, mantém os campos clínicos dele e os de identificação do backend', () => {
    const seed = provisionalCensusSeed()[0];
    const merged = toCensusPatient(dto({ id: 99 }), 3, seed);

    expect(merged.id).toBe('99');
    expect(merged.hospitalId).toBe(3);
    expect(merged.name).toBe('Fulana de Tal');
    expect(merged.therapy).toBe(seed.therapy);
    expect(merged.adequacy).toEqual(seed.adequacy);
  });

  it('isoDay completa mês e dia com zero', () => {
    expect(isoDay(new Date(2026, 2, 4))).toBe('2026-03-04');
  });
});
