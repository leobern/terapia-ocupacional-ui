import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, Observable, of, take } from 'rxjs';

import { NotificationsComponent } from './notifications.component';
import { NotificationsActions } from './state/notifications.actions';
import { selectAnsweringId } from './state/notifications.reducer';

/**
 * Guarda a saída da tela "Notificações" quando há um rascunho de resposta não
 * enviado (FR-010a/FR-004b) — cobre qualquer forma de navegar para fora
 * (Menu, voltar do navegador etc.), não só o clique específico no Menu.
 * Dispara o diálogo de confirmação (via NgRx, renderizado em
 * `notifications.component.html`) e resolve a navegação a partir da
 * resposta do usuário.
 */
export const canDeactivateNotifications: CanDeactivateFn<NotificationsComponent> = (): Observable<boolean> => {
  const store = inject(Store);
  const actions$ = inject(Actions);

  let answeringId: number | null = null;

  store
    .select(selectAnsweringId)
    .subscribe(id => (answeringId = id))
    .unsubscribe();

  if (answeringId == null) {
    return of(true);
  }

  store.dispatch(NotificationsActions.discardConfirmationRequested());

  return actions$.pipe(
    ofType(NotificationsActions.answerDiscarded, NotificationsActions.discardConfirmationCancelled),
    take(1),
    map(action => action.type === NotificationsActions.answerDiscarded.type),
  );
};
