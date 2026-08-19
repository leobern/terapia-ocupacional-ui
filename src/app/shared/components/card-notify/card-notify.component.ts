import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { AvatarComponent, AvatarType } from '../avatar/avatar.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

export type CardNotifyType = 'resume' | 'detail' | 'answer-open' | 'answering';

/** Um item do histórico de respostas (specs/ds/DS-component-card-notify, 2026-08-17). */
export interface CardNotifyReply {
  authorName: string;
  authorSpecialty: string;
  authorPhotoUrl: string | null;
  text: string;
  time: string;
}

/**
 * Card de resumo/detalhe de notificação (DS-component-card-notify). Composicional:
 * renderiza `app-avatar` (autor) e `app-icon-button` (CTA) sem reimplementar nenhum dos
 * dois (specs/ds/DS-component-card-notify/research.md §1). A prop `time` é tratada como
 * string opaca já formatada — nenhuma lógica de data/hora aqui (spec.md FR-007).
 *
 * `type='resume'` (default) é o card fixo 180×180 usado pela Home — comportamento
 * inalterado desde antes de 2026-08-17. As 3 variantes `detail`/`answer-open`/`answering`
 * (361px mín., altura livre) foram adicionadas para `specs/004-notificacoes` — ver
 * spec.md § User Story 2 dessa evolução.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconButtonComponent, PhIconComponent],
  selector: 'app-card-notify',
  styleUrl: './card-notify.component.scss',
  templateUrl: './card-notify.component.html',
})
export class CardNotifyComponent {
  readonly type = input<CardNotifyType>('resume');

  readonly authorName = input.required<string>();
  readonly authorSpecialty = input.required<string>();
  readonly authorPhotoUrl = input<string | null>(null);
  readonly description = input.required<string>();
  readonly time = input.required<string>();
  readonly actionAriaLabel = input.required<string>();
  readonly actionDisabled = input<boolean>(false);

  // Obrigatórios apenas quando `type !== 'resume'` — ver DS-component-card-notify §
  // Variantes & Props. `input()` (não `.required()`) porque o `resume` legado (Home)
  // nunca os passa.
  readonly patientName = input<string>('');
  readonly patientAriaLabel = input<string>('Paciente');
  readonly replies = input<readonly CardNotifyReply[]>([]);
  readonly draftText = input<string>('');
  readonly draftAuthorName = input<string>('');
  readonly draftAuthorSpecialty = input<string>('');
  readonly draftAuthorPhotoUrl = input<string | null>(null);

  // `cardClick`: em `resume`, área de toque estendida do card inteiro
  // (2026-07-26). Em `detail`/`answer-open` (2026-08-17, specs/004-notificacoes
  // FR-006), o corpo do card também emite `cardClick` — o consumidor decide o
  // destino (ali, a tela do paciente); os controles internos
  // (`answerClick`/`viewRepliesClick`/`collapseClick`) chamam `stopPropagation()`
  // para não disparar `cardClick` também. Em `answering`, `cardClick` MUST NOT
  // disparar (US2 Acceptance Scenario 2 — evita perder o rascunho por toque acidental).
  readonly cardClick = output();
  readonly answerClick = output();
  readonly viewRepliesClick = output();
  readonly collapseClick = output();

  protected readonly isResume = computed(() => this.type() === 'resume');
  protected readonly isDetail = computed(() => this.type() === 'detail');
  protected readonly isAnswerOpen = computed(() => this.type() === 'answer-open');
  protected readonly isAnswering = computed(() => this.type() === 'answering');
  protected readonly showPatientHeader = computed(() => !this.isResume());
  protected readonly showReplyTag = computed(() => this.isDetail() && this.replies().length > 0);
  protected readonly showActionButton = computed(() => this.isDetail() || this.isAnswerOpen());
  protected readonly showReplyBlocks = computed(() => this.isAnswerOpen() || this.isAnswering());

  protected readonly avatarType = computed<AvatarType>(() => (this.authorPhotoUrl() ? 'photo' : 'user'));
  protected readonly draftAvatarType = computed<AvatarType>(() => (this.draftAuthorPhotoUrl() ? 'photo' : 'user'));

  protected onCardClick(): void {
    if (this.isAnswering()) {
      return;
    }
    if (this.isResume() && this.actionDisabled()) {
      return;
    }
    this.cardClick.emit();
  }

  protected onActionClick(event: Event): void {
    event.stopPropagation();
    this.answerClick.emit();
  }

  protected onViewRepliesClick(event: Event): void {
    event.stopPropagation();
    this.viewRepliesClick.emit();
  }

  protected onCollapseClick(event: Event): void {
    event.stopPropagation();
    this.collapseClick.emit();
  }
}
