import { ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { PersonStatus, plural, ROLE_LABELS, STATUS_LABELS, TeamMember } from './administration.models';
import { AdministrationApi } from './administration-api';
import { InvitePanelComponent } from './invite-panel.component';

type LoadStatus = 'loading' | 'ready' | 'error';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Equipe (Figma Equipe · Desktop · 1 e Mobile · 1): lista com busca e filtro de situação; convidar pessoa. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, InvitePanelComponent, PageContainerComponent, PageHeaderComponent, UserAvatarComponent],
  selector: 'app-team-list',
  styleUrl: './team-list.component.scss',
  templateUrl: './team-list.component.html',
})
export class TeamListComponent implements OnInit {
  readonly status = signal<LoadStatus>('loading');
  readonly members = signal<readonly TeamMember[]>([]);
  readonly search = signal('');
  readonly situation = signal<PersonStatus | ''>('');
  readonly inviteOpen = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly roleLabels = ROLE_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly filters: readonly { readonly key: PersonStatus | ''; readonly label: string }[] = [
    { key: '', label: 'Todos' },
    { key: 'ATIVO', label: 'Ativos' },
    { key: 'CONVIDADO', label: 'Convidados' },
    { key: 'DESATIVADO', label: 'Desativados' },
  ];

  readonly visible = computed(() => {
    const term = normalize(this.search());
    const wanted = this.situation();

    return this.members().filter(
      member =>
        (wanted === '' || member.situacao === wanted) &&
        (term === '' || normalize(member.nome).includes(term) || normalize(member.email).includes(term)),
    );
  });
  readonly pendingInvites = computed(() => this.members().filter(m => m.situacao === 'CONVIDADO').length);

  private readonly api = inject(AdministrationApi);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.status.set('loading');
    try {
      this.members.set(await this.api.listTeam());
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  open(member: TeamMember): void {
    if (member.usuarioId !== null) {
      void this.router.navigate(['/team', member.usuarioId]);
    }
  }

  hospitalsLabel(member: TeamMember): string {
    const total = member.hospitais.length;

    return total === 0 ? '—' : String(total);
  }

  async resend(member: TeamMember): Promise<void> {
    if (member.conviteId !== null) {
      await this.run(() => this.api.resendInvite(member.conviteId as number));
    }
  }

  async cancel(member: TeamMember): Promise<void> {
    if (member.conviteId !== null) {
      await this.run(() => this.api.cancelInvite(member.conviteId as number));
    }
  }

  subtitle(): string {
    const people = this.members().length;
    const pending = this.pendingInvites();

    const invites = pending > 0 ? ` · ${plural(pending, 'convite pendente', 'convites pendentes')}` : '';

    return plural(people, 'pessoa', 'pessoas') + invites;
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.actionError.set(null);
    try {
      await action();
      await this.load();
    } catch {
      this.actionError.set('Não foi possível concluir a ação. Tente novamente.');
    }
  }
}
