import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { NOW, ProfessionalProfileReader } from './professional-profile';

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
});

/** Cabeçalho da Home: foto/avatar e nome do profissional e a data por extenso. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent],
  selector: 'app-home-header',
  styleUrl: './home-header.component.scss',
  templateUrl: './home-header.component.html',
})
export class HomeHeaderComponent {
  readonly profile = inject(ProfessionalProfileReader).read();
  readonly name = this.profile.name;
  readonly photoUrl = this.profile.photoUrl ?? '';
  readonly avatarType = this.photoUrl ? 'photo' : 'user';
  readonly now = inject(NOW);
  readonly date = computed(() => DATE_FORMAT.format(this.now()));
}
