import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';

/**
 * Card de estado vazio das seções da tela do Paciente (Thiago, 2026-11-25): sem botão de editar no título nem campos
 * abertos; só uma legenda convidando a cadastrar ("Toque aqui e insira o diagnóstico"). Tocar abre o cadastro.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhIconComponent],
  selector: 'app-empty-card',
  styleUrl: './empty-card.component.scss',
  template: `
    <button type="button" class="empty-card" [disabled]="disabled()" (click)="activate.emit()">
      <ph-icon name="plus" [size]="24" />
      <span class="empty-card__text">{{ text() }}</span>
    </button>
  `,
})
export class EmptyCardComponent {
  readonly text = input.required<string>();
  /** Somente leitura (data anterior): o card só informa que não há registro. */
  readonly disabled = input(false);
  readonly activate = output();
}
