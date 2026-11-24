import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { I18nService } from '../../shared/services/i18n.service';
import { TutorialResult, TutorialStateStore } from './tutorial-state';
import { TUTORIAL_STEPS } from './tutorial-steps';

/**
 * Tutorial do app (US-001-3-02). Primeiro acesso: registra o resultado e segue ao Painel
 * Metabólico. Revisão (`data.review`, rota das configurações): não registra e volta às configurações.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, PhIconComponent],
  selector: 'app-tutorial',
  styleUrl: './tutorial.component.scss',
  templateUrl: './tutorial.component.html',
})
export class TutorialComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly steps = TUTORIAL_STEPS;
  protected readonly index = signal(0);
  protected readonly step = computed(() => this.steps[this.index()]);
  protected readonly isFirst = computed(() => this.index() === 0);
  protected readonly isLast = computed(() => this.index() === this.steps.length - 1);

  private readonly store = inject(TutorialStateStore);
  private readonly router = inject(Router);
  private readonly review = inject(ActivatedRoute).snapshot.data['review'] === true;

  protected next(): void {
    if (this.isLast()) {
      void this.leave('CONCLUIDO');
    } else {
      this.index.update(i => i + 1);
    }
  }

  protected back(): void {
    this.index.update(i => Math.max(0, i - 1));
  }

  protected skip(): void {
    void this.leave('PULADO');
  }

  private async leave(result: TutorialResult): Promise<void> {
    if (!this.review) {
      // Falha ao registrar nunca impede o médico de seguir.
      await this.store.register(result).catch(() => undefined);
    }

    await this.router.navigateByUrl(this.review ? '/settings' : '/home', { replaceUrl: true });
  }
}
