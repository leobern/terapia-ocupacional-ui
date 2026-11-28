import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { UserPhotoService } from '../../shared/services/user-photo.service';
import { ApiSpy, createApiSpy, DETAIL, INTERACTIONS, MEMBER, PROFILE } from './administration.testing';
import { AdministrationApi } from './administration-api';
import { PersonDetailComponent } from './person-detail.component';

describe('PersonDetailComponent', () => {
  let api: ApiSpy;
  let fixture: ComponentFixture<PersonDetailComponent>;
  let el: HTMLElement;
  let navigate: jasmine.Spy;
  let photos: jasmine.SpyObj<UserPhotoService>;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function open(options: { self?: boolean; role?: Role } = {}): Promise<void> {
    api = createApiSpy();
    photos = jasmine.createSpyObj<UserPhotoService>('UserPhotoService', ['url']);
    Object.defineProperty(photos, 'version', { get: () => (): number => 0 });
    photos.url.and.resolveTo(null);
    TestBed.configureTestingModule({
      imports: [PersonDetailComponent],
      providers: [
        provideRouter([]),
        { provide: AdministrationApi, useValue: api },
        { provide: UserPhotoService, useValue: photos },
        { provide: SessionRoleReader, useValue: { read: (): Role => options.role ?? Role.ADMIN } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { self: options.self === true },
              paramMap: { get: (): string | null => (options.self ? null : '7') },
            },
          },
        },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PersonDetailComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
  }

  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(el.querySelectorAll('app-button'))
      .find(b => b.textContent?.trim() === label)
      ?.querySelector('button') ?? undefined;

  async function confirmDialog(): Promise<void> {
    (
      el.querySelector(
        'app-confirm-dialog .confirm-dialog__actions app-button:first-child button, app-confirm-dialog button',
      ) as HTMLElement
    ).click();
    await settle();
  }

  describe('visão do ADMIN', () => {
    beforeEach(async () => open());

    it('mostra dados, vínculos e as últimas interações públicas', () => {
      expect(el.textContent).toContain('Rafael Dutra');
      expect(el.textContent).toContain('Hospital A');
      expect(el.textContent).toContain('Papel no hospital: Profissional');
      expect(el.textContent).toContain('Almira Conductia');
      expect(el.querySelector('app-banner')?.textContent).toContain(
        'Mensagens diretas entre duas pessoas são privadas',
      );

      expect(el.querySelectorAll('app-card-notify').length).toBe(2);
    });

    it('toque no card leva ao paciente ou às notificações', () => {
      const cards = Array.from(el.querySelectorAll('app-card-notify article')) as HTMLElement[];

      cards[0].click();
      cards[1].click();

      expect(navigate.calls.allArgs()).toEqual([[['/patients', 5]], [['/notifications']]]);
    });

    it('desativa o usuário depois da confirmação', async () => {
      button('Desativar usuário')?.click();
      fixture.detectChanges();

      expect(el.textContent).toContain('Desativar Rafael?');
      await confirmDialog();

      expect(api.deactivate).toHaveBeenCalledWith(7);
    });

    it('remove do hospital depois da confirmação', async () => {
      button('Remover do hospital')?.click();
      fixture.detectChanges();

      expect(el.textContent).toContain('Remover do Hospital A?');
      await confirmDialog();

      expect(api.unlink).toHaveBeenCalledWith(7, 1);
    });

    it('adiciona hospital com o papel escolhido', async () => {
      button('Adicionar hospital')?.click();
      await settle();

      expect(el.textContent).toContain('Hospitais ainda sem vínculo');
      api.listHospitals.and.resolveTo([]);
      fixture.componentInstance.newHospitalId.set(2);
      fixture.componentInstance.newHospitalRole.set('GESTOR');
      await fixture.componentInstance.addLink();
      await settle();

      expect(api.link).toHaveBeenCalledWith(7, 2, 'GESTOR');
    });

    it('lista só os hospitais ainda sem vínculo e escolhe pelo clique', async () => {
      api.listHospitals.and.resolveTo([
        {
          ativo: true,
          criadoEm: null,
          endereco: 'R',
          gestor: null,
          id: 2,
          nome: 'Hospital C',
          pacientes: 0,
          pessoas: 0,
        },
        {
          ativo: false,
          criadoEm: null,
          endereco: null,
          gestor: null,
          id: 3,
          nome: 'Inativo',
          pacientes: 0,
          pessoas: 0,
        },
        {
          ativo: true,
          criadoEm: null,
          endereco: null,
          gestor: null,
          id: 1,
          nome: 'Hospital A',
          pacientes: 0,
          pessoas: 0,
        },
      ]);
      button('Adicionar hospital')?.click();
      await settle();
      const options = Array.from(el.querySelectorAll('.panel-option')) as HTMLElement[];

      expect(options.map(o => o.textContent?.trim())).toEqual(['Hospital CR']);
      options[0].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.newHospitalId()).toBe(2);
      (
        Array.from(el.querySelectorAll('.panel-chip')).find(c => c.textContent?.includes('Gestor')) as HTMLElement
      ).click();
      button('Adicionar')?.click();
      await settle();

      expect(api.link).toHaveBeenCalledWith(7, 2, 'GESTOR');
    });

    it('muda o papel', async () => {
      button('Mudar papel')?.click();
      fixture.detectChanges();
      (
        Array.from(el.querySelectorAll('.panel-chip')).find(c => c.textContent?.includes('Terapeuta')) as HTMLElement
      ).click();
      button('Salvar')?.click();
      await settle();

      expect(api.changeRole).toHaveBeenCalledWith(7, 'TERAPEUTA');
    });

    it('mostra o vínculo de gestor e convite sem data', async () => {
      api.personDetail.and.resolveTo({
        pessoa: { ...MEMBER, convidadoEm: null },
        vinculos: [{ ...DETAIL.vinculos[0], papelHospital: 'GESTOR', desde: null }],
      });
      await fixture.componentInstance.load();
      await settle();

      expect(el.textContent).toContain('Papel no hospital: Gestor');
      expect(el.textContent).toContain('Almira Conductia');
    });

    it('reativa quem está desativado', async () => {
      api.personDetail.and.resolveTo({ ...DETAIL, pessoa: { ...MEMBER, situacao: 'DESATIVADO' } });
      await fixture.componentInstance.load();
      await settle();
      button('Reativar usuário')?.click();
      await settle();

      expect(api.reactivate).toHaveBeenCalledWith(7);
    });

    async function failDeactivate(status: number): Promise<string> {
      api.deactivate.and.rejectWith({ status });
      button('Desativar usuário')?.click();
      fixture.detectChanges();
      await confirmDialog();

      return (el.querySelector('.person__error')?.textContent ?? '').toLowerCase();
    }

    it('não adiciona vínculo sem escolher o hospital', async () => {
      await fixture.componentInstance.addLink();

      expect(api.link).not.toHaveBeenCalled();
    });

    it('erro sem status também vira a mensagem genérica', async () => {
      api.deactivate.and.rejectWith(new Error('rede'));
      button('Desativar usuário')?.click();
      fixture.detectChanges();
      await confirmDialog();

      expect(el.querySelector('.person__error')?.textContent).toContain('Não foi possível concluir');
    });

    it('traduz os erros 409 e 403 e o genérico', async () => {
      expect(await failDeactivate(409)).toContain('último administrador');
      expect(await failDeactivate(403)).toContain('não tem permissão');
      expect(await failDeactivate(500)).toContain('não foi possível concluir');
    });

    it('cancela a confirmação sem agir', () => {
      button('Desativar usuário')?.click();
      fixture.detectChanges();
      fixture.componentInstance.confirm.set(null);
      fixture.detectChanges();

      expect(api.deactivate).not.toHaveBeenCalled();
    });

    it('volta para a lista da equipe', () => {
      fixture.componentInstance.back();

      expect(navigate).toHaveBeenCalledWith(['/team']);
    });

    it('carrega a foto quando existe', async () => {
      photos.url.and.resolveTo('blob:foto');
      api.personDetail.and.resolveTo({ ...DETAIL, pessoa: { ...MEMBER, temFoto: true } });
      await fixture.componentInstance.load();

      expect(fixture.componentInstance.photoUrl()).toBe('blob:foto');
    });

    it('mostra erro de carga e tenta de novo', async () => {
      api.personDetail.and.rejectWith(new Error('x'));
      await fixture.componentInstance.load();
      await settle();

      expect(el.textContent).toContain('Não foi possível carregar a pessoa');

      api.personDetail.and.resolveTo(DETAIL);
      button('Tentar novamente')?.click();
      await settle();

      expect(el.textContent).toContain('Hospital A');
    });

    it('mostra a lista de interações vazia e papel sem hospitais', async () => {
      api.personInteractions.and.resolveTo([]);
      api.personDetail.and.resolveTo({
        ...DETAIL,
        pessoa: { ...MEMBER, convidadoPor: null, ultimoAcesso: null },
        vinculos: [],
      });
      await fixture.componentInstance.load();
      await settle();

      expect(el.textContent).toContain('Nenhuma interação pública ainda');
      expect(el.textContent).toContain('Nenhum hospital vinculado');
      expect(el.textContent).toContain('ainda sem acesso');
    });
  });

  describe('visão do GESTOR', () => {
    it('não vê ações exclusivas do ADMIN', async () => {
      await open({ role: Role.GESTOR });

      expect(button('Desativar usuário')).toBeUndefined();
      expect(button('Mudar papel')).toBeUndefined();
      expect(button('Adicionar hospital')).toBeDefined();
    });
  });

  describe('perfil do próprio usuário', () => {
    beforeEach(async () => open({ self: true, role: Role.TERAPEUTA }));

    it('mostra os meus dados e as minhas interações, sem administrar vínculos', () => {
      expect(api.myProfile).toHaveBeenCalledWith();
      expect(api.myInteractions).toHaveBeenCalledWith();
      expect(el.textContent).toContain('Minhas últimas interações');
      expect(el.textContent).toContain('CRM 123');
      expect(el.textContent).toContain('Nutrologia');
      expect(el.textContent).toContain('11 99999-0000');
      expect(button('Adicionar hospital')).toBeUndefined();
      expect(el.querySelector('app-banner')).toBeNull();
    });

    it('abre a edição e recarrega depois de salvar', async () => {
      button('Editar perfil')?.click();
      fixture.detectChanges();

      expect(el.querySelector('app-profile-edit-panel .side-panel')).not.toBeNull();
      api.myProfile.calls.reset();
      await fixture.componentInstance.profileSaved();

      expect(api.myProfile).toHaveBeenCalledWith();
    });

    it('volta para a Home', () => {
      fixture.componentInstance.back();

      expect(navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  it('usa o perfil para formatar datas e rótulos das interações', async () => {
    await open();

    expect(fixture.componentInstance.kind(INTERACTIONS[0])).toBe('Evolução');
    expect(fixture.componentInstance.when(INTERACTIONS[1])).toBe('');
    expect(fixture.componentInstance.whenLink(null)).toBe('');
    expect(PROFILE.id).toBe(7);
  });
});
