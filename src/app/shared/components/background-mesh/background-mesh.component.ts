import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Fundo decorativo puramente visual (DS-component-background-mesh): 3 círculos de cor
 * (blur) no canto superior-esquerdo + 1 mesh estático (malha SVG com gradiente radial)
 * no canto inferior-direito. Não interativo, não composicional — nenhum outro componente do
 * design system é reaproveitado aqui (data-model.md). As 4 cores são hex cru por decisão
 * explícita de produto (spec.md § Clarifications, 2026-07-25) — nenhum token do DS nesta v1.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.background-mesh--without-third-blob-desktop]': '!showColor3Desktop()',
  },
  selector: 'app-background-mesh',
  styleUrl: './background-mesh.component.scss',
  templateUrl: './background-mesh.component.html',
})
export class BackgroundMeshComponent {
  // Figma "Conductia - V1", componente `background`: 3 círculos com blur 200 (CSS blur(100px))
  // — color-1 verde (menor), color-2 ciano (topo) e color-3 azul-marinho (centro). O contêiner
  // muda de blend/opacidade conforme o tema (ver SCSS).
  readonly color1 = input<string>('#0d7742');
  readonly color2 = input<string>('#a6fbfb');
  readonly color3 = input<string>('#004466');
  // Ocultam o círculo correspondente sem remover a prop de cor.
  readonly showColor1 = input<boolean>(true);
  readonly showColor2 = input<boolean>(true);
  readonly showColor3 = input<boolean>(true);
  /** Figma (Notificações, desktop): o círculo azul-marinho não aparece em ≥1200px. */
  readonly showColor3Desktop = input<boolean>(true);
  readonly meshGradientCoreColor = input<string>('#ABB3BA');
  readonly meshGradientEdgeColor = input<string>('#4D5154');
}
