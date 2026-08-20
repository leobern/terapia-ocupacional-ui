import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, filter, forkJoin, map, of, switchMap } from 'rxjs';

import { HomeApiService } from '../data-access/home-api.service';
import { HomeActions } from './home.actions';
import { selectNextCursor, selectSelectedHospitalId } from './home.reducer';

const ERROR_LOAD = 'Verifique sua conexão de internet e tente novamente em alguns instantes.';
const ERROR_HOSPITALS = 'Não foi possível carregar os hospitais vinculados.';
const ERROR_NEXT_BATCH = 'Falha ao carregar o próximo lote de notificações.';

/** `HomeActions.pageOpened` → busca os hospitais vinculados ao profissional (FR-009). */
export const loadHospitals$ = createEffect(
  (actions$ = inject(Actions), api = inject(HomeApiService)) => {
    return actions$.pipe(
      ofType(HomeActions.pageOpened),
      switchMap(() =>
        api.getHospitals().pipe(
          map(hospitals => HomeActions.loadHospitalsSuccess({ hospitals })),
          catchError(() => of(HomeActions.loadDataFailure({ message: ERROR_HOSPITALS }))),
        ),
      ),
    );
  },
  { functional: true },
);

/**
 * Assim que os hospitais chegam (1ª carga) ou o profissional troca de
 * hospital (US3), dispara o carregamento de dados para o hospital em
 * contexto.
 */
export const loadDataOnHospitalContext$ = createEffect(
  (actions$ = inject(Actions)) => {
    return actions$.pipe(
      ofType(HomeActions.loadHospitalsSuccess, HomeActions.hospitalSelected),
      map(action => ('hospitalId' in action ? action.hospitalId : action.hospitals[0]?.id)),
      filter((hospitalId): hospitalId is number => hospitalId != null),
      map(hospitalId => HomeActions.loadData({ hospitalId })),
    );
  },
  { functional: true },
);

/** `HomeActions.loadData` → `GET /home/summary` + `GET /home/notifications` (1º lote). */
export const loadData$ = createEffect(
  (actions$ = inject(Actions), api = inject(HomeApiService)) => {
    return actions$.pipe(
      ofType(HomeActions.loadData),
      switchMap(({ hospitalId }) =>
        forkJoin({
          summary: api.getSummary(hospitalId),
          page: api.getNotifications(hospitalId, null),
        }).pipe(
          map(({ summary, page }) => HomeActions.loadDataSuccess({ summary, page })),
          catchError(() => of(HomeActions.loadDataFailure({ message: ERROR_LOAD }))),
        ),
      ),
    );
  },
  { functional: true },
);

/** Botão "Tentar novamente" (FR-014) — refaz o carregamento para o hospital atual. */
export const retry$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) => {
    return actions$.pipe(
      ofType(HomeActions.retryRequested),
      concatLatestFrom(() => store.select(selectSelectedHospitalId)),
      filter((tuple): tuple is [ReturnType<typeof HomeActions.retryRequested>, number] => tuple[1] != null),
      map(([, hospitalId]) => HomeActions.loadData({ hospitalId })),
    );
  },
  { functional: true },
);

/** Infinite scroll (FR-004) — próximo lote de até 10 notificações via cursor. */
export const loadNextBatch$ = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(HomeApiService)) => {
    return actions$.pipe(
      ofType(HomeActions.loadNextBatch),
      concatLatestFrom(() => [store.select(selectSelectedHospitalId), store.select(selectNextCursor)]),
      filter(
        (tuple): tuple is [ReturnType<typeof HomeActions.loadNextBatch>, number, string] =>
          tuple[1] != null && tuple[2] != null,
      ),
      switchMap(([, hospitalId, cursor]) =>
        api.getNotifications(hospitalId, cursor).pipe(
          map(page => HomeActions.loadNextBatchSuccess({ page })),
          catchError(() => of(HomeActions.loadNextBatchFailure({ message: ERROR_NEXT_BATCH }))),
        ),
      ),
    );
  },
  { functional: true },
);
