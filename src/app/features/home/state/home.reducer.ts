import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';

import { HomeNotification, HomeSummary, Hospital } from '../home.models';
import { HomeActions } from './home.actions';

export type HomeStatus = 'idle' | 'loading-initial' | 'success' | 'error' | 'loading-more';

export interface HomeState extends EntityState<HomeNotification> {
  hospitals: Hospital[];
  selectedHospitalId: number | null;
  summary: HomeSummary | null;
  nextCursor: string | null;
  status: HomeStatus;
  /** Comportamento Offline "com cache": true quando uma atualização subsequente
   *  falhou mas os dados anteriores foram mantidos (T032 — ver spec.md). */
  stale: boolean;
  errorMessage: string | null;
}

export const notificationAdapter = createEntityAdapter<HomeNotification>();

export const initialHomeState: HomeState = notificationAdapter.getInitialState({
  hospitals: [] as Hospital[],
  selectedHospitalId: null as number | null,
  summary: null as HomeSummary | null,
  nextCursor: null as string | null,
  // O componente sempre dispara `pageOpened` na construção — não existe um
  // estado "parado" antes disso, então já nasce como "carregando" para
  // evitar um flash do conteúdo vazio antes do skeleton (FR-018).
  status: 'loading-initial' as HomeStatus,
  stale: false,
  errorMessage: null as string | null,
});

export const homeFeature = createFeature({
  name: 'home',
  reducer: createReducer(
    initialHomeState,

    on(HomeActions.loadHospitalsSuccess, (state, { hospitals }): HomeState => ({
      ...state,
      hospitals,
      selectedHospitalId: state.selectedHospitalId ?? hospitals[0]?.id ?? null,
    })),

    on(HomeActions.hospitalSelected, (state, { hospitalId }): HomeState => ({
      ...state,
      selectedHospitalId: hospitalId,
    })),

    on(HomeActions.loadData, (state): HomeState => ({
      ...state,
      // Se já havia sucesso anterior (ex.: troca de hospital), mantemos os
      // dados visíveis enquanto a nova busca corre — só vira
      // "loading-initial" (skeleton, FR-018) quando ainda não há dado algum.
      status: state.summary ? state.status : 'loading-initial',
    })),

    on(HomeActions.loadDataSuccess, (state, { summary, page }): HomeState => {
      const cleared = notificationAdapter.removeAll(state);

      return {
        ...notificationAdapter.setAll(page.items, cleared),
        summary,
        nextCursor: page.nextCursor,
        status: 'success',
        stale: false,
        errorMessage: null,
      };
    }),

    on(HomeActions.loadDataFailure, (state, { message }): HomeState => {
      // Comportamento Offline (spec.md): com dados em cache, mantém o último
      // estado válido e só marca `stale`; sem cache, vira o erro de tela
      // cheia (FR-013). Fusão da lógica que antes estava duplicada entre a
      // US1 e o Polish (nota de análise D1/C1) — vive só aqui agora.
      if (state.summary) {
        return { ...state, status: 'success', stale: true };
      }

      return { ...state, status: 'error', errorMessage: message };
    }),

    on(HomeActions.retryRequested, (state): HomeState => ({
      ...state,
      status: 'loading-initial',
      errorMessage: null,
    })),

    on(HomeActions.loadNextBatch, (state): HomeState => ({
      ...state,
      status: 'loading-more',
    })),

    on(HomeActions.loadNextBatchSuccess, (state, { page }): HomeState => ({
      ...notificationAdapter.addMany(page.items, state),
      nextCursor: page.nextCursor,
      status: 'success',
      stale: false,
    })),

    on(HomeActions.loadNextBatchFailure, (state): HomeState => ({
      // Falha pontual ao carregar mais um lote: mantém a lista já carregada
      // visível, sem substituir a tela por um erro de tela cheia.
      ...state,
      status: 'success',
      stale: true,
    })),
  ),
});

export const {
  name: homeFeatureKey,
  reducer: homeReducer,
  selectHomeState,
  selectHospitals,
  selectSelectedHospitalId,
  selectSummary,
  selectNextCursor,
  selectStatus,
  selectStale,
  selectErrorMessage,
} = homeFeature;

const { selectAll: selectAllNotifications } = notificationAdapter.getSelectors();

export const selectNotifications = createSelector(selectHomeState, selectAllNotifications);
