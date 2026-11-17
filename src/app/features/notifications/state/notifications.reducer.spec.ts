import { Notification } from '../notifications.models';
import { NotificationsActions } from './notifications.actions';
import { initialNotificationsState, notificationsFeature, selectHasMore } from './notifications.reducer';

const { reducer } = notificationsFeature;

function notification(id: number, overrides: Partial<Notification> = {}): Notification {
  return {
    id,
    author: { id: 1, name: 'Jairo Nepomuceno', specialty: 'Enfermeiro', photoUrl: null },
    patient: { id: 10, name: 'José da Silva' },
    description: 'Descrição ' + id,
    createdAt: new Date().toISOString(),
    read: false,
    replyCount: 0,
    replies: [],
    ...overrides,
  };
}

describe('notificationsFeature reducer', () => {
  it('inicia em loading-initial (evita flash de conteúdo vazio antes do skeleton)', () => {
    expect(initialNotificationsState.status).toBe('loading-initial');
  });

  it('pageOpened reinicia o estado com o hospitalId informado', () => {
    const state = reducer(initialNotificationsState, NotificationsActions.pageOpened({ hospitalId: 1 }));

    expect(state.hospitalId).toBe(1);
    expect(state.status).toBe('loading-initial');
  });

  it('loadPendingPageSuccess popula a seção Pendentes e a contagem real (totalCount)', () => {
    const page = { items: [notification(1), notification(2)], nextCursor: 'abc', totalCount: 2 };
    const state = reducer(initialNotificationsState, NotificationsActions.loadPendingPageSuccess({ page }));

    expect(state.status).toBe('success');
    expect(state.pendingItems.length).toBe(2);
    expect(state.pendingCursor).toBe('abc');
    expect(state.pendingTotalCount).toBe(2);
  });

  it('loadPendingPageSuccess ACRESCENTA ao lote anterior em vez de substituir (bug fixado — infinite scroll)', () => {
    const primeiroLote = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: 'c1', totalCount: 15 },
      }),
    );

    const state = reducer(
      primeiroLote,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(2)], nextCursor: 'c2', totalCount: 15 },
      }),
    );

    expect(state.pendingItems.map(n => n.id)).toEqual([1, 2]);
    expect(state.pendingCursor).toBe('c2');
  });

  it('loadPendingPageSuccess não duplica um item que já está na lista (proteção defensiva)', () => {
    const primeiroLote = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: null, totalCount: 1 },
      }),
    );

    const state = reducer(
      primeiroLote,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: null, totalCount: 1 },
      }),
    );

    expect(state.pendingItems.length).toBe(1);
  });

  it('loadResolvedPageSuccess popula a seção Resolvidas sem afetar Pendentes', () => {
    const comPendentes = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: null, totalCount: 1 },
      }),
    );

    const state = reducer(
      comPendentes,
      NotificationsActions.loadResolvedPageSuccess({
        page: { items: [notification(2, { replyCount: 1 })], nextCursor: null, totalCount: 1 },
      }),
    );

    expect(state.pendingItems.length).toBe(1);
    expect(state.resolvedItems.length).toBe(1);
  });

  it('loadPendingPageFailure sem dados em cache vira erro de tela cheia (FR-016)', () => {
    const state = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageFailure({ message: 'falhou' }),
    );

    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('falhou');
  });

  it('loadPendingPageFailure com dados em cache mantém o último sucesso e marca stale (Comportamento Offline)', () => {
    const comSucesso = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: null, totalCount: 1 },
      }),
    );

    const state = reducer(comSucesso, NotificationsActions.loadPendingPageFailure({ message: 'sem conexão' }));

    expect(state.status).toBe('success');
    expect(state.stale).toBeTrue();
    expect(state.pendingItems.length).toBe(1);
  });

  it('loadNextBatchRequested marca loading-more-pending enquanto pendingCursor não for nulo (FR-004a)', () => {
    const comPendentes = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: 'c1', totalCount: 1 },
      }),
    );

    const state = reducer(comPendentes, NotificationsActions.loadNextBatchRequested());

    expect(state.status).toBe('loading-more-pending');
  });

  it('loadNextBatchRequested marca loading-more-resolved quando pendingCursor já esgotou (FR-004a)', () => {
    const comPendentesEsgotados = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: null, totalCount: 1 },
      }),
    );

    const state = reducer(comPendentesEsgotados, NotificationsActions.loadNextBatchRequested());

    expect(state.status).toBe('loading-more-resolved');
  });

  it('refreshRequested marca o status refreshing (pull-to-refresh, FR-004b)', () => {
    const state = reducer(initialNotificationsState, NotificationsActions.refreshRequested());

    expect(state.status).toBe('refreshing');
  });

  it('selectHasMore continua true quando Pendentes esgota mas Resolvidas ainda não foi buscada (bug fixado)', () => {
    const pendentesEsgotados = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: null, totalCount: 1 },
      }),
    );

    // Antes da correção, `resolvedCursor` e `pendingCursor` nulos eram
    // indistinguíveis de "nada mais a carregar" — `resolvedLoaded` desambigua.
    expect(selectHasMore.projector(null, null, pendentesEsgotados.resolvedLoaded)).toBeTrue();
  });

  it('selectHasMore vira false só depois que Resolvidas também esgota', () => {
    const comResolvidasEsgotadas = reducer(
      initialNotificationsState,
      NotificationsActions.loadResolvedPageSuccess({
        page: { items: [notification(1)], nextCursor: null, totalCount: 1 },
      }),
    );

    expect(selectHasMore.projector(null, null, comResolvidasEsgotadas.resolvedLoaded)).toBeFalse();
  });

  it('answerStarted troca o rascunho ao iniciar resposta em outro card (FR-011)', () => {
    const respondendoCard1 = reducer(
      reducer(initialNotificationsState, NotificationsActions.answerStarted({ notificationId: 1 })),
      NotificationsActions.draftChanged({ notificationId: 1, text: 'rascunho perdido' }),
    );

    const state = reducer(respondendoCard1, NotificationsActions.answerStarted({ notificationId: 2 }));

    expect(state.answeringId).toBe(2);
    expect(state.draftText).toBe('');
  });

  it('answerSubmitSuccess migra a notificação de Pendentes para Resolvidas', () => {
    const comPendente = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: null, totalCount: 1 },
      }),
    );
    const respondendo = reducer(comPendente, NotificationsActions.answerStarted({ notificationId: 1 }));

    const state = reducer(
      respondendo,
      NotificationsActions.answerSubmitSuccess({
        notificationId: 1,
        reply: {
          id: 1,
          author: { id: 7, name: 'Michelle Franklin', specialty: 'Nutróloga', photoUrl: null },
          text: 'ok',
          createdAt: new Date().toISOString(),
        },
      }),
    );

    expect(state.pendingItems.length).toBe(0);
    expect(state.resolvedItems.length).toBe(1);
    expect(state.resolvedItems[0].replyCount).toBe(1);
    expect(state.answeringId).toBeNull();
  });

  it('answerSubmitSuccess numa notificação já resolvida só incrementa a contagem (2ª resposta)', () => {
    const comResolvida = reducer(
      initialNotificationsState,
      NotificationsActions.loadResolvedPageSuccess({
        page: { items: [notification(1, { replyCount: 1 })], nextCursor: null, totalCount: 1 },
      }),
    );

    const state = reducer(
      comResolvida,
      NotificationsActions.answerSubmitSuccess({
        notificationId: 1,
        reply: {
          id: 2,
          author: { id: 7, name: 'Michelle Franklin', specialty: 'Nutróloga', photoUrl: null },
          text: 'ok',
          createdAt: new Date().toISOString(),
        },
      }),
    );

    expect(state.resolvedItems.length).toBe(1);
    expect(state.resolvedItems[0].replyCount).toBe(2);
  });

  it('answerSubmitFailure preserva o rascunho e não altera a notificação (Acceptance Scenario 6)', () => {
    const respondendo = reducer(
      reducer(initialNotificationsState, NotificationsActions.answerStarted({ notificationId: 1 })),
      NotificationsActions.draftChanged({ notificationId: 1, text: 'meu rascunho' }),
    );

    const state = reducer(
      respondendo,
      NotificationsActions.answerSubmitFailure({ notificationId: 1, message: 'falhou' }),
    );

    expect(state.answeringId).toBe(1);
    expect(state.draftText).toBe('meu rascunho');
    expect(state.answerErrorMessage).toBe('falhou');
    expect(state.submitting).toBeFalse();
  });

  it('answerDiscarded limpa o rascunho sem alterar a notificação (FR-010)', () => {
    const respondendo = reducer(initialNotificationsState, NotificationsActions.answerStarted({ notificationId: 1 }));

    const state = reducer(respondendo, NotificationsActions.answerDiscarded());

    expect(state.answeringId).toBeNull();
    expect(state.draftText).toBe('');
  });

  it('discardConfirmationRequested só ativa o diálogo quando há rascunho em edição', () => {
    const semRascunho = reducer(initialNotificationsState, NotificationsActions.discardConfirmationRequested());

    expect(semRascunho.discardConfirmPending).toBeFalse();

    const comRascunho = reducer(
      reducer(initialNotificationsState, NotificationsActions.answerStarted({ notificationId: 1 })),
      NotificationsActions.discardConfirmationRequested(),
    );

    expect(comRascunho.discardConfirmPending).toBeTrue();
  });

  it('retryRequested reinicia o estado para o hospitalId atual', () => {
    const comErro = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageFailure({ message: 'falhou' }),
    );

    const state = reducer(comErro, NotificationsActions.retryRequested({ hospitalId: 1 }));

    expect(state.status).toBe('loading-initial');
    expect(state.errorMessage).toBeNull();
    expect(state.hospitalId).toBe(1);
  });
});
