import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';

/** Figma `v2/Banner`: `warning` (amarelo) e `info` (azul). */
export type BannerType = 'warning' | 'info';

/** Ícone padrão de cada tipo; qualquer tipo aceita trocar o ícone via `icon`. */
const DEFAULT_ICON: Readonly<Record<BannerType, string>> = {
  info: 'check-circle',
  warning: 'warning-diamond',
};

/**
 * Aviso em linha (Figma `v2/Banner`, mesmo visual do toast): fundo e texto conforme o tipo, ícone de 20px que pode
 * ser trocado. `warning` usa `comm-warning` com `fixed/on-warning` (texto escuro nos dois temas, para manter o
 * contraste); `info` usa `secondary` com `content-6`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.banner--info]': 'type() === "info"',
    '[class.banner--warning]': 'type() === "warning"',
    '[attr.role]': 'type() === "warning" ? "alert" : "status"',
  },
  imports: [PhIconComponent],
  selector: 'app-banner',
  styleUrl: './banner.component.scss',
  template: `
    <ph-icon class="banner__icon" [name]="iconName()" [size]="20" />
    <span class="banner__text"><ng-content /></span>
  `,
})
export class BannerComponent {
  readonly type = input<BannerType>('info');
  readonly icon = input<string | null>(null);

  protected readonly iconName = computed(() => this.icon() ?? DEFAULT_ICON[this.type()]);
}
