import { ChangeDetectionStrategy, Component, computed, inject, type OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { validatePassword } from '../../shared/auth/password-policy';
import { AuthShellComponent } from '../../shared/components/auth-shell/auth-shell.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';
import { I18nService } from '../../shared/services/i18n.service';
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '../../shared/services/user-photo.service';
import { InviteGateway, InvitePhoto, InviteSummary } from './invite-gateway';

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (): void => resolve(String(reader.result));
    reader.onerror = (): void => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

/** Etapas da conversa de cadastro. */
export type InviteStep = 'loading' | 'invalid' | 'name' | 'photo' | 'password' | 'confirm' | 'submitting';

interface ChatMessage {
  readonly from: 'bot' | 'user';
  readonly text: string;
}

const ROLE_TEXT: Readonly<Record<string, string>> = {
  ADMIN: 'administrador',
  GESTOR: 'gestor',
  MEDICO: 'médico',
  RECECIONISTA: 'recepcionista',
  TERAPEUTA: 'terapeuta',
};

/**
 * Aceite do convite em formato de conversa (cadastro por chat): o assistente se apresenta, pergunta o nome, oferece
 * a foto (opcional) e pede a senha duas vezes. O token vem do link (`?token=`); sem token, ou com token recusado,
 * mostra "convite inválido". Ao criar a conta volta ao login com um aviso (a sessão só nasce no login).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthShellComponent, ButtonComponent, PasswordFieldComponent],
  selector: 'app-accept-invite',
  styleUrl: './accept-invite.component.scss',
  templateUrl: './accept-invite.component.html',
})
export class AcceptInviteComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly step = signal<InviteStep>('loading');
  protected readonly messages = signal<readonly ChatMessage[]>([]);
  protected readonly fullName = signal('');
  protected readonly password = signal('');
  protected readonly confirmation = signal('');
  protected readonly photoPreview = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<InviteSummary | null>(null);
  protected readonly typing = computed(() => this.step() === 'loading' || this.step() === 'submitting');

  private photo: InvitePhoto | undefined;
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  private readonly gateway = inject(InviteGateway);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    if (!this.token) {
      this.step.set('invalid');

      return;
    }
    try {
      const info = await this.gateway.check(this.token);

      if (info === null) {
        this.step.set('invalid');

        return;
      }
      this.summary.set(info);
      const role = ROLE_TEXT[info.role] ?? info.role.toLowerCase();
      const where = info.hospitals.length > 0 ? ` em ${info.hospitals.join(', ')}` : '';

      this.say(`Olá! Você foi convidado para a Conductia como ${role}${where}.`);
      this.say('Vamos criar a sua conta em poucos passos. Como você se chama?');
      this.step.set('name');
    } catch {
      this.error.set('Não foi possível abrir o convite agora. Tente novamente em instantes.');
      this.step.set('invalid');
    }
  }

  protected onName(event: Event): void {
    this.fullName.set((event.target as HTMLInputElement).value);
  }

  protected submitName(event?: Event): void {
    event?.preventDefault();
    const name = this.fullName().trim();

    if (name === '') {
      this.error.set('Conte o seu nome completo para continuar.');

      return;
    }
    this.error.set(null);
    this.reply(name);
    this.say(`Prazer, ${name.split(' ')[0]}! Quer colocar uma foto no seu perfil? É opcional.`);
    this.step.set('photo');
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }
    if (!PHOTO_TYPES.includes(file.type)) {
      this.error.set('A foto deve ser JPEG, PNG ou WebP.');

      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      this.error.set('A foto deve ter até 2 MB.');

      return;
    }
    const dataUrl = await readAsDataUrl(file);

    this.error.set(null);
    this.photo = { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), type: file.type };
    this.photoPreview.set(dataUrl);
  }

  protected skipOrContinuePhoto(): void {
    this.reply(this.photo ? 'Foto adicionada' : 'Prefiro pular');
    this.say('Agora crie uma senha para entrar. Use ao menos 12 caracteres, com letra e número.');
    this.step.set('password');
  }

  protected submitPassword(event?: Event): void {
    event?.preventDefault();
    const violations = validatePassword(this.password());

    if (violations.length > 0) {
      this.error.set(violations.map(v => this.i18n.t(`passwordRecovery.reset.policy.${v}`)).join(' '));

      return;
    }
    this.error.set(null);
    this.reply('••••••••••••');
    this.say('Para conferir, digite a senha mais uma vez.');
    this.step.set('confirm');
  }

  protected submitConfirmation(event?: Event): void {
    event?.preventDefault();
    if (this.password() !== this.confirmation()) {
      this.error.set(this.i18n.t('passwordRecovery.reset.mismatch'));

      return;
    }
    this.error.set(null);
    this.reply('••••••••••••');
    void this.finish();
  }

  protected goToLogin(): void {
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async finish(): Promise<void> {
    this.say('Criando a sua conta…');
    this.step.set('submitting');
    try {
      const result = await this.gateway.accept(
        this.token as string,
        this.fullName().trim(),
        this.password(),
        this.photo,
      );

      if (result === 'invalid-token') {
        this.step.set('invalid');

        return;
      }
      void this.router.navigateByUrl('/login', {
        replaceUrl: true,
        state: { notice: this.i18n.t(result === 'ok' ? 'invite.created' : 'invite.alreadyRegistered') },
      });
    } catch {
      this.error.set('Não foi possível criar a conta agora. Confira a conexão e tente de novo.');
      this.confirmation.set('');
      this.step.set('confirm');
    }
  }

  private say(text: string): void {
    this.messages.update(list => [...list, { from: 'bot', text }]);
  }

  private reply(text: string): void {
    this.messages.update(list => [...list, { from: 'user', text }]);
  }
}
