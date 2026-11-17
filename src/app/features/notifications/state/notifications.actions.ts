import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { NotificationPage, NotificationReply } from '../notifications.models';

export const NotificationsActions = createActionGroup({
  source: 'Notifications',
  events: {
    // Disparada ao entrar na tela — carrega o 1º lote da seção Pendentes (FR-004a).
    // `hospitalId` nulo (ex.: entrada pelo Menu, que não conhece o hospital em
    // contexto da Home — research.md §8) faz o effect resolver o hospital em
    // contexto chamando o mesmo endpoint de hospitais vinculados que a Home usa
    // para seu default (GET /api/v1/home/hospitals, primeiro da lista).
    'Page Opened': props<{ hospitalId: number | null }>(),

    // Seção Pendentes (sempre a primeira a carregar — FR-004a)
    'Load Pending Page Success': props<{ page: NotificationPage }>(),
    'Load Pending Page Failure': props<{ message: string }>(),

    // Seção Resolvidas — só dispara depois que Pendentes esgota (nextCursor pendente = null)
    'Load Resolved Page Success': props<{ page: NotificationPage }>(),
    'Load Resolved Page Failure': props<{ message: string }>(),

    // Infinite scroll (FR-004a) — a fase (pendente/resolvida) é resolvida no effect
    // a partir do estado atual, não passada pelo componente.
    'Load Next Batch Requested': emptyProps(),

    // Pull-to-refresh (FR-004b) — reinicia os dois cursores
    'Refresh Requested': emptyProps(),

    // Retry do erro genérico (FR-016), sem dados em cache
    'Retry Requested': props<{ hospitalId: number }>(),

    // Fluxo de resposta via IA (User Story 3) — só 1 card em modo "answering"
    // por vez (FR-011); o reducer descarta o rascunho anterior ao trocar.
    'Answer Started': props<{ notificationId: number }>(),
    'Draft Changed': props<{ notificationId: number; text: string }>(),
    'Answer Submitted': props<{ notificationId: number }>(),
    'Answer Submit Success': props<{ notificationId: number; reply: NotificationReply }>(),
    'Answer Submit Failure': props<{ notificationId: number; message: string }>(),

    // Descarte do rascunho — sem confirmação (FR-010, fechar o bottom sheet
    // diretamente) ou após confirmação explícita (FR-010a/FR-004b, diálogo de
    // "Descartar resposta não enviada?").
    'Answer Discarded': emptyProps(),

    // Diálogo de confirmação (FR-010a/FR-004b) — dispara antes de concluir uma
    // navegação/refresh que descartaria um rascunho não enviado; `onConfirm` é
    // executado pelo componente ao confirmar (não modelado como estado NgRx
    // porque é uma ação de navegação, não um dado da tela).
    'Discard Confirmation Requested': emptyProps(),
    'Discard Confirmation Cancelled': emptyProps(),
  },
});
