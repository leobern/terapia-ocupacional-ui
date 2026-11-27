import { ChangeDetectionStrategy, Component, inject, input, model, signal, ViewEncapsulation } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { I18nService } from '../../services/i18n.service';

/**
 * Campo de senha das telas de acesso com botão de mostrar/ocultar (ícones Phosphor `eye-closed` com a senha oculta e `eye` com ela à mostra).
 * Visual do campo é o `.auth-field__input` do `app-auth-shell` (estilos globais, por isso sem encapsulamento).
 * O botão fica fora da ordem de leitura do campo mas é focável (Tab) e informa o estado com `aria-pressed`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [PhIconComponent],
  selector: 'app-password-field',
  template: `
    <div class="auth-field__password">
      <input
        class="auth-field__input"
        autocapitalize="none"
        spellcheck="false"
        [id]="inputId()"
        [type]="visible() ? 'text' : 'password'"
        [name]="name()"
        [attr.autocomplete]="autocomplete()"
        [value]="value()"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-describedby]="describedBy()"
        (input)="value.set($any($event.target).value)"
      />
      <button
        type="button"
        class="auth-field__toggle"
        [attr.aria-pressed]="visible()"
        [attr.aria-controls]="inputId()"
        [attr.aria-label]="i18n.t(visible() ? 'password.hide' : 'password.show')"
        (click)="visible.set(!visible())"
      >
        <ph-icon [name]="visible() ? 'eye' : 'eye-closed'" [size]="20" />
      </button>
    </div>
  `,
})
export class PasswordFieldComponent {
  readonly inputId = input.required<string>();
  readonly name = input<string>('password');
  readonly autocomplete = input<string>('current-password');
  readonly invalid = input<boolean>(false);
  readonly describedBy = input<string | null>(null);
  readonly value = model<string>('');

  protected readonly i18n = inject(I18nService);
  protected readonly visible = signal(false);
}
