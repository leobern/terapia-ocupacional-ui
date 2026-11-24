import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { BackgroundMeshComponent } from '../../shared/components/background-mesh/background-mesh.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconLogoComponent } from '../../shared/components/icon-logo/icon-logo.component';
import { I18nService } from '../../shared/services/i18n.service';
import { TutorialStateStore } from '../tutorial/tutorial-state';
import { WelcomeSource } from './welcome-source';

/**
 * Boas-vindas do primeiro acesso aprovado (US-001-3-01). Sem desenho no Figma (RN02:
 * a definir com Thiago): montada só com componentes do DS, pendente de aprovação.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BackgroundMeshComponent, ButtonComponent, IconLogoComponent],
  selector: 'app-welcome',
  styleUrl: './welcome.component.scss',
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly name = signal('');

  private readonly source = inject(WelcomeSource);
  private readonly router = inject(Router);
  private readonly tutorial = inject(TutorialStateStore);

  ngOnInit(): void {
    this.source.getStatus().then(
      status => {
        if (status.shouldShow) {
          this.name.set(status.name);
        } else {
          void this.router.navigateByUrl('/home', { replaceUrl: true });
        }
      },
      () => void this.router.navigateByUrl('/home', { replaceUrl: true }),
    );
  }

  protected startTutorial(): void {
    void this.finish('/tutorial', false);
  }

  protected goToApp(): void {
    void this.finish('/home', true);
  }

  /**
   * Conclui as boas-vindas. Quem vai direto ao app registra o tutorial como PULADO, para ele não
   * reaparecer na próxima abertura. Falha ao registrar nunca impede a navegação.
   */
  private async finish(url: string, skipTutorial: boolean): Promise<void> {
    try {
      await this.source.complete();
    } catch {
      // O médico segue mesmo assim; a próxima abertura tenta de novo.
    }
    if (skipTutorial) {
      try {
        await this.tutorial.register('PULADO');
      } catch {
        // Idem: o tutorial ainda pode aparecer na próxima abertura.
      }
    }
    await this.router.navigateByUrl(url, { replaceUrl: true });
  }
}
