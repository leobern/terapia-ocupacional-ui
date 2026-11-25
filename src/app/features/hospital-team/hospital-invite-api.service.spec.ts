import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { HospitalInviteApiService } from './hospital-invite-api.service';

const BASE = `${environment.apiBaseUrl}/v1/hospitais/1`;
const PROFILE = {
  email: 'filippa@conductia.com',
  nomeCompleto: 'Filippa Exemplo',
  perfilDeclarado: 'TERAPEUTA',
  relacao: 'PENDENTE',
  usuarioId: 9,
};

describe('HospitalInviteApiService', () => {
  let service: HospitalInviteApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HospitalInviteApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HospitalInviteApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const lookupRequest = (): ReturnType<HttpTestingController['expectOne']> =>
    http.expectOne(request => request.url === `${BASE}/profissionais`);

  it('200: busca por e-mail e devolve usuarioId, perfil declarado e relação', async () => {
    const promise = service.lookup(1, ' filippa@conductia.com ');
    const request = lookupRequest();

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('email')).toBe('filippa@conductia.com');
    request.flush(PROFILE);

    expect(await promise).toEqual({
      kind: 'found',
      profile: {
        email: 'filippa@conductia.com',
        nomeCompleto: 'Filippa Exemplo',
        perfilDeclarado: 'Terapeuta',
        usuarioId: 9,
      },
      relation: 'pending',
    });
  });

  it('mapeia relações NENHUMA e APROVADO', async () => {
    const none = service.lookup(1, 'a@b.com');

    lookupRequest().flush({ ...PROFILE, relacao: 'NENHUMA' });

    expect(await none).toEqual(jasmine.objectContaining({ relation: 'none' }));

    const approved = service.lookup(1, 'a@b.com');

    lookupRequest().flush({ ...PROFILE, perfilDeclarado: 'RECECIONISTA', relacao: 'APROVADO' });

    expect(await approved).toEqual(
      jasmine.objectContaining({
        profile: jasmine.objectContaining({ perfilDeclarado: 'Recepcionista' }),
        relation: 'approved',
      }),
    );
  });

  it('404 de conta sem cadastro vira "not-registered"', async () => {
    const promise = service.lookup(1, 'x@y.com');

    lookupRequest().flush(
      { message: 'O profissional não possui cadastro no Conductia e precisa se cadastrar primeiro' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(await promise).toEqual({ kind: 'not-registered' });
  });

  for (const status of [400, 401, 403, 404]) {
    it(`${status} que não é conta sem cadastro é repassado como erro HTTP`, async () => {
      const promise = service.lookup(1, 'x@y.com');

      lookupRequest().flush({ message: 'Hospital não encontrado' }, { status, statusText: 'err' });

      await expectAsync(promise).toBeRejectedWith(jasmine.any(HttpErrorResponse));
      await expectAsync(promise).toBeRejectedWith(jasmine.objectContaining({ status }));
    });
  }

  it('201: confirma enviando usuarioId e perfilConfirmado e devolve aproveitouSolicitacao', async () => {
    const promise = service.confirm(1, 9);
    const post = http.expectOne(`${BASE}/convites`);

    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ perfilConfirmado: true, usuarioId: 9 });
    post.flush(
      { aproveitouSolicitacao: true, hospitalId: 1, id: 3, origem: 'SOLICITACAO', status: 'APROVADO', usuarioId: 9 },
      { status: 201, statusText: 'Created' },
    );

    expect(await promise).toEqual({ aproveitouSolicitacao: true });
  });

  for (const status of [400, 401, 403, 404, 409]) {
    it(`confirmar: ${status} rejeita com o erro HTTP`, async () => {
      const promise = service.confirm(1, 9);

      http.expectOne(`${BASE}/convites`).flush({ message: 'x' }, { status, statusText: 'err' });

      await expectAsync(promise).toBeRejectedWith(jasmine.objectContaining({ status }));
    });
  }

  it('rejeita identificadores inválidos sem chamar a API', async () => {
    await expectAsync(service.lookup(Number.NaN, 'x@y.com')).toBeRejected();
    await expectAsync(service.confirm(1, Number.NaN)).toBeRejected();
    http.expectNone(() => true);
  });
});
