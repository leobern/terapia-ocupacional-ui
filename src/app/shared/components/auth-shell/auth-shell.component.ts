import { ChangeDetectionStrategy, Component, inject, input, ViewEncapsulation } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { type Theme, ThemeService } from '../../services/theme.service';
import { IconLogoComponent } from '../icon-logo/icon-logo.component';

/**
 * Moldura das telas de acesso (login, convite, recuperação de senha, MFA), Figma "Conductia - V1" seção 12:
 * card `surface` de raio 40 sobre o gradiente da Home, cabeçalho com o logo (e, nas primeiras telas, o nome
 * "Conductia" centralizado com divisor), título + texto e o alternador claro/escuro (canto superior direito no
 * desktop, base centralizada no mobile).
 *
 * Padrão de ações (`.auth-actions`): no desktop os botões ficam na mesma linha, largura do conteúdo, um em cada
 * ponta (secundário/link à esquerda, primário à direita); no mobile ocupam 100% da largura, um sob o outro, com o
 * primário em cima. No HTML, escreva sempre o secundário/link antes do primário.
 *
 * Sem encapsulamento: os estilos de campo e de ações (`.auth-field`, `.auth-actions`, `.auth-link`) valem para o
 * conteúdo projetado.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [IconLogoComponent, PhIconComponent],
  selector: 'app-auth-shell',
  styleUrl: './auth-shell.component.scss',
  templateUrl: './auth-shell.component.html',
})
export class AuthShellComponent {
  /** Mostra o nome "Conductia" ao lado do logo (login e convite); nas demais telas fica só o ícone. */
  readonly brand = input<boolean>(false);
  readonly title = input<string>('');
  readonly text = input<string>('');
  /** O texto é um resultado (ex.: e-mail enviado): leitores de tela anunciam como status. */
  readonly statusText = input<boolean>(false);

  protected readonly themeService = inject(ThemeService);
  protected readonly themes: readonly { readonly icon: string; readonly label: string; readonly value: Theme }[] = [
    { icon: 'sun-dim', label: 'Tema claro', value: 'light' },
    { icon: 'moon', label: 'Tema escuro', value: 'dark' },
  ];
}
