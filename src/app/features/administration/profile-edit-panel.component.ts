import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { UserPhotoService } from '../../shared/services/user-photo.service';
import { AdministrationApi } from './administration-api';
import { SidePanelComponent } from './side-panel.component';

/** Dados que o painel precisa para editar o perfil (subconjunto da tela de detalhe). */
export interface EditableProfile {
  readonly id: number;
  readonly name: string;
  readonly specialty: string | null;
  readonly phone: string | null;
  readonly registry: string | null;
  readonly hasPhoto: boolean;
}

/** Editar o meu perfil: nome, especialidade, telefone, registro profissional e foto (JPEG, PNG ou WebP, até 2 MB). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SidePanelComponent, UserAvatarComponent],
  selector: 'app-profile-edit-panel',
  styleUrl: './profile-edit-panel.component.scss',
  templateUrl: './profile-edit-panel.component.html',
})
export class ProfileEditPanelComponent {
  readonly open = input.required<boolean>();
  readonly profile = input<EditableProfile | null>(null);
  readonly closed = output();
  readonly saved = output();

  readonly name = signal('');
  readonly specialty = signal('');
  readonly phone = signal('');
  readonly registry = signal('');
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly hasPhoto = signal(false);

  private readonly api = inject(AdministrationApi);
  private readonly photos = inject(UserPhotoService);

  constructor() {
    effect(() => {
      const current = this.profile();

      if (this.open() && current) {
        this.name.set(current.name);
        this.specialty.set(current.specialty ?? '');
        this.phone.set(current.phone ?? '');
        this.registry.set(current.registry ?? '');
        this.hasPhoto.set(current.hasPhoto);
        this.error.set(null);
      }
    });
  }

  id(): number | null {
    return this.profile()?.id ?? null;
  }

  onText(target: 'name' | 'specialty' | 'phone' | 'registry', event: Event): void {
    this[target].set((event.target as HTMLInputElement).value);
  }

  async onFile(event: Event): Promise<void> {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];

    if (!file) {
      return;
    }
    const problem = this.photos.validate(file);

    if (problem) {
      this.error.set(problem);

      return;
    }
    this.error.set(null);
    try {
      await this.photos.upload(file);
      this.hasPhoto.set(true);
    } catch {
      this.error.set('Não foi possível enviar a foto. Tente novamente.');
    } finally {
      field.value = '';
    }
  }

  async removePhoto(): Promise<void> {
    try {
      await this.photos.remove();
      this.hasPhoto.set(false);
    } catch {
      this.error.set('Não foi possível remover a foto.');
    }
  }

  async save(): Promise<void> {
    if (this.name().trim() === '') {
      this.error.set('Informe o seu nome.');

      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.api.saveProfile({
        especialidade: this.specialty(),
        nomeCompleto: this.name(),
        registroProfissional: this.registry(),
        telefone: this.phone(),
      });
      this.saved.emit();
    } catch {
      this.error.set('Não foi possível salvar. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }
}
