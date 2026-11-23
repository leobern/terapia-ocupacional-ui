import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HttpHospitalInvite } from './http-hospital-invite';

const PROFILE = {
  email: 'filippa@conductia.com',
  nomeCompleto: 'Filippa Exemplo',
  perfilDeclarado: 'TERAPEUTA',
  relacao: 'PENDENTE',
  usuarioId: 9,
};

describe('HttpHospitalInvite', () => {
  let invite: HttpHospitalInvite;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpHospitalInvite, provideHttpClient(), provideHttpClientTesting()],
    });
    invite = TestBed.inject(HttpHospitalInvite);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  const profileRequest = (): ReturnType<HttpTestingController['expectOne']> =>
    controller.expectOne(request => request.url === '/api/v1/hospitais/1/profissionais');

  it('busca por e-mail e devolve o perfil declarado e a relação', async () => {
    const promise = invite.lookup(1, ' filippa@conductia.com ');
    const request = profileRequest();

    expect(request.request.params.get('email')).toBe('filippa@conductia.com');
    request.flush(PROFILE);

    expect(await promise).toEqual({
      kind: 'found',
      profile: { email: 'filippa@conductia.com', name: 'Filippa Exemplo', specialty: 'Terapeuta' },
      relation: 'pending',
    });
  });

  it('usa o próprio papel quando não há rótulo para ele', async () => {
    const promise = invite.lookup(1, 'x@y.com');

    profileRequest().flush({ ...PROFILE, perfilDeclarado: 'OUTRO', relacao: 'NENHUMA' });

    expect(await promise).toEqual(
      jasmine.objectContaining({ profile: jasmine.objectContaining({ specialty: 'OUTRO' }) }),
    );
  });

  it('404 de conta inexistente vira "not-registered"', async () => {
    const promise = invite.lookup(1, 'x@y.com');

    profileRequest().flush(
      { message: 'O profissional precisa se cadastrar primeiro' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(await promise).toEqual({ kind: 'not-registered' });
  });

  it('outros erros (ex.: hospital inexistente) são repassados', async () => {
    const promise = invite.lookup(1, 'x@y.com');

    profileRequest().flush({ message: 'Hospital não encontrado' }, { status: 404, statusText: 'Not Found' });

    await expectAsync(promise).toBeRejected();
  });

  it('confirma o convite: localiza a conta e cria o vínculo', async () => {
    const promise = invite.confirm(1, 'filippa@conductia.com');

    profileRequest().flush(PROFILE);
    await Promise.resolve();
    await Promise.resolve();
    const post = controller.expectOne('/api/v1/hospitais/1/convites');

    expect(post.request.body).toEqual({ perfilConfirmado: true, usuarioId: 9 });
    post.flush({ aproveitouSolicitacao: true });

    expect(await promise).toEqual({ approvedRequest: true });
  });

  it('rejeita hospital que não é numérico, sem chamar a API', async () => {
    await expectAsync(invite.lookup(Number.NaN, 'x@y.com')).toBeRejected();
  });
});
