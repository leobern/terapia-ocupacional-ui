import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Fundo decorativo puramente visual (DS-component-background-mesh): 2 blobs de cor
 * flutuantes no canto superior-esquerdo + 1 mesh estático (malha SVG com gradiente radial)
 * no canto inferior-direito. Não interativo, não composicional — nenhum outro componente do
 * design system é reaproveitado aqui (data-model.md). As 4 cores são hex cru por decisão
 * explícita de produto (spec.md § Clarifications, 2026-07-25) — nenhum token do DS nesta v1.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  selector: 'app-background-mesh',
  styleUrl: './background-mesh.component.scss',
  templateUrl: './background-mesh.component.html',
})
export class BackgroundMeshComponent {
  readonly color1 = input<string>('#D3FFE9');
  readonly color2 = input<string>('#a6fbfb');
  // Ocultam o blob correspondente sem remover a prop de cor (2026-08-17,
  // specs/004-notificacoes) — ver DS-component-background-mesh § Variantes & Props.
  readonly showColor1 = input<boolean>(true);
  readonly showColor2 = input<boolean>(true);
  readonly meshGradientCoreColor = input<string>('#ABB3BA');
  readonly meshGradientEdgeColor = input<string>('#4D5154');
}
