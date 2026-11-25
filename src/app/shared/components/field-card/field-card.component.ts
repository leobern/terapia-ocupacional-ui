import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Card de campo dos editores no painel lateral (Figma 4775:27490, v2/FormField): título, campo de 48px com a unidade
 * dentro dele (ou lista de opções), legenda ou erro opcionais e, por projeção, controles extras abaixo do campo.
 * Um por linha no painel; replica-se em qualquer editor (Thiago, 2026-11-25).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-field-card',
  styleUrl: './field-card.component.scss',
  templateUrl: './field-card.component.html',
})
export class FieldCardComponent {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly value = input('');
  readonly unit = input('');
  readonly placeholder = input('');
  readonly inputMode = input<'decimal' | 'text'>('text');
  /** Lista de opções: o campo vira uma seleção. */
  readonly options = input<readonly string[] | null>(null);
  /** Linhas de uma área de texto (0 = campo de uma linha). */
  readonly rows = input(0);
  readonly maxLength = input<number | null>(null);
  readonly caption = input('');
  readonly error = input('');

  readonly valueChange = output<string>();

  protected read(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }
}
