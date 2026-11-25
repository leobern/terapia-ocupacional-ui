import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { InviteLookup } from './hospital-invite.models';
import { HospitalInvitePort } from './hospital-invite-port';

/** Mensagem pt-BR por status do contrato (vinculos-api.yaml: 400/401/403/404/409; 422 usa a mensagem do servidor). */
function errorMessage(error: unknown, action: 'search' | 'confirm'): string {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  const server = error instanceof HttpErrorResponse ? (error.error?.message as string | undefined) : undefined;

  switch (status) {
    case 401:
      return 'Sua sessão expirou. Entre novamente para continuar.';
    case 403:
      return 'Apenas gestores do hospital podem convidar profissionais.';
    case 404:
      return 'Hospital não encontrado. Selecione um hospital válido e tente novamente.';
    case 409:
      return 'Este profissional já possui vínculo aprovado com o hospital.';
    case 422:
      return server ?? 'Não foi possível processar o convite. Confira os dados e tente novamente.';
    default:
      return action === 'search'
        ? 'Não foi possível buscar o profissional. Tente novamente.'
        : 'Não foi possível confirmar o convite. Nenhum vínculo foi criado.';
  }
}

type Phase = 'idle' | 'searching' | 'result' | 'confirming' | 'done';

/**
 * Convite direto de profissional já cadastrado (FT-009-1, US-009-1-01). Sem desenho no Figma:
 * montada só com componentes existentes do design system. Requer conexão; nada é otimista.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, PageContainerComponent, PageHeaderComponent],
  selector: 'app-hospital-invite',
  styleUrl: './hospital-invite.component.scss',
  templateUrl: './hospital-invite.component.html',
})
export class HospitalInviteComponent {
  protected readonly email = signal('');
  protected readonly phase = signal<Phase>('idle');
  protected readonly lookup = signal<InviteLookup | null>(null);
  /** Mensagem de erro (rede ou servidor); `null` = sem erro. */
  protected readonly error = signal<string | null>(null);
  protected readonly aproveitouSolicitacao = signal(false);
  protected readonly invitedName = signal('');

  protected readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
  protected readonly offline = computed(() => !this.connectivity.online());
  protected readonly canSearch = computed(
    () => this.email().trim() !== '' && !this.offline() && (this.phase() === 'idle' || this.phase() === 'result'),
  );
  protected readonly canConfirm = computed(() => {
    const result = this.lookup();

    return this.phase() === 'result' && !this.offline() && result?.kind === 'found' && result.relation !== 'approved';
  });

  private readonly port = inject(HospitalInvitePort);
  private readonly context = inject(HospitalContextService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly location = inject(Location);

  protected back(): void {
    this.location.back();
  }

  protected onEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  protected async search(): Promise<void> {
    const hospital = this.context.selected();

    if (!this.canSearch() || hospital === null) {
      return;
    }
    this.error.set(null);
    this.lookup.set(null);
    this.phase.set('searching');
    try {
      this.lookup.set(await this.port.lookup(hospital.id, this.email().trim()));
      this.phase.set('result');
    } catch (error) {
      this.error.set(errorMessage(error, 'search'));
      this.phase.set('idle');
    }
  }

  protected async confirm(): Promise<void> {
    const hospital = this.context.selected();
    const result = this.lookup();

    if (!this.canConfirm() || hospital === null || result?.kind !== 'found') {
      return;
    }
    this.error.set(null);
    this.phase.set('confirming');
    try {
      const outcome = await this.port.confirm(hospital.id, result.profile.usuarioId);

      this.aproveitouSolicitacao.set(outcome.aproveitouSolicitacao);
      this.invitedName.set(result.profile.nomeCompleto);
      this.phase.set('done');
    } catch (error) {
      this.error.set(errorMessage(error, 'confirm'));
      this.phase.set('result');
    }
  }

  /** Descarta o convite sem criar vínculo. */
  protected cancel(): void {
    this.lookup.set(null);
    this.error.set(null);
    this.email.set('');
    this.phase.set('idle');
  }
}
