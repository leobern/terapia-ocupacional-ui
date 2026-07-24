import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { InputSelectComponent } from '../../shared/components/input-select/input-select.component';

/**
 * Página de desenvolvimento — não faz parte do produto. Renderiza os
 * componentes do design system (`specs/ds/DS-*`) em todas as combinações
 * relevantes, para testar visualmente e por teclado antes de uma feature
 * consumi-los. Cresce junto com novos componentes (`input-select` etc.) —
 * uma seção por componente.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, BadgeComponent, ButtonComponent, IconButtonComponent, InputSelectComponent],
  selector: 'app-design-system-gallery',
  styleUrl: './design-system-gallery.component.scss',
  templateUrl: './design-system-gallery.component.html',
})
export class DesignSystemGalleryComponent {
  // Signals com estado real (não apenas valores estáticos) para TODAS as
  // instâncias de input-select responderem de verdade a digitação/clear
  // durante teste manual — um componente de apresentação puro só reage a
  // `valueChange` se algo realmente escutar e atualizar o valor de volta.
  // Sem isso, clicar no clear (ou digitar) em qualquer instância "estática"
  // da galeria não tem efeito visível nenhum — o componente já emite
  // corretamente, só não há ninguém ouvindo.
  protected readonly demoTextFilledValue = signal('thiago.angelito@gmail.com');
  protected readonly demoSelectFilledValue = signal('thiago.angelito@gmail.com');
  protected readonly demoTruncatedValue = signal(
    'um.email.bem.mais.longo.do.que.o.espaco.disponivel.para.caber@example.com',
  );
  protected readonly demoEmailFocusValue = signal('thiago.angelito@gmail.com');
  protected readonly demoSelectFocusValue = signal('');
}
