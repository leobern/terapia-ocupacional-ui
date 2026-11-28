import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { ApiSpy, createApiSpy } from './administration.testing';
import { AdministrationApi } from './administration-api';
import { InvitePanelComponent } from './invite-panel.component';

describe('InvitePanelComponent', () => {
  let api: ApiSpy;
  let fixture: ComponentFixture<InvitePanelComponent>;
  let el: HTMLElement;

  function setup(role: Role): void {
    api = createApiSpy();
    TestBed.configureTestingModule({
      imports: [InvitePanelComponent],
      providers: [
        { provide: AdministrationApi, useValue: api },
        { provide: SessionRoleReader, useValue: { read: (): Role => role } },
      ],
    });
    fixture = TestBed.createComponent(InvitePanelComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function fill(email: string): void {
    const input = el.querySelector('#invite-email') as HTMLInputElement;

    input.value = email;
    input.dispatchEvent(new Event('input'));
    (el.querySelector('.invite__check input') as HTMLInputElement).click();
    fixture.detectChanges();
  }

  const button = (label: string): HTMLElement =>
    Array.from(el.querySelectorAll('app-button')).find(b => b.textContent?.includes(label)) as HTMLElement;
  const chips = (): string[] => Array.from(el.querySelectorAll('.invite__chip')).map(c => c.textContent?.trim() ?? '');

  it('ADMIN vê todos os papéis e só os hospitais ativos', async () => {
    setup(Role.ADMIN);
    await settle();

    expect(chips()).toEqual(['Administrador', 'Gestor', 'Médico', 'Recepcionista', 'Terapeuta']);
    expect(el.querySelectorAll('.invite__check').length).toBe(1);
  });

  it('GESTOR não oferece Administrador nem Gestor', async () => {
    setup(Role.GESTOR);
    await settle();

    expect(chips()).toEqual(['Médico', 'Recepcionista', 'Terapeuta']);
  });

  it('só habilita o envio com e-mail válido e um hospital', async () => {
    setup(Role.ADMIN);
    await settle();

    expect(button('Enviar convite').querySelector('button')?.disabled).toBeTrue();
    fill('novo@hsl.org');

    expect(button('Enviar convite').querySelector('button')?.disabled).toBeFalse();
  });

  it('envia o convite e mostra o link copiável', async () => {
    setup(Role.ADMIN);
    await settle();
    fill('novo@hsl.org');
    (
      Array.from(el.querySelectorAll('.invite__chip')).find(c => c.textContent?.includes('Gestor')) as HTMLElement
    ).click();
    button('Enviar convite').querySelector('button')?.click();
    await settle();

    expect(api.invite).toHaveBeenCalledWith({
      email: 'novo@hsl.org',
      hospitalIds: [1],
      papel: 'GESTOR',
      papelHospital: 'GESTOR',
    });

    expect(el.querySelector('[data-testid="invite-link"]')?.textContent).toContain('token=abc');
  });

  it('copia o link e permite convidar outra pessoa', async () => {
    setup(Role.ADMIN);
    const copy = spyOn(navigator.clipboard, 'writeText').and.resolveTo();

    await settle();
    fill('novo@hsl.org');
    button('Enviar convite').querySelector('button')?.click();
    await settle();
    button('Copiar link').querySelector('button')?.click();
    await settle();

    expect(copy).toHaveBeenCalledWith('https://x/invite?token=abc');
    expect(button('Link copiado')).toBeDefined();

    button('Convidar outra pessoa').querySelector('button')?.click();
    await settle();

    expect(el.querySelector('#invite-email')).not.toBeNull();
  });

  it('quem já tinha conta só ganha o vínculo (sem link)', async () => {
    setup(Role.ADMIN);
    api.invite.and.resolveTo({
      email: 'rafael@hsl.org',
      emailEnviado: false,
      expiraEm: null,
      id: null,
      link: null,
      papel: 'MEDICO',
      vinculoDireto: true,
    });
    await settle();
    fill('rafael@hsl.org');
    button('Enviar convite').querySelector('button')?.click();
    await settle();

    expect(el.textContent).toContain('já tinha conta');
    expect(el.querySelector('[data-testid="invite-link"]')).toBeNull();
  });

  for (const [status, text] of [
    [409, 'convite pendente'],
    [403, 'não pode convidar'],
    [500, 'Não foi possível enviar'],
  ] as const) {
    it(`mostra o erro do HTTP ${status}`, async () => {
      setup(Role.ADMIN);
      api.invite.and.rejectWith({ status });
      await settle();
      fill('novo@hsl.org');
      button('Enviar convite').querySelector('button')?.click();
      await settle();

      expect(el.querySelector('[role="alert"]')?.textContent).toContain(text);
    });
  }

  it('avisa quando os hospitais não carregam e não envia sem estar válido', async () => {
    setup(Role.ADMIN);
    api.listHospitals.and.rejectWith(new Error('x'));
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('carregar os hospitais');
    button('Enviar convite').querySelector('button')?.click();

    expect(api.invite).not.toHaveBeenCalled();
  });

  it('não envia sem e-mail e hospital', async () => {
    setup(Role.ADMIN);
    await settle();
    await fixture.componentInstance.submit();

    expect(api.invite).not.toHaveBeenCalled();
  });

  it('marca e desmarca o hospital e fecha pelo Cancelar', async () => {
    setup(Role.ADMIN);
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    await settle();
    const box = el.querySelector('.invite__check input') as HTMLInputElement;

    box.click();
    box.click();
    fixture.detectChanges();

    expect(box.checked).toBeFalse();
    button('Cancelar').querySelector('button')?.click();

    expect(closed).toHaveBeenCalledWith(undefined);
  });
});
