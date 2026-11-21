import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { InviteLookup } from './hospital-invite.models';
import { HospitalInvitePort } from './hospital-invite-port';

type Phase = 'idle' | 'searching' | 'result' | 'confirming' | 'done';

/**
 * Convite direto de profissional já cadastrado (FT-009-1, US-009-1-01). Sem desenho no Figma:
 * montada só com componentes existentes do design system. Requer conexão; nada é otimista.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, PageContainerComponent],
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
  protected readonly approvedRequest = signal(false);
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
    } catch {
      this.error.set('Não foi possível buscar o profissional. Tente novamente.');
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
      const outcome = await this.port.confirm(hospital.id, result.profile.email);

      this.approvedRequest.set(outcome.approvedRequest);
      this.invitedName.set(result.profile.name);
      this.phase.set('done');
    } catch {
      this.error.set('Não foi possível confirmar o convite. Nenhum vínculo foi criado.');
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
