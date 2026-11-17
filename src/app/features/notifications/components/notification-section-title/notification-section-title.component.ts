import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Título de seção da lista de Notificações (FR-004a) — hoje usado só para
 * "Resolvidas", o único título visível na tela (a seção Pendentes não tem
 * cabeçalho). Figma node: `4496:11857` (nó `title` dentro de `list`).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-notification-section-title',
  styleUrl: './notification-section-title.component.scss',
  templateUrl: './notification-section-title.component.html',
})
export class NotificationSectionTitleComponent {
  readonly label = input.required<string>();
}
