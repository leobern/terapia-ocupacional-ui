import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { HospitalProfessional } from './professional-access.models';
import { ProfessionalAccessRevoker, ProfessionalAccessSource } from './professional-access-port';

type LoadState = 'loading' | 'ready' | 'error';

const STATUS_LABEL = { approved: 'Aprovado', revoked: 'Revogado' } as const;

const ERROR_BY_STATUS: Readonly<Record<number, string>> = {
  401: 'Sua sessão expirou. Entre novamente para revogar o acesso.',
  403: 'Você não tem permissão para revogar acessos. Apenas gestores podem fazer isso.',
  404: 'Profissional ou vínculo não encontrado. Atualize a lista.',
  409: 'O vínculo deste profissional não está mais aprovado. A lista foi atualizada.',
};
const DEFAULT_ERROR = 'Não foi possível revogar o acesso. Nada foi alterado. Tente novamente.';

/**
 * Revogação de acesso de profissional pelo gestor (US-001-2-04). Sem desenho no Figma: montada só
 * com componentes existentes do design system. Exige conexão; nada é otimista.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ConfirmDialogComponent, IconButtonComponent, PageContainerComponent],
  selector: 'app-professional-access',
  styleUrl: './professional-access.component.scss',
  templateUrl: './professional-access.component.html',
})
export class ProfessionalAccessComponent implements OnInit {
  protected readonly professionals = signal<readonly HospitalProfessional[]>([]);
  protected readonly state = signal<LoadState>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal<HospitalProfessional | null>(null);
  protected readonly revoking = signal(false);
  protected readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
  protected readonly offline = computed(() => !this.connectivity.online());
  protected readonly dialogMessage = computed(
    () => `${this.pending()?.name ?? ''} perderá o acesso a ${this.hospitalName()} imediatamente.`,
  );

  private readonly source = inject(ProfessionalAccessSource);
  private readonly revoker = inject(ProfessionalAccessRevoker);
  private readonly context = inject(HospitalContextService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly location = inject(Location);

  ngOnInit(): void {
    void this.load();
  }

  protected statusLabel(professional: HospitalProfessional): string {
    return STATUS_LABEL[professional.status];
  }

  protected back(): void {
    this.location.back();
  }

  protected async load(): Promise<void> {
    const hospital = this.context.selected();

    if (hospital === null) {
      this.professionals.set([]);
      this.state.set('ready');

      return;
    }
    this.state.set('loading');
    try {
      this.professionals.set(await this.source.list(hospital.id));
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected askRevoke(professional: HospitalProfessional): void {
    if (this.offline() || this.revoking()) {
      return;
    }
    this.error.set(null);
    this.pending.set(professional);
  }

  protected cancelRevoke(): void {
    this.pending.set(null);
  }

  protected async confirmRevoke(): Promise<void> {
    const target = this.pending();
    const hospital = this.context.selected();

    if (target === null || hospital === null || this.offline()) {
      return;
    }
    this.pending.set(null);
    this.revoking.set(true);
    try {
      await this.revoker.revoke(hospital.id, target.id);
      this.setStatus(target.id, 'revoked');
    } catch (failure) {
      const status = (failure as { status?: number }).status;

      this.error.set((status !== undefined && ERROR_BY_STATUS[status]) || DEFAULT_ERROR);
      if (status === 409) {
        this.setStatus(target.id, 'revoked');
      }
    } finally {
      this.revoking.set(false);
    }
  }

  private setStatus(id: number, status: HospitalProfessional['status']): void {
    this.professionals.update(list => list.map(p => (p.id === id ? { ...p, status } : p)));
  }
}
