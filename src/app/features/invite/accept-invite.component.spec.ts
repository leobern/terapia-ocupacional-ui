import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { AcceptInviteComponent } from './accept-invite.component';
import { AcceptInviteResult, InviteGateway, InvitePhoto, InviteSummary } from './invite-gateway';

class FakeGateway extends InviteGateway {
  check!: jasmine.Spy<(token: string) => Promise<InviteSummary | null>>;
  accept!: jasmine.Spy<
    (token: string, fullName: string, password: string, photo?: InvitePhoto) => Promise<AcceptInviteResult>
  >;
}

describe('AcceptInviteComponent (cadastro por conversa)', () => {
  let gateway: FakeGateway;
  let navigate: jasmine.Spy;
  let fixture: ComponentFixture<AcceptInviteComponent>;
  let el: HTMLElement;
  let token: string | null;

  beforeEach(() => {
    token = 'conv-1';
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    gateway = new FakeGateway();
    gateway.check = jasmine
      .createSpy('check')
      .and.resolveTo({ email: 'ana@hsl.org', hospitals: ['Hospital A', 'Hospital B'], role: 'MEDICO' });
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

  async function open(withToken: string | null = 'conv-1'): Promise<void> {
    token = withToken;
    fixture = TestBed.createComponent(AcceptInviteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const input = el.querySelector(selector) as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const submit = (): HTMLButtonElement => el.querySelector('button[type="submit"]') as HTMLButtonElement;
  const text = (): string => el.textContent ?? '';

  async function answerName(name = 'Ana Silva'): Promise<void> {
    type('#invite-name', name);
    submit().click();
    await settle();
  }

  async function skipPhoto(): Promise<void> {
    (
      Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Pular')) as HTMLButtonElement
    ).click();
    await settle();
  }

  async function answerPassword(password = 'Senha-Forte-2026'): Promise<void> {
    type('#invite-password', password);
    submit().click();
    await settle();
  }

  it('apresenta o convite (papel e hospitais) e pergunta o nome', async () => {
    await open();

    expect(gateway.check).toHaveBeenCalledWith('conv-1');
    expect(text()).toContain('como médico em Hospital A, Hospital B');
    expect(text()).toContain('Como você se chama?');
    expect(el.querySelector('#invite-name')).not.toBeNull();
  });

  it('sem papel conhecido nem hospitais ainda apresenta o convite', async () => {
    gateway.check.and.resolveTo({ email: 'x@y.com', hospitals: [], role: 'OUTRO' });
    await open();

    expect(text()).toContain('como outro.');
  });

  it('exige o nome antes de seguir', async () => {
    await open();
    await answerName('   ');

    expect(text()).toContain('Conte o seu nome completo');
    expect(el.querySelector('#invite-name')).not.toBeNull();
  });

  it('percorre nome, foto (pular), senha e confirmação e cria a conta', async () => {
    await open();
    await answerName();

    expect(text()).toContain('Prazer, Ana!');
    await skipPhoto();

    expect(text()).toContain('crie uma senha'.replace('c', 'C') && 'Agora crie uma senha');
    await answerPassword();
    type('#invite-confirmation', 'Senha-Forte-2026');
    submit().click();
    await settle();

    expect(gateway.accept).toHaveBeenCalledWith('conv-1', 'Ana Silva', 'Senha-Forte-2026', undefined);
    expect(navigate).toHaveBeenCalledWith('/login', jasmine.objectContaining({ replaceUrl: true }));
  });

  it('rejeita senha fraca e senhas diferentes', async () => {
    await open();
    await answerName();
    await skipPhoto();
    await answerPassword('curta');

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    await answerPassword();
    type('#invite-confirmation', 'outra-coisa-123');
    submit().click();
    await settle();

    expect(gateway.accept).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('envia a foto escolhida junto com o aceite', async () => {
    await open();
    await answerName();
    const file = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' });
    const input = el.querySelector('[data-testid="invite-photo"]') as HTMLInputElement;
    const transfer = new DataTransfer();

    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    await new Promise(resolve => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(el.querySelector('.chat__preview')).not.toBeNull();
    (
      Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Continuar')) as HTMLButtonElement
    ).click();
    await settle();
    await answerPassword();
    type('#invite-confirmation', 'Senha-Forte-2026');
    submit().click();
    await settle();

    expect(gateway.accept.calls.mostRecent().args[3]).toEqual({ base64: jasmine.any(String), type: 'image/png' });
  });

  it('recusa foto de tipo ou tamanho inválido', async () => {
    await open();
    await answerName();
    const input = el.querySelector('[data-testid="invite-photo"]') as HTMLInputElement;
    const send = async (file: File): Promise<void> => {
      const transfer = new DataTransfer();

      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      await new Promise(resolve => setTimeout(resolve, 20));
      fixture.detectChanges();
    };

    await send(new File(['x'], 'a.gif', { type: 'image/gif' }));

    expect(text()).toContain('JPEG, PNG ou WebP');
    await send(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }));

    expect(text()).toContain('até 2 MB');
  });

  it('ignora o evento de arquivo sem arquivo', async () => {
    await open();
    await answerName();
    (el.querySelector('[data-testid="invite-photo"]') as HTMLInputElement).dispatchEvent(new Event('change'));

    expect(el.querySelector('.chat__preview')).toBeNull();
  });

  it('mostra "convite inválido" sem token', async () => {
    await open(null);

    expect(gateway.check).not.toHaveBeenCalled();
    expect(text()).toContain('Ir para o login');
  });

  it('mostra "convite inválido" quando o servidor recusa o token', async () => {
    gateway.check.and.resolveTo(null);
    await open();

    expect(text()).toContain('Ir para o login');
  });

  it('mostra "convite inválido" quando o aceite recusa o token', async () => {
    gateway.accept.and.resolveTo('invalid-token');
    await open();
    await answerName();
    await skipPhoto();
    await answerPassword();
    type('#invite-confirmation', 'Senha-Forte-2026');
    submit().click();
    await settle();

    expect(text()).toContain('Ir para o login');
  });

  it('avisa quando o convite não abre por falha de rede', async () => {
    gateway.check.and.rejectWith(new Error('rede'));
    await open();

    expect(text()).toContain('Não foi possível abrir o convite');
  });

  it('volta à confirmação quando o aceite falha por rede', async () => {
    gateway.accept.and.rejectWith(new Error('rede'));
    await open();
    await answerName();
    await skipPhoto();
    await answerPassword();
    type('#invite-confirmation', 'Senha-Forte-2026');
    submit().click();
    await settle();

    expect(text()).toContain('Não foi possível criar a conta agora');
    expect(el.querySelector('#invite-confirmation')).not.toBeNull();
  });

  it('conta já existente segue para o login com o aviso', async () => {
    gateway.accept.and.resolveTo('already-registered');
    await open();
    await answerName();
    await skipPhoto();
    await answerPassword();
    type('#invite-confirmation', 'Senha-Forte-2026');
    submit().click();
    await settle();

    expect(navigate).toHaveBeenCalledWith('/login', jasmine.objectContaining({ replaceUrl: true }));
  });

  it('"Voltar ao login" navega para o login', async () => {
    await open(null);
    (
      Array.from(el.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Ir para o login'),
      ) as HTMLButtonElement
    ).click();

    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });
});
