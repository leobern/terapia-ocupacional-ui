import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { BadgeComponent } from '../badge/badge.component';

/** Mapeia a propriedade Figma `Size` (specs/ds/DS-component-avatar/spec.md). */
export type AvatarSize = 'small' | 'default' | 'big';

/** Mapeia a propriedade Figma `Type` (specs/ds/DS-component-avatar/spec.md). */
export type AvatarType = 'photo' | 'user' | 'patient';

/**
 * Avatar de identificação de pessoa (DS-component-avatar) — foto ou iniciais, em 3
 * tamanhos, com um badge de edição composto dinamicamente a partir de `app-badge`
 * (DS-component-badge, variante `icon`) quando `editable=true` e `size` não é
 * `"small"` (FR-006/FR-007 — `small` nunca tem badge, regra do próprio componente).
 *
 * Quando editável, TODA a circunferência do avatar (não só o badge, que é só um
 * indicador visual) vira o alvo de clique/teclado — o `<button>` envolve o conteúdo
 * inteiro (foto/iniciais), e o badge fica sobreposto como decoração
 * (`pointer-events: none`, `aria-hidden`), sem alvo de clique próprio.
 *
 * O host É a caixa visual do avatar (mesmo padrão de `app-badge`, sem
 * `display: contents`) — não é um controle interativo (sem foco/clique próprio); quem
 * é focável/clicável é o `<button>` interno, só quando `showEditBadge()` é `true`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
  },
  imports: [BadgeComponent, NgTemplateOutlet],
  selector: 'app-avatar',
  styleUrl: './avatar.component.scss',
  templateUrl: './avatar.component.html',
})
export class AvatarComponent {
  readonly size = input<AvatarSize>('default');
  readonly type = input<AvatarType>('user');

  // Só usado quando type="photo".
  readonly imageUrl = input<string>('');

  // Usado para calcular `initials()` quando type="user"|"patient". Ausência/erro
  // resolve para "--" (FR-004).
  readonly name = input<string | null>(null);

  // Habilita o badge de edição — neutralizado em size="small" (ver `showEditBadge`).
  readonly editable = input<boolean>(false);

  // Nome acessível do controle de edição — o `<button>` que envolve TODO o conteúdo
  // do avatar (não só o badge, que é decorativo) quando `showEditBadge()` é `true`.
  readonly editAriaLabel = input<string>('Editar foto');

  // Emitido ao ativar o controle de edição (clique ou teclado em qualquer ponto da
  // circunferência do avatar). O avatar não decide o que acontece (abrir seletor de
  // arquivo, menu de inserir/editar/excluir) — isso é responsabilidade do consumidor
  // (spec.md § Fora de escopo do contrato).
  readonly editPhoto = output();

  // FR-003: cor de fundo fixa por type (`avatar--user`/`avatar--patient`) é aplicada
  // via classe SCSS (avatar.component.scss), não bindada aqui — mesmo padrão do
  // fundo fixo de `type="numeral"` em BadgeComponent.
  protected readonly hostClass = computed(() => `avatar avatar--${this.size()} avatar--${this.type()}`);

  // FR-004/FR-005: no máximo 2 caracteres, no mínimo 1 (exceto o valor de erro "--"),
  // sempre em caixa alta. Qualquer erro de processamento cai no fallback "--".
  protected readonly initials = computed(() => {
    try {
      const terms = (this.name() ?? '').trim().split(/\s+/).filter(Boolean);

      if (terms.length === 0) {
        return '--';
      }

      if (terms.length === 1) {
        return terms[0].charAt(0).toUpperCase();
      }

      const first = terms[0].charAt(0);
      const last = terms[terms.length - 1].charAt(0);

      return `${first}${last}`.toUpperCase();
    } catch {
      return '--';
    }
  });

  // FR-006/FR-007: badge de edição nunca aparece em size="small", mesmo com
  // editable=true — regra do componente, não delegada ao consumidor.
  protected readonly showEditBadge = computed(() => this.editable() && this.size() !== 'small');
}
