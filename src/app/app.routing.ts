import { Routes } from '@angular/router';

import { environment } from '../environments/environment';

/**
 * Galeria de desenvolvimento — NUNCA em produção (Princípio IX).
 *
 * O ternário fica fora do array de rotas de propósito: `environment.production` é
 * substituído por `true` literal no build de produção (`fileReplacements` do
 * angular.json), então o esbuild elimina o ramo inteiro — o `import()` some junto e
 * nenhum chunk da galeria é emitido. Um guard de runtime dentro do array manteria o
 * import vivo e o chunk no bundle.
 */
const devRoutes: Routes = environment.production
  ? []
  : [
      {
        path: 'dev/design-system',
        loadComponent: () =>
          import('./dev/design-system-gallery/design-system-gallery.component').then(
            m => m.DesignSystemGalleryComponent,
          ),
      },
    ];

export const routes: Routes = [
  ...devRoutes,
  {
    path: 'home',
    loadChildren: () => import('./features/home/home.routes').then(m => m.HOME_ROUTES),
  },
  {
    path: 'patients',
    pathMatch: 'full',
    loadChildren: () => import('./features/patient-list/patient-list.routes').then(m => m.PATIENT_LIST_ROUTES),
  },
  {
    path: 'splash',
    data: { hideShell: true },
    loadChildren: () => import('./features/splash/splash.routes').then(m => m.SPLASH_ROUTES),
  },
  // Detalhe da notificação (US-003-3-04): tela com especificação própria — placeholder até lá.
  {
    path: 'notifications/:id',
    data: { screen: 'notification-detail' },
    loadComponent: () =>
      import('./features/pending-screen/pending-screen.component').then(m => m.PendingScreenComponent),
  },
  {
    path: 'notifications',
    loadChildren: () => import('./features/notifications/notifications.routes').then(m => m.NOTIFICATIONS_ROUTES),
  },
  // Caminho antigo em português, mantido como atalho para a tela real.
  { path: 'notificacoes', pathMatch: 'full', redirectTo: 'notifications' },
  // Fluxo de encerramento de acompanhamento (FT-004-9): placeholder até a feature existir.
  {
    path: 'patients/:id/end-follow-up',
    data: { screen: 'end-follow-up' },
    loadComponent: () =>
      import('./features/pending-screen/pending-screen.component').then(m => m.PendingScreenComponent),
  },
  // Fluxo de alteração de leito (FT-002-2): placeholder até a feature existir.
  {
    path: 'patients/:id/change-bed',
    data: { screen: 'change-bed' },
    loadComponent: () =>
      import('./features/pending-screen/pending-screen.component').then(m => m.PendingScreenComponent),
  },
  // Atalhos da lista (US-004-1-07): fluxos de cadastro e edição de paciente da FT-002-1, placeholders até existir.
  ...(['register', 'edit'] as const).map(path => ({
    path: `patients/${path}`,
    data: { screen: `${path}-patient` },
    loadComponent: () =>
      import('./features/pending-screen/pending-screen.component').then(m => m.PendingScreenComponent),
  })),
  // Hub do paciente (FT-004-2): destino da lista de pacientes e das notificações.
  {
    path: 'patients/:id',
    loadComponent: () => import('./features/patient-hub/patient-hub.component').then(m => m.PatientHubComponent),
  },
  // Placeholders das telas de outras stories (ver PendingScreenComponent).
  ...(['login', 'lock', 'hospital-links'] as const).map(path => ({
    path,
    data: { screen: path },
    loadComponent: () =>
      import('./features/pending-screen/pending-screen.component').then(m => m.PendingScreenComponent),
  })),
  { path: '', pathMatch: 'full', redirectTo: 'splash' },
];
