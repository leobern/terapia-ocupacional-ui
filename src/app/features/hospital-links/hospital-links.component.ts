import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { ACCESS_BLOCKED_PARAM, ACCESS_BLOCKED_VALUE } from './approved-hospital-link.guard';
import { HOSPITAL_LINK_STATUS_VIEW, HospitalLink } from './hospital-links.models';
import { HospitalLinksSource } from './hospital-links-source';

type LoadStatus = 'loading' | 'ready' | 'error';

/** Destino do botão de solicitar acesso (US-001-2-01; placeholder até a tela existir). */
export const REQUEST_HOSPITAL_LINK_URL = '/hospital-links/request';

/**
 * Tela de vínculos com hospitais (US-001-2-02). Sem desenho no Figma: montada só com
 * componentes do design system (desenho do agente, pendente de aprovação).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, PageContainerComponent, PageHeaderComponent, PhIconComponent],
  selector: 'app-hospital-links',
  styleUrl: './hospital-links.component.scss',
  templateUrl: './hospital-links.component.html',
})
export class HospitalLinksComponent implements OnInit {
  protected readonly status = signal<LoadStatus>('loading');
  protected readonly links = signal<readonly HospitalLink[]>([]);
  protected readonly statusView = HOSPITAL_LINK_STATUS_VIEW;

  /** Aviso só no redirecionamento do Painel Metabólico, não numa visita normal (RN03). */
  protected readonly accessBlocked =
    inject(ActivatedRoute).snapshot.queryParamMap.get(ACCESS_BLOCKED_PARAM) === ACCESS_BLOCKED_VALUE;

  private readonly source = inject(HospitalLinksSource);
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.status.set('loading');
    try {
      this.links.set((await this.source.list()).items);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  protected requestAccess(): void {
    void this.router.navigateByUrl(REQUEST_HOSPITAL_LINK_URL);
  }
}
