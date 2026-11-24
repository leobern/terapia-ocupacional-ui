import { createFeature, createReducer, createSelector, on } from '@ngrx/store';

import { Notification } from '../notifications.models';
import { NotificationsActions } from './notifications.actions';

export type NotificationsStatus =
  'idle' | 'loading-initial' | 'success' | 'error' | 'loading-more-pending' | 'loading-more-resolved' | 'refreshing';

/** Aba (visão) da tela: Ativas (padrão) ou Resolvidas — FR-003. */
export type NotificationsTab = 'pending' | 'resolved';

export interface NotificationsState {
  /** Aba selecionada; cada aba pagina de forma independente. */
  activeTab: NotificationsTab;
  hospitalId: number | null;
  pendingItems: Notification[];
  pendingCursor: string | null;
  /** Contagem total (não paginada) — convergence T053, vem de `NotificationPage.totalCount`. */
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
  /** Falha ao resolver a thread (texto; a thread permanece pendente). */
  resolveErrorMessage: string | null;
  /** Diálogo "Descartar resposta não enviada?" pendente (FR-010a/FR-004b). */
  discardConfirmPending: boolean;
}

export const initialNotificationsState: NotificationsState = {
  activeTab: 'pending',
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
  resolveErrorMessage: null,
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

function sortNewestFirst(items: Notification[]): Notification[] {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
}

/** `true` quando há um rascunho em edição que seria perdido se descartado agora. */
function hasUnsavedDraft(state: NotificationsState): boolean {
  return state.answeringId != null;
}

/**
 * Registra o incremento de `replyCount` de uma resposta bem-sucedida,
 * preservando a ordem cronológica da própria notificação (não da resposta)
 * dentro de Resolvidas — data-model.md §5. Cobre os dois casos: (a) a
 * notificação estava em Pendentes → migra para Resolvidas; (b) já estava em
 * Resolvidas (responder de novo a uma notificação já respondida) → só
 * atualiza a contagem, sem duplicar nem mover.
 */
function moveToResolved(state: NotificationsState, notificationId: number): NotificationsState {
  const jaResolvida = state.resolvedItems.some(item => item.id === notificationId);

  if (jaResolvida) {
    return {
      ...state,
      resolvedItems: state.resolvedItems.map(item =>
        item.id === notificationId ? { ...item, replyCount: item.replyCount + 1 } : item,
      ),
    };
  }

  const notification = state.pendingItems.find(item => item.id === notificationId);

  if (!notification) {
    return state;
  }
  const updated: Notification = { ...notification, replyCount: notification.replyCount + 1 };
  const resolvedItems = [...state.resolvedItems, updated].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    ...state,
    pendingItems: state.pendingItems.filter(item => item.id !== notificationId),
    // Ajuste otimista dos totais (T053) — reflete no cabeçalho a migração de
    // seção imediatamente, sem esperar um novo fetch; o próximo pull-to-refresh
    // (ou reabertura da tela) reconcilia com o valor real do backend de qualquer forma.
    pendingTotalCount: Math.max(0, state.pendingTotalCount - 1),
    resolvedItems,
    resolvedTotalCount: state.resolvedTotalCount + 1,
  };
}

/** Botão ✓: move da seção Pendentes para Resolvidas, sem mexer na contagem de respostas. */
function resolveNotification(state: NotificationsState, notificationId: number): NotificationsState {
  const notification = state.pendingItems.find(item => item.id === notificationId);

  if (!notification) {
    return state;
  }
  const resolvedItems = [...state.resolvedItems, notification].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    ...state,
    pendingItems: state.pendingItems.filter(item => item.id !== notificationId),
    pendingTotalCount: Math.max(0, state.pendingTotalCount - 1),
    resolvedItems,
    resolvedTotalCount: state.resolvedTotalCount + 1,
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
      pendingTotalCount: page.totalCount ?? 0,
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
      resolvedItems: sortNewestFirst(appendWithoutDuplicates(state.resolvedItems, page.items)),
      resolvedCursor: page.nextCursor,
      resolvedTotalCount: page.totalCount ?? 0,
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
      // Cada aba pagina sozinha: o lote pedido é sempre o da aba selecionada.
      status: state.activeTab === 'pending' ? 'loading-more-pending' : 'loading-more-resolved',
    })),

    on(NotificationsActions.markAsReadRequested, (state, { notificationIds }): NotificationsState => {
      const markRead = (items: Notification[]): Notification[] =>
        items.map(item => (notificationIds.includes(item.id) && !item.read ? { ...item, read: true } : item));

      return { ...state, pendingItems: markRead(state.pendingItems), resolvedItems: markRead(state.resolvedItems) };
    }),

    on(NotificationsActions.tabSelected, (state, { tab }): NotificationsState => ({ ...state, activeTab: tab })),

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

    on(NotificationsActions.answerSubmitSuccess, (state, { notificationId }): NotificationsState => ({
      ...moveToResolved(state, notificationId),
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

    on(NotificationsActions.resolveRequested, (state): NotificationsState => ({ ...state, resolveErrorMessage: null })),
    on(NotificationsActions.resolveSuccess, (state, { notificationId }): NotificationsState => {
      const next = resolveNotification(state, notificationId);

      return next === state ? state : { ...next, resolveErrorMessage: null };
    }),
    on(NotificationsActions.resolveFailure, (state, { message }): NotificationsState => ({
      ...state,
      resolveErrorMessage: message,
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
  selectActiveTab,
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
  selectResolveErrorMessage,
  selectDiscardConfirmPending,
} = notificationsFeature;

/**
 * Há mais algum lote a carregar na aba selecionada (FR-002). Em Resolvidas, a 1ª
 * página ainda não buscada (`resolvedLoaded` falso) também conta como "há mais".
 */
export const selectHasMore = createSelector(
  selectActiveTab,
  selectPendingCursor,
  selectResolvedCursor,
  selectResolvedLoaded,
  (tab, pendingCursor, resolvedCursor, resolvedLoaded) =>
    tab === 'pending' ? pendingCursor != null : !resolvedLoaded || resolvedCursor != null,
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
