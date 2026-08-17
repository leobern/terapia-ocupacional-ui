import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PhIconComponent } from '../../../../shared/icons/ph-icon/ph-icon.component';

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return '';
  }
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  const first = words[0].charAt(0);
  const last = words[words.length - 1].charAt(0);

  return (first + last).toUpperCase();
}

/**
 * Avatar: foto do usuário, ou substituto de iniciais quando não há foto
 * (FR-005b) — no máximo 2 letras (1ª palavra + última palavra do nome), ou 1
 * letra se houver apenas uma palavra. Visual e propriedades (canto de 24px
 * fixo, botão de trocar foto) espelham o componente "Avatar" do Figma
 * (node 4046:2289).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhIconComponent],
  selector: 'app-avatar',
  styleUrl: './avatar.component.scss',
  templateUrl: './avatar.component.html',
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly photoUrl = input<string | null>(null);
  readonly size = input<number>(56);

  /** Mostra o botão de trocar foto (Figma `btnPhoto`) — só quando o usuário pode alterar a própria foto. */
  readonly editable = input<boolean>(false);

  readonly changePhoto = output();

  protected readonly initials = computed(() => initialsFor(this.name()));
}
