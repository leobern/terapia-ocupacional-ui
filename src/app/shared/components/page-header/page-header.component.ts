import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { BadgeComponent } from '../badge/badge.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/**
 * Cabeçalho padrão das telas (Figma `v2/PageHeader`, 4598:1584): [voltar] ícone + título, subtítulo,
 * ações da tela (conteúdo projetado), sino opcional e o botão de atalhos.
 *
 * - `back`: tela interna. O botão de voltar (tonal) fica alinhado à esquerda do conteúdo, sem o recuo de
 *   16px que as telas iniciais usam no desktop.
 * - O botão de atalhos (abre a sidebar no desktop) é de TODA tela. No mobile ele não aparece aqui porque
 *   a barra inferior já traz o mesmo atalho.
 * - `showBell`: só nas primeiras telas de uma área (no mobile o sino fica; o atalho está na barra).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.page-header--back]': 'back()' },
  imports: [BadgeComponent, IconButtonComponent, PhIconComponent],
  selector: 'app-page-header',
  styleUrl: './page-header.component.scss',
  templateUrl: './page-header.component.html',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Nome do ícone Phosphor de título (24px, sólido, cor secundária); `null` = sem ícone. */
  readonly icon = input<string | null>(null);
  readonly back = input(false);
  readonly backLabel = input('Voltar');
  readonly showBell = input(false);
  readonly unreadCount = input(0);
  readonly bellLabel = input('Notificações');
  readonly backClick = output();
  readonly bellClick = output();

  protected readonly assistant = inject(AiAssistantService);

  /** Partes do subtítulo ("Hospital · data"): no mobile cada parte ocupa uma linha (Figma 4601:1644). */
  protected readonly subtitleParts = computed(() => (this.subtitle() ?? '').split(' · '));
}
