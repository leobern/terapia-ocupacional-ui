import { ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { BannerComponent } from '../../shared/components/banner/banner.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardNotifyComponent } from '../../shared/components/card-notify/card-notify.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { UserPhotoService } from '../../shared/services/user-photo.service';
import {
  AdminHospital,
  Interaction,
  INTERACTION_LABELS,
  PersonStatus,
  plural,
  ROLE_LABELS,
  STATUS_LABELS,
  UserRole,
} from './administration.models';
import { AdministrationApi } from './administration-api';
import { ProfileEditPanelComponent } from './profile-edit-panel.component';
import { SidePanelComponent } from './side-panel.component';

type LoadStatus = 'loading' | 'ready' | 'error';

const DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
});

function formatDate(value: string): string {
  return DATE.format(new Date(value));
}

const ERROR_TEXT: Readonly<Record<number, string>> = {
  0: 'Não foi possível concluir a ação. Tente novamente.',
  403: 'Você não tem permissão para esta ação.',
  409: 'Não foi possível: a regra do sistema impede esta ação (por exemplo, o último administrador).',
};

function invitedByText(name: string | null, when: string | null): string | null {
  if (name === null) {
    return null;
  }

  return when === null ? name : `${name} · ${formatDate(when)}`;
}

function formatWhen(value: string): string {
  return DATE_TIME.format(new Date(value));
}

/** Uma linha de "Hospitais vinculados". */
interface LinkView {
  readonly hospitalId: number;
  readonly name: string;
  readonly address: string | null;
  readonly hospitalRole: string | null;
  readonly since: string | null;
}

/** Tudo que a tela mostra, venha do detalhe da equipe (ADMIN/GESTOR) ou do próprio perfil. */
interface PersonView {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: PersonStatus;
  readonly hasPhoto: boolean;
  readonly lastAccess: string | null;
  readonly invitedBy: string | null;
  readonly specialty: string | null;
  readonly phone: string | null;
  readonly registry: string | null;
  readonly links: readonly LinkView[];
}

type Confirm = { readonly kind: 'unlink'; readonly link: LinkView } | { readonly kind: 'deactivate' } | null;

