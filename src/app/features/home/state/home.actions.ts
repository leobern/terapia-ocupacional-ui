import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { HomeSummary, Hospital, NotificationPage } from '../home.models';

export const HomeActions = createActionGroup({
  source: 'Home',
  events: {
    // Disparada ao entrar na tela — carrega hospitais vinculados + 1º lote (US1, US3)
    'Page Opened': emptyProps(),

    // Carregamento (inicial ou por troca de hospital) do resumo + 1º lote de notificações
    'Load Data': props<{ hospitalId: number }>(),
    'Load Data Success': props<{ summary: HomeSummary; page: NotificationPage }>(),
    'Load Data Failure': props<{ message: string }>(),

    // Infinite scroll (FR-004)
    'Load Next Batch': emptyProps(),
    'Load Next Batch Success': props<{ page: NotificationPage }>(),
    'Load Next Batch Failure': props<{ message: string }>(),

    // Retry do erro genérico (FR-014), sem dados em cache
    'Retry Requested': emptyProps(),

    // Hospitais vinculados (seletor, FR-009) e troca (FR-010, US3)
    'Load Hospitals Success': props<{ hospitals: Hospital[] }>(),
    'Hospital Selected': props<{ hospitalId: number }>(),
  },
});
