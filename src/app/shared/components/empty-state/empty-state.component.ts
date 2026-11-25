import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ButtonComponent } from '../button/button.component';

let nextId = 0;

/**
 * Cartão de estado vazio de tela inteira (Thiago, 2026-11-25): 600px de largura no máximo, centrado, com 40px de
 * padding, ilustração, título, texto e o CTA principal. Usado em "Você ainda não tem vínculos" e na Home sem hospital.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  selector: 'app-empty-state',
  styleUrl: './empty-state.component.scss',
  template: `
    <section class="empty-state" [attr.aria-labelledby]="titleId">
      <svg class="empty-state__art" viewBox="0 0 160 120" aria-hidden="true" focusable="false">
        <ellipse class="empty-state__ground" cx="80" cy="108" rx="62" ry="8" />
        <circle class="empty-state__halo" cx="80" cy="58" r="50" />
        <rect class="empty-state__side" x="30" y="52" width="28" height="52" rx="4" />
        <rect class="empty-state__side" x="102" y="52" width="28" height="52" rx="4" />
        <rect class="empty-state__building" x="48" y="30" width="64" height="74" rx="6" />
        <rect class="empty-state__door" x="70" y="80" width="20" height="24" rx="3" />
        <g class="empty-state__windows">
          <rect x="56" y="62" width="12" height="10" rx="2" />
          <rect x="74" y="62" width="12" height="10" rx="2" />
          <rect x="92" y="62" width="12" height="10" rx="2" />
        </g>
        <circle class="empty-state__badge" cx="80" cy="30" r="16" />
        <path class="empty-state__cross" d="M80 22v16M72 30h16" />
      </svg>
      <h2 class="empty-state__title" [id]="titleId">{{ title() }}</h2>
      @if (hint()) {
        <p class="empty-state__hint">{{ hint() }}</p>
      }
      <app-button size="lg" iconLeft="plus" [label]="actionLabel()" (click)="action.emit()" />
    </section>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly actionLabel = input.required<string>();
  readonly action = output();

  protected readonly titleId = `empty-state-title-${nextId++}`;
}