/**
 * Detalhe da pessoa (Figma Equipe · Desktop · 2 e Mobile · 2): cabeçalho com avatar, dados, vínculos com hospitais
 * e "Últimas interações". A mesma tela é o PERFIL de cada usuário (`/profile`): a diferença é só quem edita. O
 * ADMIN/GESTOR vê só o que é público (RN-009); mensagens diretas entre duas pessoas nunca aparecem.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BannerComponent,
    ButtonComponent,
    CardNotifyComponent,
    ConfirmDialogComponent,
    PageContainerComponent,
    PageHeaderComponent,
    ProfileEditPanelComponent,
    SidePanelComponent,
    UserAvatarComponent,
  ],
  selector: 'app-person-detail',
  styleUrl: './person-detail.component.scss',
  templateUrl: './person-detail.component.html',
})
export class PersonDetailComponent implements OnInit {
  readonly status = signal<LoadStatus>('loading');
  readonly person = signal<PersonView | null>(null);
  readonly interactions = signal<readonly Interaction[]>([]);
  readonly photoUrl = signal<string | null>(null);
  readonly confirm = signal<Confirm>(null);
  readonly error = signal<string | null>(null);
  readonly linkPanelOpen = signal(false);
  readonly rolePanelOpen = signal(false);
  readonly editOpen = signal(false);
  readonly availableHospitals = signal<readonly AdminHospital[]>([]);
  readonly newHospitalId = signal<number | null>(null);
  readonly newHospitalRole = signal<'PROFISSIONAL' | 'GESTOR'>('PROFISSIONAL');
  readonly newRole = signal<UserRole>('TERAPEUTA');
  readonly roleLabels = ROLE_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly roleKeys = Object.keys(ROLE_LABELS) as UserRole[];

  /** `/profile`: o próprio usuário (edita os dados; não administra vínculos). */
  readonly isSelf: boolean;
  readonly isAdmin = inject(SessionRoleReader).read() === Role.ADMIN;
  readonly canManage = computed(() => !this.isSelf);
  readonly confirmTitle = computed(() => {
    const current = this.confirm();

    if (current?.kind === 'unlink') {
      return `Remover do ${current.link.name}?`;
    }

    return `Desativar ${this.firstName()}?`;
  });
  readonly confirmMessage = computed(() =>
    this.confirm()?.kind === 'unlink'
      ? `${this.firstName()} perde o acesso a este hospital. O histórico clínico permanece e a ação fica registrada.`
      : `${this.firstName()} não poderá mais entrar e as sessões abertas serão encerradas. Nada é apagado e você pode reativar depois.`,
  );

  private readonly api = inject(AdministrationApi);
  private readonly router = inject(Router);
  private readonly photos = inject(UserPhotoService);
  private readonly routeId: number | null;

  constructor() {
    const route = inject(ActivatedRoute);

    this.isSelf = route.snapshot.data['self'] === true;
    this.routeId = Number(route.snapshot.paramMap.get('id')) || null;
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.status.set('loading');
    try {
      if (this.isSelf) {
        const profile = await this.api.myProfile();

        this.person.set({
          email: profile.email,
          hasPhoto: profile.temFoto,
          id: profile.id,
          invitedBy: null,
          lastAccess: profile.ultimoAcesso,
          links: profile.hospitais.map(h => ({
            address: null,
            hospitalId: h.id,
            hospitalRole: null,
            name: h.nome,
            since: null,
          })),
          name: profile.nomeCompleto,
          phone: profile.telefone,
          registry: profile.registroProfissional,
          role: profile.papel,
          specialty: profile.especialidade,
          status: 'ATIVO',
        });
        this.interactions.set(await this.api.myInteractions());
      } else if (this.routeId !== null) {
        const detail = await this.api.personDetail(this.routeId);
        const member = detail.pessoa;

        this.person.set({
          email: member.email,
          hasPhoto: member.temFoto,
          id: this.routeId,
          invitedBy: invitedByText(member.convidadoPor, member.convidadoEm),
          lastAccess: member.ultimoAcesso,
          links: detail.vinculos.map(v => ({
            address: v.endereco,
            hospitalId: v.hospitalId,
            hospitalRole: v.papelHospital === 'GESTOR' ? 'Gestor' : 'Profissional',
            name: v.hospitalNome,
            since: v.desde,
          })),
          name: member.nome,
          phone: null,
          registry: null,
          role: member.papel,
          specialty: null,
          status: member.situacao,
        });
        this.interactions.set(await this.api.personInteractions(this.routeId));
      }
      await this.loadPhoto();
      this.status.set('ready');
    } catch {
      this.person.set(null);
      this.status.set('error');
    }
  }

  subtitleOf(view: PersonView): string {
    const hospitals = view.links.length;
    const parts = [
      ROLE_LABELS[view.role],
      plural(hospitals, 'hospital', 'hospitais'),
      view.lastAccess ? `último acesso ${formatWhen(view.lastAccess)}` : 'ainda sem acesso',
    ];

    return parts.join(' · ');
  }

  back(): void {
    void this.router.navigate([this.isSelf ? '/home' : '/team']);
  }

  firstName(): string {
    return (this.person()?.name ?? '').split(' ')[0];
  }

  kind(item: Interaction): string {
    return INTERACTION_LABELS[item.tipo];
  }

  when(item: Interaction): string {
    return item.quando ? formatWhen(item.quando) : '';
  }

  openInteraction(item: Interaction): void {
    void this.router.navigate(item.pacienteId !== null ? ['/patients', item.pacienteId] : ['/notifications']);
  }

  at(value: string): string {
    return formatWhen(value);
  }

  whenLink(value: string | null): string {
    return value ? formatDate(value) : '';
  }

  // ----- ações do ADMIN/GESTOR ---------------------------------------------------------------

  async openLinkPanel(): Promise<void> {
    this.error.set(null);
    this.newHospitalId.set(null);
    this.newHospitalRole.set('PROFISSIONAL');
    this.linkPanelOpen.set(true);
    try {
      const have = new Set((this.person() as PersonView).links.map(l => l.hospitalId));

      this.availableHospitals.set((await this.api.listHospitals()).filter(h => h.ativo && !have.has(h.id)));
    } catch {
      this.error.set('Não foi possível carregar os hospitais.');
    }
  }

  async addLink(): Promise<void> {
    const hospitalId = this.newHospitalId();

    if (hospitalId === null) {
      return;
    }
    const person = this.person() as PersonView;

    await this.run(async () => {
      await this.api.link(person.id, hospitalId, this.newHospitalRole());
      this.linkPanelOpen.set(false);
    });
  }

  openRolePanel(): void {
    this.newRole.set((this.person() as PersonView).role);
    this.rolePanelOpen.set(true);
  }

  async changeRole(): Promise<void> {
    const person = this.person();

    if (person !== null) {
      await this.run(async () => {
        await this.api.changeRole(person.id, this.newRole());
        this.rolePanelOpen.set(false);
      });
    }
  }

  async reactivate(): Promise<void> {
    const person = this.person();

    if (person !== null) {
      await this.run(() => this.api.reactivate(person.id));
    }
  }

  async confirmed(): Promise<void> {
    const current = this.confirm() as Confirm & object;
    const person = this.person() as PersonView;

    this.confirm.set(null);
    await this.run(() =>
      current.kind === 'unlink' ? this.api.unlink(person.id, current.link.hospitalId) : this.api.deactivate(person.id),
    );
  }

  async profileSaved(): Promise<void> {
    this.editOpen.set(false);
    await this.load();
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.error.set(null);
    try {
      await action();
      await this.load();
    } catch (error) {
      const status = (error as { status?: number }).status;

      this.error.set(ERROR_TEXT[status ?? 0] ?? ERROR_TEXT[0]);
    }
  }

  private async loadPhoto(): Promise<void> {
    const person = this.person();

    this.photoUrl.set(person?.hasPhoto ? await this.photos.url(person.id) : null);
  }
}
