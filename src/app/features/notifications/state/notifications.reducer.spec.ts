import { Notification } from '../notifications.models';
import { NotificationsActions } from './notifications.actions';
import {
  initialNotificationsState,
  notificationsFeature,
  NotificationsState,
  selectHasMore,
  selectTotalCount,
} from './notifications.reducer';

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
    type: 'patient_message',
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

  it('loadNextBatchRequested marca loading-more-resolved quando a aba Resolvidas está selecionada', () => {
    const naAbaResolvidas = reducer(initialNotificationsState, NotificationsActions.tabSelected({ tab: 'resolved' }));

    const state = reducer(naAbaResolvidas, NotificationsActions.loadNextBatchRequested());

    expect(state.activeTab).toBe('resolved');
    expect(state.status).toBe('loading-more-resolved');
  });

  it('a aba Ativas é a padrão e pageOpened volta para ela', () => {
    expect(initialNotificationsState.activeTab).toBe('pending');

    const state = reducer(
      { ...initialNotificationsState, activeTab: 'resolved' },
      NotificationsActions.pageOpened({ hospitalId: 1 }),
    );

    expect(state.activeTab).toBe('pending');
  });

  it('loadResolvedPageSuccess mantém Resolvidas da mais recente para a mais antiga', () => {
    const state = reducer(
      {
        ...initialNotificationsState,
        resolvedItems: [notification(1, { createdAt: '2020-01-01T10:00:00.000Z' })],
      },
      NotificationsActions.loadResolvedPageSuccess({
        page: {
          items: [notification(2, { createdAt: '2030-01-01T10:00:00.000Z' })],
          nextCursor: null,
          totalCount: 2,
        },
      }),
    );

    expect(state.resolvedItems.map(n => n.id)).toEqual([2, 1]);
  });

  it('refreshRequested marca o status refreshing (pull-to-refresh, FR-004b)', () => {
    const state = reducer(initialNotificationsState, NotificationsActions.refreshRequested());

    expect(state.status).toBe('refreshing');
  });

  it('selectHasMore em Ativas depende só do cursor de Ativas (cada aba pagina sozinha)', () => {
    expect(selectHasMore.projector('pending', 'c1', null, false)).toBeTrue();
    expect(selectHasMore.projector('pending', null, null, false)).toBeFalse();
  });

  it('selectHasMore em Resolvidas é true antes da 1ª página e enquanto houver cursor', () => {
    expect(selectHasMore.projector('resolved', null, null, false)).toBeTrue();
    expect(selectHasMore.projector('resolved', null, 'c2', true)).toBeTrue();
    expect(selectHasMore.projector('resolved', 'c1', null, true)).toBeFalse();
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

    expect(state.pendingItems.length).toBe(1);
    expect(state.pendingItems[0].replyCount).toBe(1);
    expect(state.pendingItems[0].replies.length).toBe(1);
    expect(state.resolvedItems.length).toBe(0);
    expect(state.answeringId).toBeNull();
  });

  it('answerSubmitSuccess numa notificação já resolvida a reabre e a devolve para Ativas', () => {
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

    expect(state.resolvedItems.length).toBe(0);
    expect(state.pendingItems.length).toBe(1);
    expect(state.pendingItems[0].replyCount).toBe(2);
    expect(state.pendingTotalCount).toBe(1);
    expect(state.resolvedTotalCount).toBe(0);
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

  it('resolveSuccess move a notificação de Pendentes para Resolvidas e ajusta as contagens', () => {
    const loaded = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1), notification(2)], nextCursor: null, totalCount: 2 },
      }),
    );

    const state = reducer(loaded, NotificationsActions.resolveSuccess({ notificationId: 1 }));

    expect(state.pendingItems.map(n => n.id)).toEqual([2]);
    expect(state.resolvedItems.map(n => n.id)).toEqual([1]);
    expect(state.pendingTotalCount).toBe(1);
    expect(state.resolvedTotalCount).toBe(1);
  });

  it('resolveFailure mantém a thread pendente e guarda a mensagem; novo pedido limpa o erro', () => {
    const loaded = reducer(
      initialNotificationsState,
      NotificationsActions.loadPendingPageSuccess({
        page: { items: [notification(1)], nextCursor: null, totalCount: 1 },
      }),
    );
    const failed = reducer(loaded, NotificationsActions.resolveFailure({ notificationId: 1, message: 'erro' }));

    expect(failed.pendingItems.length).toBe(1);
    expect(failed.resolveErrorMessage).toBe('erro');
    expect(
      reducer(failed, NotificationsActions.resolveRequested({ notificationId: 1 })).resolveErrorMessage,
    ).toBeNull();
  });

  it('resolveSuccess de uma notificação desconhecida não altera o estado', () => {
    const state = reducer(initialNotificationsState, NotificationsActions.resolveSuccess({ notificationId: 99 }));

    expect(state).toBe(initialNotificationsState);
  });

  it('selectTotalCount soma pendentes e resolvidas', () => {
    expect(selectTotalCount.projector(3, 4)).toBe(7);
  });

  describe('rascunhos guardados por notificação (Cancelar)', () => {
    const comRascunho = (): NotificationsState => {
      const respondendo = reducer(initialNotificationsState, NotificationsActions.answerStarted({ notificationId: 1 }));

      return reducer(respondendo, NotificationsActions.draftChanged({ notificationId: 1, text: 'Alinhado' }));
    };

    it('answerCancelled guarda o texto como rascunho da notificação e fecha o campo', () => {
      const state = reducer(comRascunho(), NotificationsActions.answerCancelled());

      expect(state.answeringId).toBeNull();
      expect(state.draftText).toBe('');
      expect(state.drafts).toEqual({ 1: 'Alinhado' });
    });

    it('answerCancelled sem texto não guarda rascunho e descarta o que havia guardado', () => {
      const guardado = reducer(comRascunho(), NotificationsActions.answerCancelled());
      const reaberto = reducer(guardado, NotificationsActions.answerStarted({ notificationId: 1 }));
      const apagado = reducer(reaberto, NotificationsActions.draftChanged({ notificationId: 1, text: '  ' }));
      const state = reducer(apagado, NotificationsActions.answerCancelled());

      expect(state.drafts).toEqual({});
    });

    it('answerCancelled sem resposta em andamento só limpa o campo', () => {
      const state = reducer(initialNotificationsState, NotificationsActions.answerCancelled());

      expect(state.drafts).toEqual({});
      expect(state.answeringId).toBeNull();
    });

    it('answerStarted retoma o rascunho guardado daquela notificação', () => {
      const guardado = reducer(comRascunho(), NotificationsActions.answerCancelled());
      const state = reducer(guardado, NotificationsActions.answerStarted({ notificationId: 1 }));

      expect(state.draftText).toBe('Alinhado');
    });

    it('enviar a resposta remove o rascunho daquela notificação e mantém os outros', () => {
      const guardado = reducer(comRascunho(), NotificationsActions.answerCancelled());
      const comOutro = { ...guardado, drafts: { ...guardado.drafts, 2: 'Outro' } };
      const state = reducer(
        comOutro,
        NotificationsActions.answerSubmitSuccess({ notificationId: 1, reply: {} as never }),
      );

      expect(state.drafts).toEqual({ 2: 'Outro' });
    });
  });

  it('markAsReadRequested marca como lidas as notificações informadas, em ambas as abas', () => {
    const state = reducer(
      {
        ...initialNotificationsState,
        pendingItems: [notification(1), notification(2)],
        resolvedItems: [notification(3)],
      },
      NotificationsActions.markAsReadRequested({ notificationIds: [1, 3] }),
    );

    expect(state.pendingItems.map(n => n.read)).toEqual([true, false]);
    expect(state.resolvedItems[0].read).toBeTrue();
  });
});
