import { createFeature, createReducer, createSelector, on } from '@ngrx/store';

import { Notification, NotificationReply } from '../notifications.models';
import { NotificationsActions } from './notifications.actions';

export type NotificationsStatus =
  'idle' | 'loading-initial' | 'success' | 'error' | 'loading-more-pending' | 'loading-more-resolved' | 'refreshing';

export interface NotificationsState {
  hospitalId: number | null;
  pendingItems: Notification[];
  pendingCursor: string | null;
  /** Itens já carregados da seção (o contrato não devolve total por status). */
  pendingTotalCount: number;
  resolvedItems: Notification[];
  resolvedCursor: string | null;
  resolvedTotalCount: number;
  // `resolvedCursor: null` sozinho é ambíguo (pode ser "nunca buscado" ou
  // "esgotado") — este flag desambigua, permitindo ao effect saber quando a
  // 1ª página de Resolvidas ainda precisa ser buscada (FR-004a).
  resolvedLoaded: boolean;
  status: NotificationsStatus;
  /** Comportamento Offline "com cache" (mesmo padrão de features/home/state/home.reducer.ts). */
  stale: boolean;
  errorMessage: string | null;

  // --- Fluxo de resposta via IA (User Story 3, data-model.md § Transições) ---
  /** Notificação em modo "respondendo" — só 1 por vez em toda a tela (FR-011). */
  answeringId: number | null;
  /** Rascunho refletido ao vivo a partir do bottom sheet (FR-008). */
  draftText: string;
  /** Envio em andamento — mantém `answeringId`, mas bloqueia um novo envio. */
  submitting: boolean;
  /** Erro do último envio, se houver — exibido no bottom sheet (não a tela cheia). */
  answerErrorMessage: string | null;
  /** Erro da última ação sobre um card (resolver), exibido sem derrubar a lista. */
  actionErrorMessage: string | null;
  /** Diálogo "Descartar resposta não enviada?" pendente (FR-010a/FR-004b). */
  discardConfirmPending: boolean;
}

export const initialNotificationsState: NotificationsState = {
  hospitalId: null,
  pendingItems: [],
  pendingCursor: null,
  pendingTotalCount: 0,
  resolvedItems: [],
  resolvedCursor: null,
  resolvedTotalCount: 0,
  resolvedLoaded: false,
  // Mesma justificativa do `home.reducer.ts`: a tela sempre dispara `pageOpened`
  // na construção, então já nasce "carregando" para evitar flash de conteúdo vazio.
  status: 'loading-initial',
  stale: false,
  errorMessage: null,
  answeringId: null,
  draftText: '',
  submitting: false,
  answerErrorMessage: null,
  actionErrorMessage: null,
  discardConfirmPending: false,
};

/**
 * Acrescenta `incoming` a `existing` sem duplicar por `id` — proteção defensiva contra
 * o caso raro em que um item já inserido otimisticamente (`moveToResolved`, ao responder)
 * reaparece num lote paginado buscado depois (o cursor de Resolvidas foi capturado antes
 * do envio; um lote seguinte, mais antigo, pode conter a mesma notificação que acabou de
 * ser respondida se ela for antiga o suficiente).
 */
function appendWithoutDuplicates(existing: Notification[], incoming: Notification[]): Notification[] {
  const existingIds = new Set(existing.map(item => item.id));

  return [...existing, ...incoming.filter(item => !existingIds.has(item.id))];
}

/** `true` quando há um rascunho em edição que seria perdido se descartado agora. */
function hasUnsavedDraft(state: NotificationsState): boolean {
  return state.answeringId != null;
}

