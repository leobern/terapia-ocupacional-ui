import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { AvatarComponent, AvatarType } from '../avatar/avatar.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/** Única variação suportada nesta v1 (nó Figma `4041:1490`). Variante `desktop` fica para uma evolução futura deste entry. */
export type CardNotifySize = 'mobile';

/**
 * Card de resumo de notificação (DS-component-card-notify). Composicional: renderiza
 * `app-avatar` (autor) e `app-icon-button` (CTA) sem reimplementar nenhum dos dois
 * (specs/ds/DS-component-card-notify/research.md §1). A prop `time` é tratada como
 * string opaca já formatada — nenhuma lógica de data/hora aqui (spec.md FR-007).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconButtonComponent, PhIconComponent],
  selector: 'app-card-notify',
  styleUrl: './card-notify.component.scss',
  templateUrl: './card-notify.component.html',
})
export class CardNotifyComponent {
  readonly size = input<CardNotifySize>('mobile');
  readonly authorName = input.required<string>();
  readonly authorSpecialty = input.required<string>();
  readonly authorPhotoUrl = input<string | null>(null);
  readonly description = input.required<string>();
  readonly time = input.required<string>();
  readonly actionAriaLabel = input.required<string>();
  readonly actionDisabled = input<boolean>(false);

  // Área de toque estendida (2026-07-26, pedido do usuário, mesmo padrão de
  // card-patients): o card inteiro é clicável, não só o `icon-button` interno
  // — melhora usabilidade de toque em mobile. Emitido a partir de um único
  // `(click)` no `<article>` raiz (o clique no `icon-button` interno já
  // borbulha até lá nativamente, então não há binding duplicado nele).
  // Deliberadamente NÃO torna o `<article>` focável/`role="button"` — o único
  // controle acessível por teclado continua sendo o `icon-button` interno,
  // evitando o anti-padrão de dois elementos interativos aninhados (um
  // focável dentro do outro) que confundiria navegação por teclado/leitor de
  // tela.
  readonly cardClick = output();

  // research.md §1: `avatar` é o de shared/components/ (design system), não o
  // local da feature `home` — decide type='photo' vs 'user' a partir da
  // presença de foto, mesmo padrão de qualquer outro consumidor do avatar.
  protected readonly avatarType = computed<AvatarType>(() => (this.authorPhotoUrl() ? 'photo' : 'user'));

  protected onCardClick(): void {
    if (!this.actionDisabled()) {
      this.cardClick.emit();
    }
  }
}
