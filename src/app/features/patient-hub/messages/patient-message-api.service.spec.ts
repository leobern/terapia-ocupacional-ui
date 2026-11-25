import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { asPatientApiId } from './patient-api-id';
import { PatientMessageApiService, PatientTeamApiService } from './patient-message-api.service';

const base = {
  at: '2026-11-25T10:00:00.000Z',
  author: 'Ana',
  content: 'SNE exteriorizada',
  patientId: '7',
  recipients: [],
  viaAudio: false,
};

const CREATED = {
  author: { id: 1, name: 'Ana', specialty: 'Médica' },
  content: 'SNE exteriorizada',
  createdAt: '2026-11-25T10:00:01Z',
  id: 90,
  kind: 'MENSAGEM',
  resolvedRecipients: [{ id: 5, name: 'Almira', specialty: 'Enfermeira' }],
};

describe('PatientMessageApiService', () => {
  let http: HttpTestingController;
  let service: PatientMessageApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PatientMessageApiService],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PatientMessageApiService);
  });

  it('envia os destinatários confirmados e mapeia o registro criado', async () => {
    const done = service.send({ ...base, recipientSpecs: [{ professionalId: 5, type: 'PESSOA' }] });
    const req = http.expectOne(r => r.url.endsWith('/v1/pacientes/7/mensagens'));

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      content: 'SNE exteriorizada',
      destinatarios: [{ professionalId: 5, type: 'PESSOA' }],
    });
    req.flush(CREATED);

    expect(await done).toEqual({
      at: '2026-11-25T10:00:01Z',
      author: 'Ana',
      content: 'SNE exteriorizada',
      id: '90',
      patientId: '7',
      recipients: [{ id: 5, name: 'Almira', specialty: 'Enfermeira' }],
      viaAudio: false,
    });

    expect((await service.list('7')).map(r => r.id)).toEqual(['90']);
    expect(await service.list('8')).toEqual([]);
  });

  it('sem destinatário confirmado manda lista vazia (observação) e usa os recipients quando não há specs', async () => {
    const done = service.send(base);
    const req = http.expectOne(r => r.url.endsWith('/mensagens'));

    expect(req.request.body.destinatarios).toEqual([]);
    req.flush({ ...CREATED, kind: 'OBSERVACAO', resolvedRecipients: undefined });

    expect((await done).recipients).toEqual([]);

    const second = service.send({ ...base, recipients: [{ id: 5, name: 'Almira', specialty: 'Enfermeira' }] });
    const req2 = http.expectOne(r => r.url.endsWith('/mensagens'));

    expect(req2.request.body.destinatarios).toEqual([{ professionalId: 5, type: 'PESSOA' }]);
    req2.flush(CREATED);
    await second;

    expect((await service.list('7')).length).toBe(2);
  });

  it('id de paciente que não é número não chega à API', async () => {
    await expectAsync(service.send({ ...base, patientId: 'p1' })).toBeRejected();
    http.verify();
  });

  it('asPatientApiId aceita só inteiro positivo', () => {
    expect(asPatientApiId('12')).toBe(12);
    expect(() => asPatientApiId('0')).toThrow();
    expect(() => asPatientApiId('1.5')).toThrow();
  });
});

describe('PatientTeamApiService', () => {
  let http: HttpTestingController;
  let service: PatientTeamApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PatientTeamApiService],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PatientTeamApiService);
  });

  it('resolve TODOS e deduz o grupo pela especialidade', async () => {
    const done = service.listLinked('7');
    const req = http.expectOne(r => r.url.endsWith('/v1/pacientes/7/mensagens/destinatarios/resolver'));

    expect(req.request.body).toEqual({ recipients: [{ type: 'TODOS' }] });
    req.flush({
      professionals: [
        { id: 2, name: 'Filippa', specialty: 'Nutricionista' },
        { id: 4, name: 'Michelle', specialty: 'Nutróloga' },
        { id: 5, name: 'Almira', specialty: 'Enfermeira' },
        { id: 9, name: 'Zé', specialty: 'Outra' },
      ],
    });

    expect((await done).map(p => p.group)).toEqual(['nutritionists', 'doctors', 'nurses', null]);
  });

  it('422 é equipe vazia; outro erro é propagado', async () => {
    const empty = service.listLinked('7');

    http.expectOne(() => true).flush({ message: 'x' }, { status: 422, statusText: 'Unprocessable' });

    expect(await empty).toEqual([]);

    const failed = service.listLinked('7');

    http.expectOne(() => true).flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    await expectAsync(failed).toBeRejected();
  });
});
