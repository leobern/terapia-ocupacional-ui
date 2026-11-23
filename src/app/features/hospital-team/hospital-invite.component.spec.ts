import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { HospitalInviteComponent } from './hospital-invite.component';
import { managerOnlyGuard } from './hospital-invite.guard';
import { InviteLookup } from './hospital-invite.models';
import { HospitalInvitePort, ManagerAccessReader } from './hospital-invite-port';
import { ProvisionalHospitalInvite, ProvisionalManagerAccess } from './provisional-hospital-invite';

class FakePort extends HospitalInvitePort {
  confirmed: string[] = [];
  failLookup = false;
  failConfirm = false;
  result: InviteLookup = { kind: 'not-registered' };
  approvedRequest = false;

  lookup(): Promise<InviteLookup> {
    return this.failLookup ? Promise.reject(new Error('rede')) : Promise.resolve(this.result);
  }

  confirm(_: number, email: string): Promise<{ approvedRequest: boolean }> {
    if (this.failConfirm) {
      return Promise.reject(new Error('falha'));
    }
    this.confirmed.push(email);

    return Promise.resolve({ approvedRequest: this.approvedRequest });
  }
}

const found = (relation: 'none' | 'pending' | 'approved'): InviteLookup => ({
  kind: 'found',
  profile: { email: 'a@b.com', name: 'Ana', specialty: 'Nutricionista' },
  relation,
});

describe('HospitalInviteComponent', () => {
  let fixture: ComponentFixture<HospitalInviteComponent>;
  let port: FakePort;
  let el: HTMLElement;

  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const text = (): string => el.textContent ?? '';
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes(label));
  const internals = (): { search(): Promise<void>; confirm(): Promise<void> } =>
    fixture.componentInstance as unknown as { search(): Promise<void>; confirm(): Promise<void> };
  const typeEmail = (value: string): void => {
    const input = el.querySelector<HTMLInputElement>('#invite-email') as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const search = async (relationResult: InviteLookup, email = 'a@b.com'): Promise<void> => {
    port.result = relationResult;
    typeEmail(email);
    button('Buscar')?.click();
    await settle();
  };

  beforeEach(async () => {
    port = new FakePort();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: HospitalInvitePort, useValue: port },
        {
          provide: LinkedHospitalsReader,
          useValue: { read: (): Promise<unknown[]> => Promise.resolve([{ id: 1, name: 'Hospital Central' }]) },
        },
      ],
    });
    await TestBed.inject(HospitalContextService).load();
    TestBed.inject(ConnectivityService).online.set(true);
    fixture = TestBed.createComponent(HospitalInviteComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('mostra o perfil declarado para conferência', async () => {
    await search(found('none'));

    expect(text()).toContain('Nutricionista');
    expect(text()).toContain('Confira o perfil declarado');
    expect(button('Confirmar convite')).toBeDefined();
  });

  it('e-mail sem cadastro informa que precisa se cadastrar e não oferece confirmação', async () => {
    await search({ kind: 'not-registered' });

    expect(text()).toContain('precisa se cadastrar primeiro');
    expect(button('Confirmar convite')).toBeUndefined();
  });

  it('não cria vínculo sem confirmação; cancelar descarta o convite', async () => {
    await search(found('none'));
    button('Cancelar')?.click();
    await settle();

    expect(port.confirmed).toEqual([]);
    expect(button('Confirmar convite')).toBeUndefined();
    expect(el.querySelector<HTMLInputElement>('#invite-email')?.value).toBe('');
  });

  it('confirmar mostra sucesso só após o servidor responder', async () => {
    await search(found('none'));
    button('Confirmar convite')?.click();
    await settle();

    expect(port.confirmed).toEqual(['a@b.com']);
    expect(text()).toContain('Convidar outro profissional');
    expect(text()).toContain('Convite concluído');
    expect(text()).toContain('Ana');

    button('Convidar outro profissional')?.click();
    await settle();

    expect(el.querySelector('#invite-email')).not.toBeNull();
  });

  it('falha ao confirmar mostra erro e mantém a conferência', async () => {
    await search(found('none'));
    port.failConfirm = true;
    button('Confirmar convite')?.click();
    await settle();

    expect(text()).toContain('Nenhum vínculo foi criado');
    expect(button('Confirmar convite')).toBeDefined();
  });

  it('falha na busca mostra erro com texto', async () => {
    port.failLookup = true;
    typeEmail('a@b.com');
    button('Buscar')?.click();
    await settle();

    expect(text()).toContain('Não foi possível buscar');
  });

  it('vínculo já aprovado bloqueia o convite', async () => {
    await search(found('approved'));

    expect(text()).toContain('Já existe vínculo aprovado');
    expect(button('Confirmar convite')).toBeUndefined();
  });

  it('solicitação pendente é indicada e o convite a aprova', async () => {
    port.approvedRequest = true;
    await search(found('pending'));

    expect(text()).toContain('aguardando aprovação');
    button('Confirmar convite')?.click();
    await settle();

    expect(text()).toContain('Solicitação aprovada');
  });

  it('sem conexão informa e não busca', async () => {
    TestBed.inject(ConnectivityService).online.set(false);
    typeEmail('a@b.com');
    fixture.detectChanges();

    expect(text()).toContain('Sem conexão');
    expect(button('Buscar')?.disabled).toBeTrue();
    await internals().search();

    expect(el.querySelector('dl')).toBeNull();
  });

  it('sem e-mail não permite buscar e Enter busca', async () => {
    expect(button('Buscar')?.disabled).toBeTrue();
    port.result = found('none');
    typeEmail('a@b.com');
    el.querySelector('#invite-email')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();

    expect(el.querySelector('dl')).not.toBeNull();
  });

  it('voltar usa o histórico', () => {
    const location = TestBed.inject(Location);

    spyOn(location, 'back');

    el.querySelector<HTMLButtonElement>('app-icon-button button')?.click();

    expect(location.back).toHaveBeenCalledWith();
  });

  it('confirm/search sem pré-condição não fazem nada', async () => {
    await internals().confirm();

    expect(port.confirmed).toEqual([]);
  });
});

describe('ProvisionalHospitalInvite e guarda de gestor', () => {
  const provisional = new ProvisionalHospitalInvite();

  it('busca conhecida, desconhecida e confirmação com solicitação pendente', async () => {
    expect(await provisional.lookup(1, 'nada@x.com')).toEqual({ kind: 'not-registered' });
    const none = await provisional.lookup(1, ' Filippa@conductia.com ');

    expect(none.kind === 'found' && none.relation).toBe('none');
    expect(await provisional.confirm(1, 'filippa@conductia.com')).toEqual({ approvedRequest: false });
    expect(await provisional.confirm(1, 'jairo@conductia.com')).toEqual({ approvedRequest: true });
    await expectAsync(provisional.confirm(1, 'jairo@conductia.com')).toBeRejected();
    await expectAsync(provisional.confirm(1, 'nada@x.com')).toBeRejected();

    expect(new ProvisionalManagerAccess().isManager()).toBeTrue();
  });

  it('guarda: gestor passa; outros perfis vão para a Home', () => {
    let manager = false;

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ManagerAccessReader, useValue: { isManager: (): boolean => manager } }],
    });
    const run = (): unknown => TestBed.runInInjectionContext(() => managerOnlyGuard({} as never, {} as never));

    manager = true;

    expect(run()).toBeTrue();
    manager = false;

    expect(TestBed.inject(Router).serializeUrl(run() as never)).toBe('/home');
  });
});
