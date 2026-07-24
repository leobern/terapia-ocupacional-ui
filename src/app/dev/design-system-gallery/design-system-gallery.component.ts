import { ChangeDetectionStrategy, Component } from '@angular/core';

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
export class DesignSystemGalleryComponent {}
