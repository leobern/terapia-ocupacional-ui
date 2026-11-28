import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { ApiSpy, createApiSpy, INVITED } from './administration.testing';
import { AdministrationApi } from './administration-api';
import { TeamListComponent } from './team-list.component';

describe('TeamListComponent', () => {
  let api: ApiSpy;
  let fixture: ComponentFixture<TeamListComponent>;
  let el: HTMLElement;
  let navigate: jasmine.Spy;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function open(): Promise<void> {
    api = createApiSpy();
    TestBed.configureTestingModule({
      imports: [TeamListComponent],
      providers: [
        provideRouter([]),
        { provide: AdministrationApi, useValue: api },
        { provide: SessionRoleReader, useValue: { read: (): Role => Role.ADMIN } },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(TeamListComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
  }

  const rows = (): HTMLElement[] => Array.from(el.querySelectorAll('.team__row:not(.team__row--head)'));
  const chip = (label: string): HTMLElement =>
    Array.from(el.querySelectorAll('.team__chip')).find(c => c.textContent?.includes(label)) as HTMLElement;

  it('lista a equipe e conta os convites pendentes no subtítulo', async () => {
    await open();

    expect(rows().length).toBe(3);
    expect(el.textContent).toContain('3 pessoas · 1 convite pendente');
  });

  it('filtra por situação e busca sem acento', async () => {
    await open();
    chip('Convidados').click();
    fixture.detectChanges();

    expect(rows().length).toBe(1);
    chip('Todos').click();
    const search = el.querySelector('.team__search') as HTMLInputElement;

    search.value = 'CÁRLA';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(rows().length).toBe(1);
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(el.textContent).toContain('Ninguém encontrado');
  });

  it('abre o detalhe da pessoa pelo nome', async () => {
    await open();
    (rows()[0].querySelector('.team__person') as HTMLElement).click();

    expect(navigate).toHaveBeenCalledWith(['/team', 7]);
  });

  it('convidado não abre detalhe', async () => {
    await open();
    api.listTeam.and.resolveTo([INVITED]);
    await fixture.componentInstance.load();
    await settle();
    (rows()[0].querySelector('.team__person') as HTMLElement).click();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('reenvia e cancela convites pela linha', async () => {
    await open();
    const row = rows().find(r => r.textContent?.includes('novo@hsl.org')) as HTMLElement;
    const [resend, cancel] = Array.from(row.querySelectorAll('.team__link')) as HTMLElement[];

    resend.click();
    await settle();
    cancel.click();
    await settle();

    expect(api.resendInvite).toHaveBeenCalledWith(9);
    expect(api.cancelInvite).toHaveBeenCalledWith(9);
  });

  it('mostra erro se a ação falhar', async () => {
    await open();
    api.cancelInvite.and.rejectWith(new Error('x'));
    const row = rows().find(r => r.textContent?.includes('novo@hsl.org')) as HTMLElement;

    (row.querySelectorAll('.team__link')[1] as HTMLElement).click();
    await settle();

    expect(el.textContent).toContain('Não foi possível concluir a ação');
  });

  it('mostra erro de carga e tenta de novo', async () => {
    api = createApiSpy();
    api.listTeam.and.rejectWith(new Error('x'));
    TestBed.configureTestingModule({
      imports: [TeamListComponent],
      providers: [
        provideRouter([]),
        { provide: AdministrationApi, useValue: api },
        { provide: SessionRoleReader, useValue: { read: (): Role => Role.ADMIN } },
      ],
    });
    fixture = TestBed.createComponent(TeamListComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();

    expect(el.textContent).toContain('Erro ao carregar a equipe');

    api.listTeam.and.resolveTo([]);
    (el.querySelector('.team__retry') as HTMLElement).click();
    await settle();

    expect(el.textContent).toContain('Ninguém encontrado');
  });

  it('o botão Hospitais leva à administração de hospitais', async () => {
    await open();
    (el.querySelectorAll('app-page-header app-button button')[0] as HTMLElement).click();

    expect(navigate).toHaveBeenCalledWith(['/hospitals']);
  });

  it('abre o painel de convite pelo botão do cabeçalho', async () => {
    await open();
    (el.querySelectorAll('app-page-header app-button button')[1] as HTMLElement).click();
    fixture.detectChanges();

    expect(el.querySelector('app-invite-panel app-side-panel .side-panel')).not.toBeNull();
  });

  it('subtítulo no plural para vários convites pendentes', async () => {
    await open();
    api.listTeam.and.resolveTo([INVITED, { ...INVITED, conviteId: 10 }]);
    await fixture.componentInstance.load();
    await settle();

    expect(el.textContent).toContain('2 pessoas · 2 convites pendentes');
  });

  it('subtítulo no singular e rótulo de hospitais', async () => {
    await open();
    api.listTeam.and.resolveTo([{ ...INVITED, hospitais: [], situacao: 'ATIVO' }]);
    await fixture.componentInstance.load();
    await settle();

    expect(el.textContent).toContain('1 pessoa');
    expect(fixture.componentInstance.hospitalsLabel(INVITED)).toBe('—');
  });
});
