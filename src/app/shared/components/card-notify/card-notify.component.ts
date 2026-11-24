import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { AvatarComponent, AvatarType } from '../avatar/avatar.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { InputChatComponent } from '../input-chat/input-chat.component';

/**
 * `detail` (recolhido), `answer-open` (respostas abertas), `draft` (respostas abertas + resposta escrita e
 * não enviada) e `answering` (campo de resposta aberto, com texto/áudio e "Cancelar") — Figma
 * v2/NotificationThread, States default / expanded / draft / write.
 */
export type CardNotifyType = 'resume' | 'detail' | 'answer-open' | 'draft' | 'answering';

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
  imports: [AvatarComponent, IconButtonComponent, InputChatComponent, PhIconComponent],
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
  /** Quando falso, o indicador de resolução não é oferecido (quem não participa da thread). */
  readonly canResolve = input<boolean>(true);
  /** Indicador de resolução visível porém indisponível (ex.: sem conexão). */
  readonly resolveDisabled = input<boolean>(false);

  // Obrigatórios apenas quando `type !== 'resume'` — ver DS-component-card-notify §
  // Variantes & Props. `input()` (não `.required()`) porque o `resume` legado (Home)
  // nunca os passa.
  readonly patientName = input<string>('');
  /** Notificação já resolvida: card com fundo translúcido (Figma 4506:9755). */
  readonly resolved = input<boolean>(false);
  /** v2: ponto vermelho de 8px no card não lido (Figma v2/CardNotify Read=false). */
  readonly unread = input<boolean>(false);
  /** Tipo do conteúdo em texto (ex.: "Comunicado interno"); vazio = sem etiqueta. */
  readonly kindLabel = input<string>('');
  /** Pendência de reavaliação vencida. */
  readonly overdue = input<boolean>(false);
  readonly patientAriaLabel = input<string>('Paciente');
  readonly replies = input<readonly CardNotifyReply[]>([]);
  readonly draftText = input<string>('');
  readonly draftAuthorName = input<string>('');
  readonly draftAuthorSpecialty = input<string>('');
  readonly draftAuthorPhotoUrl = input<string | null>(null);
  /** Placeholder do campo de resposta (State=write). */
  readonly answerPlaceholder = input<string>('Escreva a sua mensagem');
  /** Bloqueia o campo enquanto a resposta é enviada ou o áudio é transcrito. */
  readonly answerBusy = input<boolean>(false);
  /** Erro do último envio/transcrição, mostrado dentro do bloco de resposta. */
  readonly answerError = input<string | null>(null);

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
  /** Botão ✓ (Figma v2/NotificationThread): marcar como resolvida. */
  readonly resolveClick = output();
  /** Texto do campo de resposta (State=write) a cada alteração. */
  readonly draftChange = output<string>();
  /** Enviar a resposta escrita. */
  readonly sendClick = output();
  /** "Cancelar": fecha o campo de resposta (o texto vira rascunho). */
  readonly cancelClick = output();
  /** Áudio gravado no campo de resposta: o consumidor transcreve e devolve o texto em `draftText`. */
  readonly audioSend = output<Blob>();

  protected readonly isResume = computed(() => this.type() === 'resume');
  protected readonly isDetail = computed(() => this.type() === 'detail');
  protected readonly isAnswerOpen = computed(() => this.type() === 'answer-open');
  protected readonly isAnswering = computed(() => this.type() === 'answering');
  protected readonly isDraft = computed(() => this.type() === 'draft');
  protected readonly showPatientHeader = computed(() => !this.isResume() && this.patientName() !== '');
  protected readonly showReplyTag = computed(() => this.isDetail() && this.replies().length > 0);
  // Figma 4506:9462: só o card pendente tem a coluna do balão (responder). Aberto com as respostas
  // (4496:11888) e resolvido (4506:9755) não têm.
  // Figma v2/NotificationThread: pendente mostra responder + resolver, também com as
  // respostas abertas; resolvida não tem ações.
  // Figma v2/NotificationThread: o Resolver fica no cabeçalho de todo card pendente (não-Home).
  protected readonly showResolveButton = computed(() => !this.isResume() && !this.resolved() && this.canResolve());
  protected readonly showActionButton = computed(
    () => (this.isDetail() || this.isAnswerOpen() || this.isDraft()) && !this.resolved(),
  );
  protected readonly repliesLabel = computed(() => {
    const total = this.replies().length;

    return `${total} ${total === 1 ? 'resposta' : 'respostas'}`;
  });
  protected readonly showReplyBlocks = computed(() => this.isAnswerOpen() || this.isDraft() || this.isAnswering());

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

  protected onResolveClick(event: Event): void {
    event.stopPropagation();
    this.resolveClick.emit();
  }

  protected onCancelClick(event: Event): void {
    event.stopPropagation();
    this.cancelClick.emit();
  }

  protected onCollapseClick(event: Event): void {
    event.stopPropagation();
    this.collapseClick.emit();
  }
}
