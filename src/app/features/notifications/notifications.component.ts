import { Location } from '@angular/common';
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
import { take } from 'rxjs';

import { BottomSheetComponent } from '../../shared/components/bottom-sheet/bottom-sheet.component';
import {
  CardNotifyComponent,
  CardNotifyReply,
  CardNotifyType,
} from '../../shared/components/card-notify/card-notify.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { InputChatComponent } from '../../shared/components/input-chat/input-chat.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { type ScreenAction, ScreenActionsService } from '../../shared/services/screen-actions.service';
import { type DirectoryUser } from '../../shared/services/user-directory';
import { formatRelativeTime } from '../../shared/utils/relative-time';
import { HospitalContextService } from '../home/hospital-context.service';
import { NotificationSectionTitleComponent } from './components/notification-section-title/notification-section-title.component';
import { NotificationsRepository } from './data-access/notifications-repository.service';
import { Notification } from './notifications.models';
import { NotificationsActions } from './state/notifications.actions';
import {
  selectAnswerErrorMessage,
  selectAnsweringId,
  selectDiscardConfirmPending,
  selectDraftText,
  selectHasMore,
  selectHospitalId,
  selectPendingItems,
  selectPendingTotalCount,
  selectResolvedItems,
  selectResolvedTotalCount,
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

/**
 * Tela "Notificações" (specs/004-notificacoes) — cabeçalho (sino + contagem, sem botão
 * de voltar — FR-002, saída só via Menu, guardada por `canDeactivateNotifications`),
 * fundo decorativo com 1 blob oculto e cor diferente da Home (FR-015), tag de hospital
 * somente leitura (FR-003), lista em duas seções (Pendentes sem título / Resolvidas com
 * título — FR-004a), infinite scroll e pull-to-refresh (FR-004b), e o fluxo de resposta
 * via IA (US3: bottom sheet + rascunho ao vivo no card + diálogo de descarte).
 * Figma: 4495:8526 (pendentes) / 4496:11857 (com Resolvidas) / 4495:10551 (answering).
 *
 * NOTA: sem serviço de sessão no frontend ainda (mesma situação de
 * `home.component.ts`) — os dados do profissional autenticado no bloco de
 * rascunho (`draftAuthorName` etc.) usam o mesmo valor de exemplo da Home.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomSheetComponent,
    CardNotifyComponent,
    ConfirmDialogComponent,
    IconButtonComponent,
    InputChatComponent,
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
  protected readonly hasMore = toSignal(this.store.select(selectHasMore), { initialValue: true });

  protected readonly answeringId = toSignal(this.store.select(selectAnsweringId), { initialValue: null });
  protected readonly draftText = toSignal(this.store.select(selectDraftText), { initialValue: '' });
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
  protected readonly pendingCount = toSignal(this.store.select(selectPendingTotalCount), { initialValue: 0 });
  protected readonly resolvedCount = toSignal(this.store.select(selectResolvedTotalCount), { initialValue: 0 });
  protected readonly isEmpty = computed(
    () => this.status() === 'success' && this.pendingItems().length === 0 && this.resolvedItems().length === 0,
  );

  // Sem serviço de sessão no frontend ainda — mesmo valor de exemplo de home.component.ts.
  protected readonly professionalName = 'Michelle Franklin';
  protected readonly professionalSpecialty = 'Nutróloga';

  protected readonly hospitalName = computed(() => this.hospitalContext.selected()?.name ?? '');
  protected readonly todayLabel = computed(() => formatTodayLabel());
  /** Título com a contagem ("3 Notificações"), no mobile e no desktop. */
  protected readonly assistant = inject(AiAssistantService);
  protected readonly title = computed(() => {
    const total = this.pendingCount();

    if (total === 0) {
      return 'Notificações';
    }

    return `${total} ${total === 1 ? 'notificação' : 'notificações'}`;
  });

  private readonly actions$ = inject(Actions);
  private readonly location = inject(Location);
  private readonly hospitalContext = inject(HospitalContextService);
  private readonly repository = inject(NotificationsRepository);
  private readonly screenActions = inject(ScreenActionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  // Estado só de apresentação (não persiste no NgRx): quais cards estão com o
  // histórico expandido (US4, `type="answer-open"`) — alternado por
  // viewRepliesClick/collapseClick, local ao componente porque não sobrevive
  // navegação nem precisa ser compartilhado.
  private readonly expandedIds = signal<ReadonlySet<number>>(new Set());

  // Um sentinel por coluna: no desktop cada coluna tem o próprio scroll.
  private readonly scrollSentinels = viewChildren<ElementRef<HTMLElement>>('scrollSentinel');
  private intersectionObserver?: IntersectionObserver;
  private pullStartY: number | null = null;

  constructor() {
    const hospitalIdParam = this.route.snapshot.queryParamMap.get('hospitalId');
    const hospitalId = hospitalIdParam ? Number(hospitalIdParam) : null;

    this.store.dispatch(NotificationsActions.pageOpened({ hospitalId }));

    // Ações da tela no assistente (padrão de cadastro): "Criar notificação" abre o formulário;
    // Editar e Responder já aparecem nos atalhos mas ainda não têm fluxo.
    this.destroyRef.onDestroy(this.screenActions.register(this.screenActionsList()));

    // Uma notificação criada/respondida muda o repositório: recarrega a lista.
    let seenVersion = this.repository.version();

    effect(() => {
      const version = this.repository.version();

      if (version !== seenVersion) {
        seenVersion = version;
        this.store.dispatch(NotificationsActions.refreshRequested());
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
    return this.expandedIds().has(id) || this.answeringId() === id;
  }

  /** `type` a passar para `app-card-notify` — usado no template para as 2 seções. */
  cardType(id: number): CardNotifyType {
    if (this.answeringId() === id) {
      return 'answering';
    }

    return this.isExpanded(id) ? 'answer-open' : 'detail';
  }

  /** FR-006 (US2) — navega para o paciente relacionado; `app-card-notify` já suprime
   *  `cardClick` sozinho quando `type="answering"` (Acceptance Scenario 2). */
  onCardClick(patientId: number | string | undefined): void {
    if (patientId !== undefined) {
      void this.router.navigate(['/patients', patientId]);
    }
  }

  /** "X" do cabeçalho: volta para a tela em que o usuário estava (ou para a Home, se não há histórico). */
  /** Botão de atalhos do cabeçalho: abre o assistente nas ações desta tela. */
  onOpenShortcuts(): void {
    this.assistant.openShortcuts();
  }

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

  /** Botão ✓ do card (Figma v2/NotificationThread): marca como resolvida. */
  onResolveClick(id: number): void {
    this.resolveConfirmId.set(id);
  }

  /** "Sim" no diálogo: resolve de fato a notificação. */
  onConfirmResolve(): void {
    const id = this.resolveConfirmId();

    this.resolveConfirmId.set(null);
    if (id !== null) {
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

  /** Bottom sheet fechado sem confirmar o envio (FR-010) — descarta direto, sem diálogo. */
  onBottomSheetClosed(): void {
    if (this.answeringId() != null) {
      this.store.dispatch(NotificationsActions.answerDiscarded());
    }
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

  private screenActionsList(): readonly ScreenAction[] {
    return [
      {
        form: {
          fields: [
            {
              id: 'recipients',
              kind: 'mention',
              label: 'Quem será notificado:',
              placeholder: '@nome da pessoa',
              required: true,
            },
            {
              id: 'message',
              kind: 'text',
              label: 'Qual é a mensagem da notificação?',
              placeholder: 'Escreva a mensagem',
              required: true,
            },
            {
              id: 'dueDate',
              kind: 'date',
              label: 'Data para resolução?',
              placeholder: 'Selecione uma data final',
              required: false,
            },
          ],
          submit: (values): void => {
            this.repository.create({
              dueDate: values['dueDate'] as string,
              message: values['message'] as string,
              recipients: (values['recipients'] as readonly DirectoryUser[]).map(user => ({ ...user })),
            });
          },
          submitLabel: 'Criar notificação',
          title: 'Criar notificação',
        },
        id: 'create',
        label: 'Criar notificação',
      },
      { id: 'edit', label: 'Editar notificação' },
      { id: 'reply', label: 'Responder notificação' },
    ];
  }
}
