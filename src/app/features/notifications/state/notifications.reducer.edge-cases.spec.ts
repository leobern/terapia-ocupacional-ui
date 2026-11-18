import { Notification } from '../notifications.models';
import { NotificationsActions } from './notifications.actions';
import { initialNotificationsState, notificationsFeature } from './notifications.reducer';

const { reducer } = notificationsFeature;

function notification(id: number, createdAt = new Date().toISOString()): Notification {
  return {
    author: { id: 1, name: 'Jairo', photoUrl: null, specialty: 'Enfermeiro' },
    createdAt,
    description: 'Descrição ' + id,
    id,
    patient: { id: 10, name: 'José' },
    read: false,
    replies: [],
    replyCount: 0,
  };
}

describe('notificationsFeature reducer — casos de borda', () => {
  const reply = { author: notification(1).author, createdAt: new Date().toISOString(), id: 1, text: 'ok' };

  it('resposta a uma notificação que não está nas pendentes não altera o estado', () => {
    const state = { ...initialNotificationsState, answeringId: 99, pendingItems: [notification(1)] };

    expect(reducer(state, NotificationsActions.answerSubmitSuccess({ notificationId: 99, reply }))).toEqual(
      jasmine.objectContaining({ pendingItems: state.pendingItems }),
    );
  });

  it('resposta move a notificação para as resolvidas, mantendo a ordem da mais recente para a mais antiga', () => {
    const older = notification(2, '2020-01-01T10:00:00.000Z');
    const newer = notification(1, '2030-01-01T10:00:00.000Z');
    const state = { ...initialNotificationsState, answeringId: 1, pendingItems: [newer], resolvedItems: [older] };
    const next = reducer(state, NotificationsActions.answerSubmitSuccess({ notificationId: 1, reply }));

    expect(next.pendingItems.length).toBe(0);
    expect(next.resolvedItems.map(n => n.id)).toEqual([1, 2]);
    expect(next.resolvedItems[0].replyCount).toBe(1);
  });

  it('loadResolvedPageFailure mantém o que já há e volta para success', () => {
    const state = {
      ...initialNotificationsState,
      pendingItems: [notification(1)],
      status: 'loading-more-resolved' as const,
    };
    const next = reducer(state, NotificationsActions.loadResolvedPageFailure({ message: 'x' }));

    expect(next.status).toBe('success');
    expect(next.pendingItems.length).toBe(1);
  });

  it('draftChanged de outra notificação é ignorado', () => {
    const state = { ...initialNotificationsState, answeringId: 1, draftText: 'a' };

    expect(reducer(state, NotificationsActions.draftChanged({ notificationId: 2, text: 'b' })).draftText).toBe('a');
    expect(reducer(state, NotificationsActions.draftChanged({ notificationId: 1, text: 'b' })).draftText).toBe('b');
  });

  it('answerSubmitted marca o envio em andamento', () => {
    const state = { ...initialNotificationsState, answeringId: 1, draftText: 'a' };

    expect(reducer(state, NotificationsActions.answerSubmitted({ notificationId: 1 })).submitting).toBeTrue();
  });

  it('discardConfirmationCancelled fecha o diálogo de descarte', () => {
    const state = { ...initialNotificationsState, discardConfirmPending: true };

    expect(reducer(state, NotificationsActions.discardConfirmationCancelled()).discardConfirmPending).toBeFalse();
  });
});
