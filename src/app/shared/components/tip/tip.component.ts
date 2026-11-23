import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Chip de atalho/sugestão (Figma `v2/Chip`, "tip"): contorno secundário de 1,5px, raio 12, texto Medium 14.
 * Largura pelo conteúdo; quando passa da largura disponível o texto quebra em várias linhas.
 * Todo atalho da plataforma (ações da tela, perguntas rápidas, sugestões da IA) usa este componente.
 * O clique é do host: `<app-tip label="..." (click)="..." />`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-tip',
  styleUrl: './tip.component.scss',
  template: `<button type="button" class="tip" [disabled]="disabled()">{{ label() }}</button>`,
})
export class TipComponent {
  readonly label = input.required<string>();
  readonly disabled = input(false);
}
