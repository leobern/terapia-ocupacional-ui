import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { blocksRequest, HospitalLink, HospitalOption, LINK_STATUS_LABEL, LinkStatus } from './hospital-links.models';
import { HospitalLinksPort } from './hospital-links-port';

const MIN_QUERY = 2;

/**
 * Cadastro / Vínculos (US-001-2-01): o médico busca hospitais por nome, confirma a solicitação e
 * acompanha os vínculos. Sem desenho no Figma: montada só com componentes existentes do design system.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, PageContainerComponent, PageHeaderComponent],
  selector: 'app-hospital-links',
  styleUrl: './hospital-links.component.scss',
  templateUrl: './hospital-links.component.html',
})
export class HospitalLinksComponent implements OnInit {
  protected readonly query = signal('');
  protected readonly links = signal<readonly HospitalLink[]>([]);
  protected readonly loadingLinks = signal(true);
  protected readonly linksError = signal<string | null>(null);
  protected readonly results = signal<readonly HospitalOption[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  /** `true` depois de uma busca concluída (distingue "sem resultado" de "ainda não buscou"). */
  protected readonly searched = signal(false);
  protected readonly searching = signal(false);
  protected readonly selected = signal<HospitalOption | null>(null);
  protected readonly requesting = signal(false);
  /** Mensagem de erro/aviso da busca ou da solicitação; `null` = nada a mostrar. */
  protected readonly message = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly offline = computed(() => !this.connectivity.online());
  protected readonly canSearch = computed(
    () => this.query().trim().length >= MIN_QUERY && !this.offline() && !this.searching(),
  );
  protected readonly notFound = computed(() => this.searched() && this.results().length === 0);

  private lastQuery = '';
  private readonly port = inject(HospitalLinksPort);
  private readonly connectivity = inject(ConnectivityService);
  private readonly location = inject(Location);

  ngOnInit(): void {
    void this.loadLinks();
  }

  protected back(): void {
    this.location.back();
  }

  protected statusLabel(status: LinkStatus): string {
    return LINK_STATUS_LABEL[status];
  }

  /** Vínculo que impede nova solicitação para o hospital (RN03), se houver. */
  protected blockingLink(hospitalId: number): HospitalLink | undefined {
    return this.links().find(link => link.hospitalId === hospitalId && blocksRequest(link.status));
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected async search(): Promise<void> {
    if (!this.canSearch()) {
      return;
    }
    this.lastQuery = this.query().trim();
    this.results.set([]);
    this.nextCursor.set(null);
    this.selected.set(null);
    this.success.set(null);
    await this.fetchPage(null);
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();

    if (cursor !== null && !this.searching() && !this.offline()) {
      await this.fetchPage(cursor);
    }
  }

  protected select(hospital: HospitalOption): void {
    this.message.set(null);
    this.success.set(null);
    this.selected.set(this.blockingLink(hospital.id) ? null : hospital);
    if (this.blockingLink(hospital.id)) {
      this.message.set('Já existe uma solicitação pendente ou vínculo aprovado com este hospital.');
    }
  }

  protected cancel(): void {
    this.selected.set(null);
  }

  protected async confirm(): Promise<void> {
    const hospital = this.selected();

    if (hospital === null || this.requesting() || this.offline()) {
      return;
    }
    this.message.set(null);
    this.requesting.set(true);
    try {
      const created = await this.port.request(hospital.id);

      this.links.update(list => [...list.filter(link => link.id !== created.id), created]);
      this.success.set(
        `Solicitação enviada ao gestor de ${hospital.name}. Status: ${LINK_STATUS_LABEL[created.status]}.`,
      );
      this.selected.set(null);
    } catch (error) {
      this.message.set(this.requestError(error));
      this.selected.set(null);
      if (error instanceof HttpErrorResponse && error.status === 409) {
        await this.loadLinks();
      }
    } finally {
      this.requesting.set(false);
    }
  }

  private async fetchPage(cursor: string | null): Promise<void> {
    this.message.set(null);
    this.searching.set(true);
    try {
      const page = await this.port.search(this.lastQuery, cursor);

      this.results.update(current => [...current, ...page.items]);
      this.nextCursor.set(page.nextCursor);
      this.searched.set(true);
    } catch (error) {
      this.message.set(this.searchError(error));
    } finally {
      this.searching.set(false);
    }
  }

  private async loadLinks(): Promise<void> {
    this.linksError.set(null);
    try {
      this.links.set(await this.port.list());
    } catch (error) {
      this.linksError.set(this.genericError(error, 'Não foi possível carregar seus vínculos.'));
    } finally {
      this.loadingLinks.set(false);
    }
  }

  private requestError(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : 0;

    if (status === 409) {
      return 'Já existe uma solicitação pendente ou vínculo aprovado com este hospital. Nenhuma solicitação duplicada foi criada.';
    }
    if (status === 404) {
      return 'Hospital não encontrado. Verifique o nome ou entre em contato com o suporte.';
    }

    return this.genericError(error, 'Não foi possível enviar a solicitação. Tente novamente.');
  }

  private searchError(error: unknown): string {
    return this.genericError(error, 'Não foi possível buscar hospitais. Tente novamente.');
  }

  private genericError(error: unknown, fallback: string): string {
    const status = error instanceof HttpErrorResponse ? error.status : 0;

    if (status === 401) {
      return 'Sua sessão expirou. Entre novamente.';
    }
    if (status === 403) {
      return 'Apenas profissionais podem solicitar acesso a hospitais.';
    }
    if (status === 400) {
      return 'Dados inválidos. Confira o nome do hospital e tente novamente.';
    }

    return fallback;
  }
}
