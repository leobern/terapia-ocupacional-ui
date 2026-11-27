import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { AcceptInviteComponent } from './accept-invite.component';
import { AcceptInviteResult, InviteGateway } from './invite-gateway';

class FakeGateway extends InviteGateway {
  accept!: jasmine.Spy<(token: string, fullName: string, password: string) => Promise<AcceptInviteResult>>;
}

describe('AcceptInviteComponent', () => {
  let gateway: FakeGateway;
  let navigate: jasmine.Spy;
  let fixture: ComponentFixture<AcceptInviteComponent>;
  let el: HTMLElement;
  let token: string | null;

  beforeEach(() => {
    token = 'conv-1';
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    gateway = new FakeGateway();
    gateway.accept = jasmine.createSpy('accept').and.resolveTo('ok');
    TestBed.configureTestingModule({
      imports: [AcceptInviteComponent],
      providers: [
        provideRouter([]),
        { provide: InviteGateway, useValue: gateway },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (): string | null => token } } } },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  function open(withToken: string | null = 'conv-1'): void {
    token = withToken;
    fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const submitButton = (): HTMLButtonElement => el.querySelector('button[type="submit"]') as HTMLButtonElement;

  async function fillAndSubmit(name: string, password: string, confirmation: string): Promise<void> {
    const nameInput = el.querySelector('#invite-name') as HTMLInputElement;
    const pw = el.querySelector('#invite-password') as HTMLInputElement;
    const conf = el.querySelector('#invite-confirmation') as HTMLInputElement;

    nameInput.value = name;
    nameInput.dispatchEvent(new Event('input'));
    pw.value = password;
    pw.dispatchEvent(new Event('input'));
    conf.value = confirmation;
    conf.dispatchEvent(new Event('input'));
    submitButton().click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('mostra o formulário com nome da marca, nome e duas senhas (Figma 06)', () => {
    open();

    expect(el.querySelector('.auth-shell__brand')?.textContent).toBe('Conductia');
    expect(el.textContent).toContain('Boas-vindas');
    expect(el.querySelectorAll('input').length).toBe(3);
    expect(el.querySelectorAll('.auth-field__toggle').length).toBe(2);
    expect(el.textContent).toContain('Já tenho conta');
  });

  it('cria a conta e volta ao login com o aviso', async () => {
    open();
    await fillAndSubmit(' Ana Silva ', 'Senha12345', 'Senha12345');

    expect(gateway.accept).toHaveBeenCalledOnceWith('conv-1', 'Ana Silva', 'Senha12345');
    expect(navigate).toHaveBeenCalledWith('/login', {
      replaceUrl: true,
      state: { notice: 'Conta criada. Entre com seu e-mail e senha.' },
    });
  });

  it('e-mail que já tem conta volta ao login com outro aviso', async () => {
    open();
    gateway.accept.and.resolveTo('already-registered');
    await fillAndSubmit('Ana', 'Senha12345', 'Senha12345');

    expect(navigate).toHaveBeenCalledWith('/login', {
      replaceUrl: true,
      state: { notice: 'Este e-mail já tem conta. Entre com sua senha.' },
    });
  });

  it('valida nome, política de senha e confirmação sem chamar o serviço', async () => {
    open();
    await fillAndSubmit('  ', '!!!', 'outra');

    expect(gateway.accept).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Informe seu nome completo');
    expect(el.textContent).toContain('10 caracteres');
    expect(el.textContent).toContain('não coincidem');
  });

  it('token recusado mostra convite inválido', async () => {
    open();
    gateway.accept.and.resolveTo('invalid-token');
    await fillAndSubmit('Ana', 'Senha12345', 'Senha12345');

    expect(el.textContent).toContain('Convite inválido');
    expect(el.querySelector('input')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sem token mostra convite inválido e o botão leva ao login', () => {
    open(null);

    expect(el.textContent).toContain('Convite inválido');
    el.querySelector('button')?.click();

    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('falha de serviço mostra aviso, mantém os valores e permite tentar de novo', async () => {
    open();
    gateway.accept.and.rejectWith(new Error('offline'));
    await fillAndSubmit('Ana', 'Senha12345', 'Senha12345');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível criar a conta');
    expect((el.querySelector('#invite-name') as HTMLInputElement).value).toBe('Ana');
    expect(submitButton().textContent).toContain('Tentar novamente');

    gateway.accept.and.resolveTo('ok');
    submitButton().click();
    await fixture.whenStable();

    expect(gateway.accept).toHaveBeenCalledTimes(2);
  });

  it('não envia duas vezes enquanto envia', async () => {
    open();
    gateway.accept.and.returnValue(new Promise(() => undefined));
    await fillAndSubmit('Ana', 'Senha12345', 'Senha12345');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(gateway.accept).toHaveBeenCalledTimes(1);
    expect(submitButton().disabled).toBeTrue();
  });
});
