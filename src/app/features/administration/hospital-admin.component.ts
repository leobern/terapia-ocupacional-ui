import { ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal } from '@angular/core';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AdminHospital, plural } from './administration.models';
import { AdministrationApi } from './administration-api';
import { SidePanelComponent } from './side-panel.component';

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Hospitais (Figma Hospitais · Desktop · 1 e 2): lista da visão do administrador. Só o ADMIN cadastra, edita e
 * inativa (o GESTOR só vê os dele). Sem geolocalização nem raio.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, PageContainerComponent, PageHeaderComponent, SidePanelComponent],
  selector: 'app-hospital-admin',
  styleUrl: './hospital-admin.component.scss',
  templateUrl: './hospital-admin.component.html',
})
export class HospitalAdminComponent implements OnInit {
  readonly status = signal<LoadStatus>('loading');
  readonly hospitals = signal<readonly AdminHospital[]>([]);
  readonly search = signal('');
  readonly panelOpen = signal(false);
  readonly editing = signal<AdminHospital | null>(null);
  readonly name = signal('');
  readonly address = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly isAdmin = inject(SessionRoleReader).read() === Role.ADMIN;

  readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();

    return this.hospitals().filter(h => term === '' || h.nome.toLowerCase().includes(term));
  });
  readonly inactive = computed(() => this.hospitals().filter(h => !h.ativo).length);

  private readonly api = inject(AdministrationApi);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.status.set('loading');
    try {
      this.hospitals.set(await this.api.listHospitals());
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  subtitle(): string {
    const total = this.hospitals().length;
    const off = this.inactive();

    const inactive = off > 0 ? ` · ${plural(off, 'inativo', 'inativos')}` : '';

    return plural(total, 'hospital', 'hospitais') + inactive;
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  onAddress(event: Event): void {
    this.address.set((event.target as HTMLInputElement).value);
  }

  openCreate(): void {
    this.editing.set(null);
    this.name.set('');
    this.address.set('');
    this.error.set(null);
    this.panelOpen.set(true);
  }

  openEdit(hospital: AdminHospital): void {
    this.editing.set(hospital);
    this.name.set(hospital.nome);
    this.address.set(hospital.endereco ?? '');
    this.error.set(null);
    this.panelOpen.set(true);
  }

  async save(): Promise<void> {
    if (this.name().trim() === '') {
      this.error.set('Informe o nome do hospital.');

      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const current = this.editing();

      if (current) {
        await this.api.updateHospital(current.id, this.name().trim(), this.address().trim());
      } else {
        await this.api.createHospital(this.name().trim(), this.address().trim());
      }
      this.panelOpen.set(false);
      await this.load();
    } catch (error) {
      this.error.set(
        (error as { status?: number }).status === 409
          ? 'Já existe um hospital com este nome.'
          : 'Não foi possível salvar. Tente novamente.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(hospital: AdminHospital): Promise<void> {
    try {
      await this.api.setHospitalActive(hospital.id, !hospital.ativo);
      await this.load();
    } catch (error) {
      this.error.set(
        (error as { status?: number }).status === 422
          ? 'Hospital com pacientes não pode ser inativado.'
          : 'Não foi possível alterar o hospital.',
      );
    }
  }
}
