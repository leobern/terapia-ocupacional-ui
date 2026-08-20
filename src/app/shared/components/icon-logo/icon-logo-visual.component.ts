import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Os 4 visuais do component set Figma `4424:6180` (`State=`). Espelha o Figma 1:1 — a
 * tradução de semântica (o que é decorativo, o que é controle) fica nos dois componentes
 * públicos, não aqui (research.md §9).
 */
export type IconLogoVisualState = 'default' | 'anim' | 'button' | 'disabled';

/** Subconjunto exposto pelo componente decorativo público — `button` não faz sentido nele. */
export type IconLogoState = 'default' | 'anim' | 'disabled';

/**
 * Núcleo visual compartilhado do DS-component-icon-logo — **interno**, não exportado no
 * barrel público: instanciar diretamente não é suportado
 * (contracts/icon-logo.api.md § Fora do contrato).
 *
 * Dono de toda a pilha de camadas (`base` → `surface` → `blur` → `mesh` → luzes `anim`),
 * dos `mix-blend-mode`, da geometria da malha e da tabela de escala. Existe para que os dois
 * componentes públicos (`app-icon-logo` e `app-icon-logo-button`) compartilhem uma única
 * cópia do desenho — qualquer ajuste de fidelidade ao Figma acontece num só lugar.
 *
 * `lightsVisible` existe para o `:hover` do botão, que revela as 3 luzes **estáticas** (sem
 * órbita nem pulso) — o que diferencia o hover do estado `anim` (spec.md § Motion da
 * variante `button`).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-state]': 'state()',
    '[class.icon-logo--lights-visible]': 'lightsVisible()',
  },
  selector: 'app-icon-logo-visual',
  styleUrl: './icon-logo-visual.component.scss',
  templateUrl: './icon-logo-visual.component.html',
})
export class IconLogoVisualComponent {
  readonly state = input<IconLogoVisualState>('default');

  /** Revela as luzes sem animá-las (hover do botão). Ignorado quando `state === 'anim'`. */
  readonly lightsVisible = input<boolean>(false);
}
