import { Location, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  OnDestroy,
  signal,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { firstValueFrom, take } from 'rxjs';

import {
  CardNotifyComponent,
  CardNotifyReply,
  CardNotifyType,
} from '../../shared/components/card-notify/card-notify.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { AudioTranscriber } from '../../shared/services/audio-transcriber';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import {
  FormSubmitError,
  type FormValues,
  type ScreenAction,
  ScreenActionsService,
  type ScreenCommand,
} from '../../shared/services/screen-actions.service';
import { NOTIFICATIONS_CONTEXT } from '../../shared/services/screen-contexts';
import { type DirectoryUser } from '../../shared/services/user-directory';
import { formatRelativeTime } from '../../shared/utils/relative-time';
import { HospitalContextService } from '../home/hospital-context.service';
import { isSentThreadNotification } from '../patient-messages/sent-thread-notification';
import { AnnouncementAssistant } from './assistant/announcement-assistant';
import { NotificationSectionTitleComponent } from './components/notification-section-title/notification-section-title.component';
import { type ComunicadoRecipientSpec, ComunicadosApiService } from './data-access/comunicados-api.service';
import { NotificationsRepository } from './data-access/notifications-repository.service';
import { Notification, NotificationType } from './notifications.models';
import { NotificationsActions } from './state/notifications.actions';
import {
  selectActiveTab,
  selectAnswerErrorMessage,
  selectAnsweringId,
  selectDiscardConfirmPending,
  selectDrafts,
  selectDraftText,
  selectHasMore,
  selectHospitalId,
  selectPendingItems,
  selectPendingTotalCount,
  selectResolvedItems,
  selectResolvedLoaded,
  selectResolvedTotalCount,
  selectResolveErrorMessage,
  selectStatus,
  selectSubmitting,
} from './state/notifications.reducer';

