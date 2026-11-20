import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { HospitalContextService } from '../home/hospital-context.service';
import { NutritionPanelComponent } from './nutrition-panel/nutrition-panel.component';
import { NutritionValues } from './nutrition-panel/nutrition-panel.models';
import { NutritionResultsSource } from './nutrition-panel/nutrition-results-source';

const PULL_THRESHOLD = 80;

/** Voltar a ficar visível recarrega o painel; oculto não (mesmo padrão da listagem; sem polling/stream). */
export function reloadsOnVisibility(state: DocumentVisibilityState): boolean {
  return state === 'visible';
}

function formatToday(date: Date): string {
  const text = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Hub do paciente (FT-004-2/004-3). Nesta etapa hospeda só o Painel Nutricional; hipótese,
 * equipe, avaliação, prescrição e evoluções pertencem a outras stories.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, NutritionPanelComponent, PageContainerComponent],
  host: {
    '(window:focus)': 'reload()',
    '(document:visibilitychange)': 'onVisibility()',
    '(touchstart)': 'pullStart($event)',
    '(touchend)': 'pullEnd($event)',
  },
  selector: 'app-patient-hub',
  styleUrl: './patient-hub.component.scss',
  templateUrl: './patient-hub.component.html',
})
export class PatientHubComponent implements OnInit {
  protected readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
  protected readonly todayLabel = formatToday(new Date());

  protected readonly values = signal<NutritionValues>({});

  private readonly context = inject(HospitalContextService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly source = inject(NutritionResultsSource);
  private pullFrom: number | null = null;

  ngOnInit(): void {
    void this.reload();
  }

  /** Recarrega todos os resultados; se falhar (ou offline), mantém os valores já exibidos. */
  async reload(): Promise<void> {
    try {
      this.values.set(await this.source.load(this.route.snapshot.paramMap.get('id') ?? ''));
    } catch {
      // mantém os valores atuais
    }
  }

  protected onVisibility(): void {
    if (reloadsOnVisibility(document.visibilityState)) {
      void this.reload();
    }
  }

  protected pullStart(event: TouchEvent): void {
    this.pullFrom = window.scrollY <= 0 ? event.touches[0].clientY : null;
  }

  protected pullEnd(event: TouchEvent): void {
    const from = this.pullFrom;

    this.pullFrom = null;
    if (from !== null && event.changedTouches[0].clientY - from > PULL_THRESHOLD) {
      void this.reload();
    }
  }

  protected goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/patients']);
    }
  }
}
