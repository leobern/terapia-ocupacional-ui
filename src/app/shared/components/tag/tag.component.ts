import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { AvatarComponent } from '../avatar/avatar.component';

/** Mapeia a propriedade Figma `Type` (specs/ds/DS-component-tag/spec.md). */
export type TagType = 'user' | 'default' | 'status';

/**
 * Tag de identificação compacta (DS-component-tag), com 3 anatomias distintas
 * selecionadas por `type` — mesmo padrão de `app-badge`. Nunca é interativa por si só
 * (sem foco, sem clique próprio — decisão confirmada em `/speckit-clarify`, sessão
 * 2026-07-24): se um consumidor precisar de comportamento clicável em `type="default"`,
 * envolve `<app-tag>` num elemento interativo próprio.
 *
 * `type="user"` compõe `app-avatar` internamente (`size="small"` `type="photo"`) e tem
 * fundo fixo `var(--color-surface)` — não existe prop `backgroundColor` para este type
 * (ajuste do usuário pós-criação da entry, spec.md § Changelog). `type="default"` tem
 * dois slots de ícone simultâneos (esquerdo/direito) com glifos e cores independentes —
 * por isso 4 props (`iconLeftName`/`iconLeftColor`/`iconRightName`/`iconRightColor`) em
 * vez de um único par `icon`/`iconColor` (research.md §2).
 *
 * O host É a caixa visual da tag (mesmo padrão de `app-badge`/`app-avatar`, sem
 * `display: contents`).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[style.background]': 'hostBackground()',
  },
  imports: [AvatarComponent, PhIconComponent],
  selector: 'app-tag',
  styleUrl: './tag.component.scss',
  templateUrl: './tag.component.html',
})
export class TagComponent {
  readonly type = input<TagType>('user');

  readonly label = input<string>('');

  // Só usado quando type="user" — repassado direto a app-avatar[imageUrl]
  // (fallback/iniciais delegados ao avatar, research.md §3).
  readonly avatarSrc = input<string>('');

  readonly iconLeft = input<boolean>(true);
  readonly iconRight = input<boolean>(true);

  // Inputs brutos nascem vazios ("sem override") — o glifo efetivo é resolvido pelos
  // computeds abaixo, porque o default de `iconRightName` varia com `type()`, algo que
  // `input<string>()` não expressa sozinho (research.md §2 nota técnica).
  readonly iconLeftName = input<string>('');
  readonly iconRightName = input<string>('');

  readonly iconLeftColor = input<string>('var(--color-content-3)');
  readonly iconRightColor = input<string>('var(--color-content-3)');

  // Só relevante para type="default"/"status" — sem efeito em type="user" (fundo
  // sempre var(--color-surface), ver hostBackground).
  readonly backgroundColor = input<string>('');

  protected readonly resolvedIconLeftName = computed(() => this.iconLeftName() || 'map-pin');

  protected readonly resolvedIconRightName = computed(
    () => this.iconRightName() || (this.type() === 'user' ? 'arrows-clockwise' : 'caret-down'),
  );

  protected readonly hostClass = computed(() => `tag tag--${this.type()}`);

  // type="user" tem fundo fixo via classe SCSS (FR-002/FR-002a) — sem binding aqui,
  // mesmo padrão do fundo fixo de type="numeral" em BadgeComponent.
  protected readonly hostBackground = computed(() => {
    switch (this.type()) {
      case 'default':
        return this.backgroundColor() || 'var(--color-tertiary)';
      case 'status':
        return this.backgroundColor() || 'var(--color-comm-success)';
      default:
        return null;
    }
  });
}