function formatTodayLabel(): string {
  const parts = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' }).formatToParts(
    new Date(),
  );
  const value = (type: string): string => parts.find(p => p.type === type)?.value ?? '';
  const weekday = value('weekday');

  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${value('day')} de ${value('month')}`;
}

/** Distância mínima de arraste, em px, para disparar o pull-to-refresh (FR-004b). */
const PULL_TO_REFRESH_THRESHOLD = 80;

const KIND_LABELS: Record<NotificationType, string> = {
  internal_notice: 'Comunicado interno',
  patient_message: 'Mensagem de paciente',
  reevaluation_pending: 'Pendência de reavaliação',
};

/**
 * Tela "Notificações" (specs/004-notificacoes) — cabeçalho (sino + contagem, sem botão
 * de voltar — FR-002, saída só via Menu, guardada por `canDeactivateNotifications`),
 * fundo decorativo com 1 blob oculto e cor diferente da Home (FR-015), tag de hospital
 * somente leitura (FR-003), lista em duas abas (Ativas / Resolvidas — FR-003), infinite scroll e pull-to-refresh (FR-004b), e o fluxo de resposta
 * via IA (US3: bottom sheet + rascunho ao vivo no card + diálogo de descarte).
 * Figma: 4495:8526 (pendentes) / 4496:11857 (com Resolvidas) / 4495:10551 (answering).
 *
 * NOTA: sem serviço de sessão no frontend ainda (mesma situação de
 * `home.component.ts`) — os dados do profissional autenticado no bloco de
 * rascunho (`draftAuthorName` etc.) usam o mesmo valor de exemplo da Home.
 */
const NO_DRAFTS: Readonly<Record<number, string>> = {};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardNotifyComponent,
    ConfirmDialogComponent,
    IconButtonComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    ScrollRevealDirective,
    NotificationSectionTitleComponent,
    PageContainerComponent,
    PhIconComponent,
  ],
  selector: 'app-notifications',
  styleUrl: './notifications.component.scss',
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent implements OnDestroy {
  // `store` precisa ser o primeiro campo (protected, não private): os
  // `toSignal(this.store.select(...))` abaixo dependem dele já estar
  // atribuído — campos de classe inicializam na ordem em que aparecem no
  // arquivo, e não na ordem de accessibility exigida pelo lint (mesmo
  // padrão de home.component.ts).
  protected readonly store = inject(Store);

  protected readonly status = toSignal(this.store.select(selectStatus), { initialValue: 'loading-initial' as const });
  protected readonly hospitalId = toSignal(this.store.select(selectHospitalId), { initialValue: null });
  protected readonly pendingItems = toSignal(this.store.select(selectPendingItems), { initialValue: [] });
  protected readonly resolvedItems = toSignal(this.store.select(selectResolvedItems), { initialValue: [] });
  protected readonly activeTab = toSignal(this.store.select(selectActiveTab), { initialValue: 'pending' as const });
  protected readonly resolvedLoaded = toSignal(this.store.select(selectResolvedLoaded), { initialValue: false });
  protected readonly hasMore = toSignal(this.store.select(selectHasMore), { initialValue: true });

  protected readonly answeringId = toSignal(this.store.select(selectAnsweringId), { initialValue: null });
  protected readonly draftText = toSignal(this.store.select(selectDraftText), { initialValue: '' });
  protected readonly drafts = toSignal(this.store.select(selectDrafts), { initialValue: NO_DRAFTS });
  protected readonly transcribing = signal(false);
  protected readonly transcribeError = signal<string | null>(null);
  protected readonly submitting = toSignal(this.store.select(selectSubmitting), { initialValue: false });
  protected readonly answerErrorMessage = toSignal(this.store.select(selectAnswerErrorMessage), {
    initialValue: null,
  });
  /** Notificação aguardando a confirmação de "Resolver" (null = diálogo fechado). */
  protected readonly resolveConfirmId = signal<number | null>(null);
  protected readonly discardConfirmPending = toSignal(this.store.select(selectDiscardConfirmPending), {
    initialValue: false,
  });

  // Convergence T053: contagem real do backend (`NotificationPage.totalCount`), não
  // mais uma aproximação pelos itens já paginados no cliente (que subcontava antes
  // de toda a paginação carregar).
  // Figma (seção 07): o título conta as pendentes; cada seção mostra o próprio total.
  protected readonly resolvedCount = toSignal(this.store.select(selectResolvedTotalCount), { initialValue: 0 });
  protected readonly pendingCount = toSignal(this.store.select(selectPendingTotalCount), { initialValue: 0 });
  /** Itens exibidos (Pendentes e Resolvidas, sempre juntas), da mais recente para a mais antiga. */
  protected readonly visibleItems = computed(() => [...this.pendingItems(), ...this.resolvedItems()]);
  /** Vazio quando carregou e não há pendentes (as Resolvidas têm a própria seção, que some sem itens). */
  protected readonly isEmpty = computed(() => this.status() === 'success' && this.pendingItems().length === 0);
  protected readonly emptyTitle = 'Nenhuma notificação pendente no momento';
  protected readonly emptyText =
    'Quando alguém da equipe mencionar você ou um paciente seu, a notificação aparece aqui.';

  // Sem serviço de sessão no frontend ainda — mesmo valor de exemplo de home.component.ts.
  protected readonly professionalName = 'Michelle Franklin';
  protected readonly online = inject(ConnectivityService).online;
  protected readonly resolveErrorMessage = toSignal(this.store.select(selectResolveErrorMessage), {
    initialValue: null,
  });
  protected readonly professionalSpecialty = 'Nutróloga';

  protected readonly hospitalName = computed(() => this.hospitalContext.selected()?.name ?? '');
  protected readonly todayLabel = computed(() => formatTodayLabel());
  protected readonly assistant = inject(AiAssistantService);
  /** Contexto abaixo do título: "<hospital> · <data>" (Figma v2/PageHeader). */
  protected readonly subtitle = computed(() => {
    const id = this.hospitalId();
    const name = this.hospitalName() || 'Hospital ' + id;

    return id ? name + ' · ' + this.todayLabel() : this.todayLabel();
  });
  /** Título com a contagem ("3 Notificações"), no mobile e no desktop. */
  protected readonly title = computed(() => {
    const total = this.pendingCount();

    if (total === 0) {
      return 'Notificações';
    }

    return `${total} ${total === 1 ? 'notificação' : 'notificações'}`;
  });

  /** Id do profissional logado (sem serviço de sessão ainda — mesmo usuário de exemplo acima). */
  private readonly currentUserId = 4;
  private readonly actions$ = inject(Actions);
  private readonly location = inject(Location);
  private readonly hospitalContext = inject(HospitalContextService);
  private readonly repository = inject(NotificationsRepository);
  private readonly comunicados = inject(ComunicadosApiService);
  private readonly announcementAssistant = inject(AnnouncementAssistant);
  private readonly connectivity = inject(ConnectivityService);
  private readonly screenActions = inject(ScreenActionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  // Estado só de apresentação (não persiste no NgRx): quais cards estão com o
  // histórico expandido (US4, `type="answer-open"`) — alternado por
  // viewRepliesClick/collapseClick, local ao componente porque não sobrevive
  // navegação nem precisa ser compartilhado.
  private readonly transcriber = inject(AudioTranscriber);
  private readonly expandedIds = signal<ReadonlySet<number>>(new Set());

  // Um sentinel por coluna: no desktop cada coluna tem o próprio scroll.
  private readonly scrollSentinels = viewChildren<ElementRef<HTMLElement>>('scrollSentinel');
  private intersectionObserver?: IntersectionObserver;
  private pullStartY: number | null = null;

  constructor() {
    // Pendentes e Resolvidas aparecem juntas (nosso layout, mobile e desktop): busca a 1ª página de Resolvidas (a aba
    // "resolved" a dispara) e devolve a aba ativa para Pendentes, que segue paginando pelo scroll.
    effect(() => {
      if (this.status() !== 'success') {
        return;
      }
      if (!this.resolvedLoaded() && this.activeTab() === 'pending') {
        this.store.dispatch(NotificationsActions.tabSelected({ tab: 'resolved' }));
      } else if (this.resolvedLoaded() && this.activeTab() === 'resolved') {
        this.store.dispatch(NotificationsActions.tabSelected({ tab: 'pending' }));
      }
    });
    const hospitalIdParam = this.route.snapshot.queryParamMap.get('hospitalId');
    const hospitalId = hospitalIdParam ? Number(hospitalIdParam) : null;

    this.store.dispatch(NotificationsActions.pageOpened({ hospitalId }));

    // Ações da tela no assistente (padrão de cadastro): "Criar notificação" abre o formulário;
    // Editar e Responder já aparecem nos atalhos mas ainda não têm fluxo.
    this.destroyRef.onDestroy(this.screenActions.register(this.screenActionsList()));
    this.destroyRef.onDestroy(this.screenActions.registerContext(NOTIFICATIONS_CONTEXT));
    // Comando por texto/áudio fora do contexto de paciente: abre o mesmo formulário de comunicado, pré-preenchido.
    this.destroyRef.onDestroy(
      this.screenActions.registerCommandHandler(command => this.openAnnouncementFromCommand(command)),
    );

    // Uma notificação criada/respondida muda o repositório: recarrega a lista.
    let seenVersion = this.repository.version();

    effect(() => {
      const version = this.repository.version();

      if (version !== seenVersion) {
        seenVersion = version;
        this.store.dispatch(NotificationsActions.refreshRequested());
      }
    });

    // FR-005: toda notificação não lida exibida na lista passa a lida (já lidas não disparam nada).
    effect(() => {
      const unreadIds = this.visibleItems()
        .filter(item => !item.read)
        .map(item => item.id);

      if (unreadIds.length > 0) {
        this.store.dispatch(NotificationsActions.markAsReadRequested({ notificationIds: unreadIds }));
      }
    });

    // Observa o sentinel de fim de lista (FR-004a), mesmo padrão de home.component.ts.
    effect(
      () => {
        const elements = this.scrollSentinels();

        this.intersectionObserver?.disconnect();
        if (elements.length === 0) {
          return;
        }
        this.intersectionObserver = new IntersectionObserver(entries => {
          const visivel = entries.some(entry => entry.isIntersecting);
          const carregando = this.status() === 'loading-more-pending' || this.status() === 'loading-more-resolved';

          if (visivel && this.hasMore() && !carregando) {
            this.store.dispatch(NotificationsActions.loadNextBatchRequested());
          }
        });
        elements.forEach(element => this.intersectionObserver?.observe(element.nativeElement));
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
  }

  // public: os membros a seguir são exercitados diretamente pelo spec.
  isExpanded(id: number): boolean {
    // Um card em modo "answering" também mostra o histórico expandido, se
    // houver (Acceptance Scenario 2 de US3) — nunca colapsado enquanto respondendo.
    return this.expandedIds().has(id) || this.answeringId() === id || !!this.drafts()[id];
  }

  /** `type` a passar para `app-card-notify` — usado no template para as 2 seções. */
  kindLabel(type: NotificationType): string {
    return KIND_LABELS[type];
  }

  cardType(id: number): CardNotifyType {
    if (this.answeringId() === id) {
      return 'answering';
    }

    if (this.drafts()[id]) {
      return 'draft';
    }

    return this.isExpanded(id) ? 'answer-open' : 'detail';
  }

  /** Texto mostrado no card: o campo em edição, ou o rascunho guardado (State=draft). */
  cardDraftText(id: number): string {
    return this.answeringId() === id ? this.draftText() : (this.drafts()[id] ?? '');
  }

  /** FR-006 (US2) — navega para o paciente relacionado; `app-card-notify` já suprime
   *  `cardClick` sozinho quando `type="answering"` (Acceptance Scenario 2). */
  onCardClick(patientId: number | string | undefined): void {
    if (patientId !== undefined) {
      void this.router.navigate(['/patients', patientId]);
    }
  }

  /** Voltar do cabeçalho: volta para a tela em que o usuário estava (ou para a Home, se não há histórico). */
  onClose(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/home']);
    }
  }

  onViewRepliesClick(id: number): void {
    const next = new Set(this.expandedIds());

    next.add(id);
    this.expandedIds.set(next);
  }

  /** Participante da thread: remetente, destinatário mencionado ou quem já respondeu (FR-012). */
  isParticipant(notification: Notification): boolean {
    const me = this.currentUserId;

    return (
      isSentThreadNotification(notification) ||
      notification.author.id === me ||
      (notification.mentioned ?? []).some(person => person.id === me) ||
      notification.replies.some(reply => reply.author.id === me)
    );
  }

  /** Botão ✓ do card (Figma v2/NotificationThread): marca como resolvida. */
  onResolveClick(id: number): void {
    if (!this.online()) {
      return;
    }
    this.resolveConfirmId.set(id);
  }

  /** "Sim" no diálogo: resolve de fato a notificação. */
  onConfirmResolve(): void {
    const id = this.resolveConfirmId();

    this.resolveConfirmId.set(null);
    if (id !== null && this.online()) {
      this.store.dispatch(NotificationsActions.resolveRequested({ notificationId: id }));
    }
  }

  onCancelResolve(): void {
    this.resolveConfirmId.set(null);
  }

  onCollapseClick(id: number): void {
    const next = new Set(this.expandedIds());

    next.delete(id);
    this.expandedIds.set(next);
  }

  // --- Fluxo de resposta via IA (User Story 3) ---

  onAnswerClick(id: number): void {
    this.store.dispatch(NotificationsActions.answerStarted({ notificationId: id }));
  }

  onSendDraft(): void {
    const id = this.answeringId();

    if (id != null) {
      this.store.dispatch(NotificationsActions.answerSubmitted({ notificationId: id }));
    }
  }

  /** "Cancelar" no card: fecha o campo de resposta; o texto digitado fica como rascunho da notificação. */
  onCancelAnswer(): void {
    this.transcribeError.set(null);
    this.store.dispatch(NotificationsActions.answerCancelled());
  }

  /** Áudio do campo de resposta → texto no campo, para revisar e enviar (nunca envia o áudio). */
  async onAudio(audio: Blob): Promise<void> {
    const id = this.answeringId();

    if (id === null) {
      return;
    }
    this.transcribing.set(true);
    this.transcribeError.set(null);
    try {
      const text = (await this.transcriber.transcribe(audio)).trim();

      if (text !== '' && this.answeringId() === id) {
        const current = this.draftText().trim();

        this.onDraftInput(current === '' ? text : current + ' ' + text);
      }
    } catch {
      this.transcribeError.set('Não foi possível transcrever o áudio agora. Escreva a mensagem.');
    } finally {
      this.transcribing.set(false);
    }
  }

  /** Erro mostrado no campo em edição: envio com falha ou transcrição indisponível. */
  cardAnswerError(id: number): string | null {
    return this.answeringId() === id ? (this.answerErrorMessage() ?? this.transcribeError()) : null;
  }

  protected onRetry(): void {
    const hospitalId = this.hospitalId();

    if (hospitalId != null) {
      this.store.dispatch(NotificationsActions.retryRequested({ hospitalId }));
    }
  }

  protected onDraftInput(text: string): void {
    const id = this.answeringId();

    if (id != null) {
      this.store.dispatch(NotificationsActions.draftChanged({ notificationId: id, text }));
    }
  }

  protected onConfirmDiscard(): void {
    this.store.dispatch(NotificationsActions.answerDiscarded());
  }

  protected onCancelDiscard(): void {
    this.store.dispatch(NotificationsActions.discardConfirmationCancelled());
  }

  protected toReplies(notification: Notification): CardNotifyReply[] {
    return notification.replies.map(reply => ({
      authorName: reply.author.name,
      authorSpecialty: reply.author.specialty,
      authorPhotoUrl: reply.author.photoUrl,
      text: reply.text,
      time: this.formatTime(reply.createdAt),
    }));
  }

  protected formatTime(isoDate: string): string {
    return formatRelativeTime(isoDate); // Figma: "Hoje, 10:42"
  }

  // Pull-to-refresh (FR-004b) — gesto simples de arrastar para baixo a partir do
  // topo da rolagem; sem indicador visual de progresso nesta v1 (simplificação
  // registrada — ver tasks.md T022).
  protected onTouchStart(event: TouchEvent, scrollContainer: HTMLElement): void {
    this.pullStartY = scrollContainer.scrollTop === 0 ? event.touches[0].clientY : null;
  }

  protected onTouchEnd(event: TouchEvent): void {
    if (this.pullStartY == null) {
      return;
    }
    const deltaY = event.changedTouches[0].clientY - this.pullStartY;

    this.pullStartY = null;
    if (deltaY <= PULL_TO_REFRESH_THRESHOLD) {
      return;
    }

    if (this.answeringId() == null) {
      this.store.dispatch(NotificationsActions.refreshRequested());

      return;
    }

    // FR-004b: rascunho não enviado no momento do gesto → mesma confirmação do
    // FR-010a antes de recarregar; só atualiza se o profissional confirmar o
    // descarte (o diálogo é renderizado reativamente a partir de `discardConfirmPending`).
    this.actions$.pipe(ofType(NotificationsActions.answerDiscarded), take(1)).subscribe(() => {
      this.store.dispatch(NotificationsActions.refreshRequested());
    });
    this.store.dispatch(NotificationsActions.discardConfirmationRequested());
  }

  /** Texto do card: comunicado interno mostra os destinatários ("Para A, B: ..."). */
  protected cardDescription(notification: Notification): string {
    const names = (notification.recipients ?? []).map(recipient => recipient.name);

    return names.length > 0 ? `Para ${names.join(', ')}: ${notification.description}` : notification.description;
  }

  /** Envia o comunicado interno pela API; sem conexão o envio fica indisponível e as respostas são mantidas. */
  private async sendAnnouncement(values: FormValues): Promise<void> {
    const hospitalId = this.hospitalContext.selected()?.id ?? this.hospitalId();

    if (!this.connectivity.online()) {
      throw new FormSubmitError(
        'Sem conexão: não é possível enviar o comunicado agora. Tente novamente quando voltar a conexão.',
      );
    }
    if (hospitalId == null) {
      throw new FormSubmitError('Selecione um hospital para enviar o comunicado.');
    }
    const selected = values['recipients'] as readonly DirectoryUser[];
    const recipients = selected.map((user): ComunicadoRecipientSpec => {
      if (!user.group) {
        return { professionalId: user.id, type: 'PESSOA' };
      }

      return user.group.profile === null ? { type: 'TODOS' } : { perfil: user.group.profile, type: 'GRUPO' };
    });

    await firstValueFrom(this.comunicados.create(hospitalId, values['message'] as string, recipients));
    this.store.dispatch(NotificationsActions.refreshRequested());
  }

  /** Texto vira o conteúdo; áudio é transcrito. Falha na transcrição abre o formulário vazio, com aviso, para digitar. */
  private async openAnnouncementFromCommand(command: ScreenCommand): Promise<void> {
    let content: string;
    let notice: string | undefined;

    if (command.kind === 'text') {
      content = command.text;
    } else {
      try {
        content = await this.announcementAssistant.transcribe(command.audio);
      } catch {
        content = '';
        notice = 'Não foi possível transcrever o áudio. Digite o comunicado manualmente.';
      }
    }
    const action = this.announcementAction();

    this.assistant.openAction({
      ...action,
      form: action.form && { ...action.form, initialValues: content ? { message: content } : undefined, notice },
    });
  }

  private announcementAction(): ScreenAction {
    return this.screenActionsList()[0];
  }

  private screenActionsList(): readonly ScreenAction[] {
    return [
      {
        form: {
          fields: [
            {
              id: 'recipients',
              kind: 'mention',
              label: 'Quem receberá o comunicado:',
              placeholder: '@pessoa, @grupo (ex.: @medicos) ou @todos',
              required: true,
              requiredMessage: 'Informe ao menos um destinatário para enviar o comunicado.',
              suggest: {
                from: 'message',
                run: (content): Promise<readonly DirectoryUser[]> =>
                  this.announcementAssistant.suggestRecipients(content),
              },
            },
            {
              id: 'message',
              kind: 'text',
              label: 'Qual é o comunicado?',
              placeholder: 'Escreva o comunicado',
              required: true,
            },
          ],
          submit: (values): Promise<void> => this.sendAnnouncement(values),
          messagePlaceholder: 'Fale ou escreva o comunicado',
          submitLabel: 'Enviar comunicado',
          title: 'Criar comunicado interno',
        },
        id: 'create',
        label: 'Criar comunicado interno',
      },
      { id: 'edit', label: 'Editar notificação' },
      { id: 'reply', label: 'Responder notificação' },
    ];
  }
}
