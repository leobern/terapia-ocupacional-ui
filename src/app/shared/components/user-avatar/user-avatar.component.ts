import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { UserPhotoService } from '../../services/user-photo.service';
import { AvatarComponent, AvatarSize } from '../avatar/avatar.component';

/** Avatar de uma pessoa da equipe: foto baixada com a sessão (se existir) ou iniciais. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent],
  selector: 'app-user-avatar',
  template: `<app-avatar [size]="size()" [type]="url() ? 'photo' : 'user'" [imageUrl]="url() ?? ''" [name]="name()" />`,
})
export class UserAvatarComponent {
  readonly userId = input<number | null>(null);
  readonly name = input<string>('');
  /** `false` evita a requisição quando já se sabe que não há foto. */
  readonly hasPhoto = input<boolean>(true);
  readonly size = input<AvatarSize>('medium');

  protected readonly url = signal<string | null>(null);

  private readonly photos = inject(UserPhotoService);

  constructor() {
    effect(onCleanup => {
      const id = this.userId();
      const wanted = this.hasPhoto();
      let alive = true;

      this.photos.version();
      if (id === null || !wanted) {
        this.url.set(null);

        return;
      }
      void this.photos.url(id).then(value => {
        if (alive) {
          this.url.set(value);
        }
      });
      onCleanup(() => {
        alive = false;
      });
    });
  }
}
