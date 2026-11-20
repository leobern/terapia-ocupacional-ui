import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { HospitalContextService } from '../home/hospital-context.service';
import { NutritionPanelComponent } from './nutrition-panel/nutrition-panel.component';

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
  selector: 'app-patient-hub',
  styleUrl: './patient-hub.component.scss',
  templateUrl: './patient-hub.component.html',
})
export class PatientHubComponent {
  protected readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
  protected readonly todayLabel = formatToday(new Date());

  private readonly context = inject(HospitalContextService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/patients']);
    }
  }
}