/** Ordena da mais recente para a mais antiga (FR-001). */
function byNewest(items: Notification[]): Notification[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Registra a resposta no histórico do card. Responder não resolve: o item fica na seção em que
 * está, exceto se estava Resolvido — aí é reaberto e volta para Ativas (FR-012, o servidor
 * reabre a thread na própria resposta).
 */
function applyReply(state: NotificationsState, notificationId: number, reply: NotificationReply): NotificationsState {
  const withReply = (item: Notification): Notification => ({
    ...item,
    replies: [...item.replies, reply],
    replyCount: item.replyCount + 1,
  });
  const reopened = state.resolvedItems.find(item => item.id === notificationId);

  if (reopened) {
    const pendingItems = byNewest([...state.pendingItems, withReply(reopened)]);

    return {
      ...state,
      pendingItems,
      pendingTotalCount: pendingItems.length,
      resolvedItems: state.resolvedItems.filter(item => item.id !== notificationId),
      resolvedTotalCount: Math.max(0, state.resolvedTotalCount - 1),
    };
  }

  return {
    ...state,
    pendingItems: state.pendingItems.map(item => (item.id === notificationId ? withReply(item) : item)),
  };
}

/** Botão ✓: move da seção Pendentes para Resolvidas, sem mexer na contagem de respostas. */
function resolveNotification(state: NotificationsState, notificationId: number): NotificationsState {
  const notification = state.pendingItems.find(item => item.id === notificationId);

  if (!notification) {
    return state;
  }
  const resolvedItems = byNewest([...state.resolvedItems, notification]);

  return {
    ...state,
    pendingItems: state.pendingItems.filter(item => item.id !== notificationId),
    pendingTotalCount: Math.max(0, state.pendingTotalCount - 1),
    resolvedItems,
    resolvedTotalCount: resolvedItems.length,
  };
}

export const notificationsFeature = createFeature({
  name: 'notifications',
  reducer: createReducer(
    initialNotificationsState,

    on(NotificationsActions.pageOpened, (_, { hospitalId }): NotificationsState => ({
      ...initialNotificationsState,
      hospitalId,
      status: 'loading-initial',
    })),

    // `pageOpened`/`retryRequested` já reiniciam `pendingItems` para `[]` (spread de
    // `initialNotificationsState`) antes deste success chegar — então acrescentar
    // (não substituir) funciona tanto para o 1º lote quanto para os lotes seguintes
    // do infinite scroll, que reusam esta mesma action (ver `loadNextBatch$`).
    // Bug corrigido: `pendingItems: page.items` apagava os lotes já carregados a
    // cada novo lote do infinite scroll.
    on(NotificationsActions.loadPendingPageSuccess, (state, { page }): NotificationsState => ({
      ...state,
      pendingItems: appendWithoutDuplicates(state.pendingItems, page.items),
      pendingCursor: page.nextCursor,
      pendingTotalCount: appendWithoutDuplicates(state.pendingItems, page.items).length,
      status: 'success',
      stale: false,
      errorMessage: null,
    })),

    on(NotificationsActions.loadPendingPageFailure, (state, { message }): NotificationsState => {
      // Mesma regra de degradação graciosa da Home: com dados em cache, só marca
      // `stale`; sem cache nenhum ainda, vira o erro de tela cheia (FR-016).
      if (state.pendingItems.length > 0 || state.resolvedItems.length > 0) {
        return { ...state, status: 'success', stale: true };
      }

      return { ...state, status: 'error', errorMessage: message };
    }),

    // Mesma correção de acréscimo (não substituição) do `loadPendingPageSuccess` acima.
    on(NotificationsActions.loadResolvedPageSuccess, (state, { page }): NotificationsState => ({
      ...state,
      resolvedItems: appendWithoutDuplicates(state.resolvedItems, page.items),
      resolvedCursor: page.nextCursor,
      resolvedTotalCount: appendWithoutDuplicates(state.resolvedItems, page.items).length,
      resolvedLoaded: true,
      status: 'success',
      stale: false,
    })),

    on(NotificationsActions.loadResolvedPageFailure, (state, { message }): NotificationsState => ({
      ...state,
      status: 'success',
      stale: true,
      errorMessage: message,
    })),

    on(NotificationsActions.loadNextBatchRequested, (state): NotificationsState => ({
      ...state,
      // A fase (pendente/resolvida) é decidida pelo effect a partir de `pendingCursor`/
      // `resolvedLoaded` (FR-004a: só carrega Resolvidas depois que Pendentes esgota,
      // incluindo a 1ª página de Resolvidas) — o reducer só reflete visualmente qual
      // seção está carregando o próximo lote.
      status: state.pendingCursor != null ? 'loading-more-pending' : 'loading-more-resolved',
    })),

    on(NotificationsActions.refreshRequested, (state): NotificationsState => ({
      ...state,
      status: 'refreshing',
    })),

    on(NotificationsActions.retryRequested, (_, { hospitalId }): NotificationsState => ({
      ...initialNotificationsState,
      hospitalId,
      status: 'loading-initial',
    })),

    // --- Fluxo de resposta via IA (User Story 3) ---

    on(NotificationsActions.answerStarted, (state, { notificationId }): NotificationsState => ({
      // FR-011: iniciar resposta em outro card descarta (sem enviar) o rascunho
      // anterior — trocar `answeringId` já cobre isso, sem lógica extra.
      ...state,
      answeringId: notificationId,
      draftText: '',
      submitting: false,
      answerErrorMessage: null,
    })),

    on(NotificationsActions.draftChanged, (state, { notificationId, text }): NotificationsState =>
      state.answeringId === notificationId ? { ...state, draftText: text } : state,
    ),

    on(NotificationsActions.answerSubmitted, (state): NotificationsState => ({
      ...state,
      submitting: true,
      answerErrorMessage: null,
    })),

    on(NotificationsActions.answerSubmitSuccess, (state, { notificationId, reply }): NotificationsState => ({
      ...applyReply(state, notificationId, reply),
      answeringId: null,
      draftText: '',
      submitting: false,
    })),

    on(NotificationsActions.answerSubmitFailure, (state, { message }): NotificationsState => ({
      // Falha de envio (Acceptance Scenario 6 de US3): permanece em modo
      // "answering" com o rascunho preservado, erro exibido no bottom sheet —
      // a notificação NÃO é alterada.
      ...state,
      submitting: false,
      answerErrorMessage: message,
    })),

    on(NotificationsActions.answerDiscarded, (state): NotificationsState => ({
      ...state,
      answeringId: null,
      draftText: '',
      submitting: false,
      answerErrorMessage: null,
      discardConfirmPending: false,
    })),

    on(NotificationsActions.resolveSuccess, (state, { notificationId }): NotificationsState => ({
      ...resolveNotification(state, notificationId),
      actionErrorMessage: null,
    })),
    on(NotificationsActions.resolveFailure, (state, { message }): NotificationsState => ({
      ...state,
      actionErrorMessage: message,
    })),
    on(NotificationsActions.resolveRequested, (state): NotificationsState => ({
      ...state,
      actionErrorMessage: null,
    })),
    on(NotificationsActions.discardConfirmationRequested, (state): NotificationsState => ({
      ...state,
      discardConfirmPending: hasUnsavedDraft(state),
    })),

    on(NotificationsActions.discardConfirmationCancelled, (state): NotificationsState => ({
      ...state,
      discardConfirmPending: false,
    })),
  ),
});

export const {
  name: notificationsFeatureKey,
  reducer: notificationsReducer,
  selectHospitalId,
  selectPendingItems,
  selectPendingCursor,
  selectPendingTotalCount,
  selectResolvedItems,
  selectResolvedCursor,
  selectResolvedTotalCount,
  selectResolvedLoaded,
  selectStatus,
  selectStale,
  selectErrorMessage,
  selectAnsweringId,
  selectDraftText,
  selectSubmitting,
  selectAnswerErrorMessage,
  selectActionErrorMessage,
  selectDiscardConfirmPending,
} = notificationsFeature;

/**
 * Há mais algum lote a carregar (pendente OU resolvida, incluindo a 1ª página
 * de Resolvidas ainda não buscada) — FR-004a. Centraliza a regra usada tanto
 * pelo effect de infinite scroll quanto pelo componente (sentinel).
 */
export const selectHasMore = createSelector(
  selectPendingCursor,
  selectResolvedCursor,
  selectResolvedLoaded,
  (pendingCursor, resolvedCursor, resolvedLoaded) => pendingCursor != null || !resolvedLoaded || resolvedCursor != null,
);

/**
 * Contagem total real (backend, não aproximada pelos itens já paginados) para o
 * cabeçalho "N Notificações" (FR-002) — convergence T053.
 */
export const selectTotalCount = createSelector(
  selectPendingTotalCount,
  selectResolvedTotalCount,
  (pendingTotalCount, resolvedTotalCount) => pendingTotalCount + resolvedTotalCount,
);
