import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { AdminHospital, InviteResult, ROLE_LABELS, UserRole } from './administration.models';
import { AdministrationApi } from './administration-api';
import { SidePanelComponent } from './side-panel.component';

/** E-mail simples: um `@`, sem espaços e com ponto no domínio. */
function isEmail(value: string): boolean {
  const parts = value.split('@');

  return parts.length === 2 && parts[0] !== '' && parts[1].includes('.') && !value.includes(' ');
}

/**
 * Convidar pessoa (Figma Equipe · Desktop · 3 e 4; mobile em bottom sheet): e-mail, papel e hospitais, em cards.
 * Quem já tem conta ganha só o vínculo; quem não tem recebe um link de uso único (7 dias) que pode copiar.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SidePanelComponent],
  selector: 'app-invite-panel',
  styleUrl: './invite-panel.component.scss',
  templateUrl: './invite-panel.component.html',
})
export class InvitePanelComponent {
  readonly open = input.required<boolean>();
  readonly closed = output();
  /** Emitido ao concluir (para a lista recarregar). */
  readonly done = output();

  readonly email = signal('');
  readonly role = signal<UserRole>('TERAPEUTA');
  readonly selected = signal<readonly number[]>([]);
  readonly hospitals = signal<readonly AdminHospital[]>([]);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<InviteResult | null>(null);
  readonly copied = signal(false);

  readonly roles = computed<readonly { readonly key: UserRole; readonly label: string }[]>(() =>
    (Object.keys(ROLE_LABELS) as UserRole[])
      .filter(key => this.isAdmin || (key !== 'ADMIN' && key !== 'GESTOR'))
      .map(key => ({ key, label: ROLE_LABELS[key] })),
  );
  readonly canSubmit = computed(() => isEmail(this.email().trim()) && this.selected().length > 0 && !this.submitting());

  private readonly api = inject(AdministrationApi);
  private readonly isAdmin = inject(SessionRoleReader).read() === Role.ADMIN;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.reset();
        void this.loadHospitals();
      }
    });
  }

  onEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  toggle(id: number): void {
    this.selected.update(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      this.result.set(
        await this.api.invite({
          email: this.email().trim(),
          hospitalIds: this.selected(),
          papel: this.role(),
          papelHospital: this.role() === 'GESTOR' ? 'GESTOR' : 'PROFISSIONAL',
        }),
      );
      this.done.emit();
    } catch (error) {
      this.error.set(this.messageOf(error));
    } finally {
      this.submitting.set(false);
    }
  }

  async copy(): Promise<void> {
    const link = this.result()?.link;

    if (link) {
      await navigator.clipboard.writeText(link);
      this.copied.set(true);
    }
  }

  another(): void {
    this.reset();
  }

  private reset(): void {
    this.email.set('');
    this.role.set('TERAPEUTA');
    this.selected.set([]);
    this.result.set(null);
    this.error.set(null);
    this.copied.set(false);
  }

  private async loadHospitals(): Promise<void> {
    try {
      this.hospitals.set((await this.api.listHospitals()).filter(h => h.ativo));
    } catch {
      this.error.set('Não foi possível carregar os hospitais.');
    }
  }

  private messageOf(error: unknown): string {
    const status = (error as { status?: number }).status;

    if (status === 409) {
      return 'Já existe um convite pendente para este e-mail. Reenvie ou cancele pela lista.';
    }

    return status === 403
      ? 'Você não pode convidar neste hospital ou com este papel.'
      : 'Não foi possível enviar o convite. Tente novamente.';
  }
}
