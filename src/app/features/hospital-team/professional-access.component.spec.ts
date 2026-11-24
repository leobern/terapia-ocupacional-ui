import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { ProfessionalAccessComponent } from './professional-access.component';
import { HospitalProfessional } from './professional-access.models';
import { ProfessionalAccessRevoker, ProfessionalAccessSource } from './professional-access-port';
import {
  ProvisionalHttpError,
  ProvisionalProfessionalAccess,
  ProvisionalProfessionalRevoker,
} from './provisional-professional-access';

class FakeSource extends ProfessionalAccessSource {
  fail = false;
  items: HospitalProfessional[] = [
    { id: 1, name: 'Ana Souza', specialty: 'Nutricionista', status: 'approved' },
    { id: 2, name: 'Bia Lima', specialty: 'Enfermeira', status: 'approved' },
  ];

  list(): Promise<readonly HospitalProfessional[]> {
    return this.fail ? Promise.reject(new Error('rede')) : Promise.resolve(this.items);
  }
}

class FakeRevoker extends ProfessionalAccessRevoker {
  revoked: number[] = [];
  failure: unknown = null;

  revoke(_: number, id: number): Promise<void> {
    if (this.failure !== null) {
      return Promise.reject(this.failure);
    }
    this.revoked.push(id);

    return Promise.resolve();
  }
}

describe('ProfessionalAccessComponent', () => {
  let fixture: ComponentFixture<ProfessionalAccessComponent>;
  let source: FakeSource;
  let revoker: FakeRevoker;
  let el: HTMLElement;

  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const text = (): string => el.textContent ?? '';
  const buttons = (label: string): HTMLButtonElement[] =>
    Array.from(el.querySelectorAll('button')).filter(b => b.textContent?.trim() === label);
  const create = async (): Promise<void> => {
    fixture = TestBed.createComponent(ProfessionalAccessComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    await settle();
  };
  const internals = (): { confirmRevoke(): Promise<void>; askRevoke(p: HospitalProfessional): void } =>
    fixture.componentInstance as unknown as {
      confirmRevoke(): Promise<void>;
      askRevoke(p: HospitalProfessional): void;
    };

  beforeEach(async () => {
    source = new FakeSource();
    revoker = new FakeRevoker();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProfessionalAccessSource, useValue: source },
        { provide: ProfessionalAccessRevoker, useValue: revoker },
        {
          provide: LinkedHospitalsReader,
          useValue: { read: (): Promise<unknown[]> => Promise.resolve([{ id: 1, name: 'Hospital Central' }]) },
        },
      ],
    });
    await TestBed.inject(HospitalContextService).load();
    TestBed.inject(ConnectivityService).online.set(true);
  });

  it('lista profissionais aprovados com nome, especialidade e status em texto', async () => {
    await create();

    expect(text()).toContain('Hospital Central');
    expect(text()).toContain('Ana Souza');
    expect(text()).toContain('Nutricionista');
    expect(text()).toContain('Status: Aprovado');
    expect(buttons('Revogar').length).toBe(2);
  });

  it('cancelar a confirmação não altera nada', async () => {
    await create();
    buttons('Revogar')[0].click();
    await settle();

    expect(text()).toContain('Revogar acesso?');
    expect(text()).toContain('Ana Souza perderá o acesso');
    buttons('Cancelar')[0].click();
    await settle();

    expect(revoker.revoked).toEqual([]);
    expect(text()).not.toContain('Revogar acesso?');
    expect(text()).toContain('Status: Aprovado');
  });

  it('confirmar revoga e mostra "Revogado" sem recarregar, sem oferecer a ação', async () => {
    await create();
    buttons('Revogar')[0].click();
    await settle();
    buttons('Revogar').at(-1)?.click();
    await settle();

    expect(revoker.revoked).toEqual([1]);
    expect(text()).toContain('Status: Revogado');
    expect(buttons('Revogar').length).toBe(1);
  });

  it('falha de rede mantém o estado e mostra mensagem', async () => {
    await create();
    revoker.failure = new Error('rede');
    buttons('Revogar')[0].click();
    await settle();
    buttons('Revogar').at(-1)?.click();
    await settle();

    expect(text()).toContain('Nada foi alterado');
    expect(text()).not.toContain('Revogado');
  });

  for (const [status, message] of [
    [401, 'sessão expirou'],
    [403, 'não tem permissão'],
    [404, 'não encontrado'],
    [409, 'não está mais aprovado'],
  ] as const) {
    it(`erro ${status} mostra a mensagem correspondente`, async () => {
      await create();
      revoker.failure = new ProvisionalHttpError(status);
      buttons('Revogar')[0].click();
      await settle();
      buttons('Revogar').at(-1)?.click();
      await settle();

      expect(text()).toContain(message);
      expect(text().includes('Status: Revogado')).toBe(status === 409);
    });
  }

  it('offline desabilita a ação com aviso e não revoga', async () => {
    await create();
    TestBed.inject(ConnectivityService).online.set(false);
    fixture.detectChanges();

    expect(text()).toContain('Sem conexão');
    expect(buttons('Revogar')[0].disabled).toBeTrue();
    internals().askRevoke(source.items[0]);
    await internals().confirmRevoke();

    expect(revoker.revoked).toEqual([]);
  });

  it('confirmRevoke sem alvo não faz nada', async () => {
    await create();
    await internals().confirmRevoke();

    expect(revoker.revoked).toEqual([]);
  });

  it('lista vazia informa em texto', async () => {
    source.items = [];
    await create();

    expect(text()).toContain('Nenhum profissional com acesso aprovado');
  });

  it('erro de carga oferece tentar novamente', async () => {
    source.fail = true;
    await create();

    expect(text()).toContain('Não foi possível carregar');
    source.fail = false;
    buttons('Tentar novamente')[0].click();
    await settle();

    expect(text()).toContain('Ana Souza');
  });

  it('mostra carregando antes da resposta', () => {
    fixture = TestBed.createComponent(ProfessionalAccessComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Carregando');
  });

  it('sem hospital selecionado mostra lista vazia', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProfessionalAccessSource, useValue: source },
        { provide: ProfessionalAccessRevoker, useValue: revoker },
        { provide: LinkedHospitalsReader, useValue: { read: (): Promise<unknown[]> => Promise.resolve([]) } },
      ],
    });
    await TestBed.inject(HospitalContextService).load();
    await create();

    expect(text()).toContain('Nenhum profissional');
  });

  it('voltar usa o histórico', async () => {
    await create();
    const location = TestBed.inject(Location);

    spyOn(location, 'back');
    el.querySelector<HTMLButtonElement>('app-icon-button button')?.click();

    expect(location.back).toHaveBeenCalledWith();
  });
});

describe('ProvisionalProfessionalAccess', () => {
  it('revoga em memória e reflete na lista; 409 se repetir; 404 se inexistente', async () => {
    TestBed.configureTestingModule({ providers: [ProvisionalProfessionalAccess, ProvisionalProfessionalRevoker] });
    const access = TestBed.inject(ProvisionalProfessionalAccess);
    const revoker = TestBed.inject(ProvisionalProfessionalRevoker);

    expect((await access.list()).every(p => p.status === 'approved')).toBeTrue();
    await revoker.revoke(1, 11);

    expect((await access.list()).find(p => p.id === 11)?.status).toBe('revoked');
    await expectAsync(revoker.revoke(1, 11)).toBeRejectedWith(jasmine.objectContaining({ status: 409 }));
    await expectAsync(revoker.revoke(1, 999)).toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
  });
});
