import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, concatMap, filter, map, mergeMap, of, switchMap } from 'rxjs';

import { HomeApiService } from '../../home/data-access/home-api.service';
import { NotificationsApiService } from '../data-access/notifications-api.service';
import { NotificationsActions } from './notifications.actions';
import {
  type NotificationsTab,
  selectActiveTab,
  selectDraftText,
  selectHospitalId,
  selectPendingCursor,
  selectResolvedCursor,
  selectResolvedLoaded,
} from './notifications.reducer';

const ERROR_LOAD = 'Verifique sua conexão de internet e tente novamente em alguns instantes.';
const ERROR_NEXT_BATCH = 'Falha ao carregar o próximo lote de notificações.';
const ERROR_SUBMIT_REPLY = 'Não foi possível enviar sua resposta. Verifique sua conexão e tente novamente.';

/**
 * `pageOpened` sem `hospitalId` (entrada pelo Menu — research.md §8) resolve o
 * hospital em contexto reaproveitando `GET /api/v1/home/hospitals` (mesmo
 * endpoint/default da Home: primeiro hospital vinculado), sem exigir um
 * serviço de contexto global novo.
 */
export const resolveHospitalContext$ = createEffect(
  (actions$ = inject(Actions), homeApi = inject(HomeApiService)) => {
    return actions$.pipe(
      ofType(NotificationsActions.pageOpened),
      filter(({ hospitalId }) => hospitalId == null),
      switchMap(() =>
        homeApi.getHospitals().pipe(
          filter(hospitals => hospitals.length > 0),
          map(hospitals => NotificationsActions.pageOpened({ hospitalId: hospitals[0].id })),
          catchError(() => of(NotificationsActions.loadPendingPageFailure({ message: ERROR_LOAD }))),
        ),
      ),
    );
  },
  { functional: true },
);

/** `pageOpened` com `hospitalId` resolvido → 1º lote da seção Pendentes (FR-004a). */
export const loadPendingPage$ = createEffect(
  (actions$ = inject(Actions), api = inject(NotificationsApiService)) => {
    return actions$.pipe(
      ofType(NotificationsActions.pageOpened, NotificationsActions.retryRequested),
      filter(({ hospitalId }) => hospitalId != null),
      switchMap(({ hospitalId }) =>
        api.getNotifications(hospitalId as number, 'pending', null).pipe(
          map(page => NotificationsActions.loadPendingPageSuccess({ page })),
          catchError(() => of(NotificationsActions.loadPendingPageFailure({ message: ERROR_LOAD }))),
        ),
      ),
    );
  },
  { functional: true },
);

/**
 * Infinite scroll (FR-002) da aba selecionada: cada aba tem cursor próprio. Em
 * Resolvidas, a 1ª página (ainda não buscada, `resolvedLoaded` falso) usa cursor nulo.
 */
export const loadNextBatch$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(NotificationsApiService)) => {
    return actions$.pipe(
      ofType(NotificationsActions.loadNextBatchRequested),
      concatLatestFrom(() => [
        store.select(selectHospitalId),
        store.select(selectActiveTab),
        store.select(selectPendingCursor),
        store.select(selectResolvedCursor),
        store.select(selectResolvedLoaded),
      ]),
      filter(
        (
          tuple,
        ): tuple is [
          ReturnType<typeof NotificationsActions.loadNextBatchRequested>,
          number,
          NotificationsTab,
          string | null,
          string | null,
          boolean,
        ] => tuple[1] != null && (tuple[2] === 'pending' ? tuple[3] != null : !tuple[5] || tuple[4] != null),
      ),
      switchMap(([, hospitalId, status, pendingCursor, resolvedCursor]) => {
        const cursor = status === 'pending' ? pendingCursor : resolvedCursor;

        return api.getNotifications(hospitalId, status, cursor).pipe(
          map(page =>
            status === 'pending'
              ? NotificationsActions.loadPendingPageSuccess({ page })
              : NotificationsActions.loadResolvedPageSuccess({ page }),
          ),
          catchError(() =>
            of(
              status === 'pending'
                ? NotificationsActions.loadPendingPageFailure({ message: ERROR_NEXT_BATCH })
                : NotificationsActions.loadResolvedPageFailure({ message: ERROR_NEXT_BATCH }),
            ),
          ),
        );
      }),
    );
  },
  { functional: true },
);

/** Trocar para Resolvidas pela 1ª vez busca a 1ª página dela (Ativas já vem com a abertura da tela). */
export const loadResolvedOnTabSelected$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) => {
    return actions$.pipe(
      ofType(NotificationsActions.tabSelected),
      filter(({ tab }) => tab === 'resolved'),
      concatLatestFrom(() => store.select(selectResolvedLoaded)),
      filter(([, loaded]) => !loaded),
      map(() => NotificationsActions.loadNextBatchRequested()),
    );
  },
  { functional: true },
);

/**
 * Envio da resposta (US3, FR-009) — `answerSubmitted` (despachada por
 * `notifications.component.ts` ao confirmar no bottom sheet, com o
 * `notificationId` do card em edição) lê o `draftText` atual do estado
 * (fonte única do texto) e chama `POST /{id}/replies`. Falha preserva o
 * rascunho (Acceptance Scenario 6) — o componente exibe `answerErrorMessage`
 * no bottom sheet sem fechar.
 */
export const submitReply$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(NotificationsApiService)) => {
    return actions$.pipe(
      ofType(NotificationsActions.answerSubmitted),
      concatLatestFrom(() => store.select(selectDraftText)),
      switchMap(([{ notificationId }, draftText]) =>
        api.createReply(notificationId, draftText).pipe(
          map(reply => NotificationsActions.answerSubmitSuccess({ notificationId, reply })),
          catchError(() =>
            of(NotificationsActions.answerSubmitFailure({ notificationId, message: ERROR_SUBMIT_REPLY })),
          ),
        ),
      ),
    );
  },
  { functional: true },
);

/** Botão ✓ do card: marca como resolvida e move o card para a seção Resolvidas. */
export const resolveNotification$ = createEffect(
  (actions$ = inject(Actions), api = inject(NotificationsApiService)) => {
    return actions$.pipe(
      ofType(NotificationsActions.resolveRequested),
      concatMap(({ notificationId }) =>
        api.resolve(notificationId).pipe(
          map(() => NotificationsActions.resolveSuccess({ notificationId })),
          catchError(() =>
            of(
              NotificationsActions.resolveFailure({
                notificationId,
                message: 'Não foi possível resolver a notificação.',
              }),
            ),
          ),
        ),
      ),
    );
  },
  { functional: true },
);

/** Pull-to-refresh (FR-004b) — reinicia as duas seções do zero. */
export const refresh$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) => {
    return actions$.pipe(
      ofType(NotificationsActions.refreshRequested),
      concatLatestFrom(() => [store.select(selectHospitalId), store.select(selectActiveTab)]),
      filter(
        (tuple): tuple is [ReturnType<typeof NotificationsActions.refreshRequested>, number, NotificationsTab] =>
          tuple[1] != null,
      ),
      // `pageOpened` reinicia tudo (volta para Ativas); reaplica a aba em que o profissional estava.
      mergeMap(([, hospitalId, tab]) =>
        tab === 'resolved'
          ? [NotificationsActions.pageOpened({ hospitalId }), NotificationsActions.tabSelected({ tab })]
          : [NotificationsActions.pageOpened({ hospitalId })],
      ),
    );
  },
  { functional: true },
);
