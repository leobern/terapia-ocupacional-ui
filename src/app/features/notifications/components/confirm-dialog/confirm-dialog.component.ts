import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ButtonComponent } from '../../../../shared/components/button/button.component';

/**
 * Diálogo de confirmação de descarte de rascunho (FR-010a/FR-004b de
 * specs/004-notificacoes). Sem nó Figma de origem — nasceu de
 * `/speckit-clarify` (2026-08-17), não do fluxo analisado no Figma; desvio
 * documentado em plan.md § Constitution Check e research.md §7. Construído só
 * com tokens já catalogados (cor/tipografia/spacing/radius), reaproveitando
 * `app-button` para as duas ações.
 *
 * Escopo local desta feature (não um entry de design system compartilhado
 * ainda) — promover para `shared/components/` se um segundo consumidor
 * aparecer (research.md §7).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alertdialog', '[attr.aria-hidden]': '!open()' },
  imports: [ButtonComponent],
  selector: 'app-confirm-dialog',
  styleUrl: './confirm-dialog.component.scss',
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  readonly open = input.required<boolean>();
  readonly title = input<string>('Descartar resposta não enviada?');
  readonly confirmLabel = input<string>('Descartar');
  readonly cancelLabel = input<string>('Cancelar');

  readonly confirmed = output();
  readonly cancelled = output();
}
