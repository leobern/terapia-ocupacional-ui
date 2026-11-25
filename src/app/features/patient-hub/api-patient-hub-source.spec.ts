import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiPatientHubSource, toHubProfile } from './api-patient-hub-source';
import { ProvisionalPatientHubSource } from './provisional-patient-hub';

describe('ApiPatientHubSource', () => {
  let source: ApiPatientHubSource;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [ApiPatientHubSource, ProvisionalPatientHubSource, provideHttpClient(), provideHttpClientTesting()],
    });
    source = TestBed.inject(ApiPatientHubSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('id numérico carrega a identificação de GET /api/v1/pacientes/{id}', async () => {
    const result = source.loadProfile('42');
    const req = http.expectOne('/api/v1/pacientes/42');

    expect(req.request.method).toBe('GET');
    req.flush({
      birthDate: '1980-02-03',
      fullName: 'Fulana de Tal',
      id: 42,
      internacao: { bedNumber: '12', nutritionalTherapyStartDate: '2026-11-10', ward: 'Ala 2' },
    });

    expect(await result).toEqual({
      bed: '12',
      birthDate: '1980-02-03',
      id: '42',
      name: 'Fulana de Tal',
      therapy: null,
      therapyStartDate: '2026-11-10',
      ward: 'Ala 2',
    });
  });

  it('404 devolve null (não encontrado) e outros erros sobem', async () => {
    const missing = source.loadProfile('7');

    http.expectOne('/api/v1/pacientes/7').flush({}, { status: 404, statusText: 'Not Found' });

    expect(await missing).toBeNull();

    const broken = source.loadProfile('8');

    http.expectOne('/api/v1/pacientes/8').flush({}, { status: 500, statusText: 'Server Error' });
    await expectAsync(broken).toBeRejected();
  });

  it('ids de exemplo seguem no provisório, sem chamar a API', async () => {
    expect((await source.loadProfile('p1'))?.id).toBe('p1');
    expect(await source.loadProfile('nao-existe')).toBeNull();
    expect(await source.loadProfile('0')).toBeNull();
    expect(await source.loadHypothesis('p1')).toContain('Insuficiência respiratória');
  });

  it('hipótese de id numérico lê GET diagnostico; 204 = ainda não preenchida', async () => {
    const filled = source.loadHypothesis('42');
    const req = http.expectOne('/api/v1/pacientes/42/diagnostico');

    expect(req.request.method).toBe('GET');
    req.flush({ at: '2026-11-25T10:00:00-03:00', author: 'Dra. X', origin: 'MANUAL', text: 'Pós-operatório' });

    expect(await filled).toBe('Pós-operatório');

    const empty = source.loadHypothesis('43');

    http.expectOne('/api/v1/pacientes/43/diagnostico').flush(null, { status: 204, statusText: 'No Content' });

    expect(await empty).toBeNull();
  });

  it('falha ao ler a hipótese sobe (a tela mantém o que já tem)', async () => {
    const result = source.loadHypothesis('44');

    http.expectOne('/api/v1/pacientes/44/diagnostico').flush({}, { status: 404, statusText: 'Not Found' });
    await expectAsync(result).toBeRejected();
  });
});

describe('toHubProfile', () => {
  it('sem internação: ala e leito vazios, terapia e início nulos; ala cai para a unidade', () => {
    const base = { birthDate: '1980-01-01', fullName: 'A', id: 1 };

    expect(toHubProfile({ ...base, internacao: null })).toEqual(
      jasmine.objectContaining({ bed: '', therapyStartDate: null, ward: '' }),
    );

    expect(toHubProfile(base).ward).toBe('');
    expect(toHubProfile({ ...base, internacao: { unit: 'UTI', ward: ' ' } }).ward).toBe('UTI');
  });
});
