import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

import { environment } from '../environments/environment';
import { sessionGuard } from './features/auth/session.guard';
import { approvedHospitalLinkGuard } from './features/hospital-links/approved-hospital-link.guard';

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

/** Telas autenticadas: só abrem com sessão (ou com o token de dev no `--configuration local`). */
const authenticatedRoutes: Routes = [
  {
    path: 'home',
    canActivate: [approvedHospitalLinkGuard],
    loadChildren: () => import('./features/home/home.routes').then(m => m.HOME_ROUTES),
  },
  // Tutorial do app (US-001-3-02): primeiro acesso, sem o shell de navegação.
  {
    path: 'tutorial',
    data: { hideShell: true },
    loadChildren: () => import('./features/tutorial/tutorial.routes').then(m => m.TUTORIAL_ROUTES),
  },
  // Configurações (US-001-3-02, RN03): rever o tutorial. Rota própria em modo revisão, sem o shell.
  {
    path: 'settings/tutorial',
    data: { hideShell: true, review: true },
    loadChildren: () => import('./features/tutorial/tutorial.routes').then(m => m.TUTORIAL_ROUTES),
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
  },
  {
    path: 'patients',
    pathMatch: 'full',
    loadChildren: () => import('./features/patient-list/patient-list.routes').then(m => m.PATIENT_LIST_ROUTES),
  },
  {
    path: 'welcome',
    data: { hideShell: true },
    loadChildren: () => import('./features/welcome/welcome.routes').then(m => m.WELCOME_ROUTES),
  },
  // Detalhe da notificação (US-003-3-04): é a própria tela de Notificações com o card aberto (`?abrir=<id>`).
  {
    path: 'notifications/:id',
    pathMatch: 'full',
    redirectTo: ({ params }) =>
      inject(Router).createUrlTree(['/notifications'], { queryParams: { abrir: params['id'] } }),
  },
  {
    path: 'notifications',
    loadChildren: () => import('./features/notifications/notifications.routes').then(m => m.NOTIFICATIONS_ROUTES),
  },
  {
    path: 'pharmacy',
    loadChildren: () => import('./features/pharmacy/pharmacy.routes').then(m => m.PHARMACY_ROUTES),
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
  // Administração (FT-009-3): equipe, hospitais e perfil. Equipe e Hospitais só para ADMIN/GESTOR.
  {
    path: 'team',
    loadChildren: () => import('./features/administration/administration.routes').then(m => m.TEAM_ROUTES),
  },
  {
    path: 'hospitals',
    loadChildren: () => import('./features/administration/administration.routes').then(m => m.HOSPITAL_ADMIN_ROUTES),
  },
  {
    path: 'profile',
    loadChildren: () => import('./features/administration/administration.routes').then(m => m.PROFILE_ROUTES),
  },
  // Convite direto de profissional (FT-009-1): só gestor.
  {
    path: 'hospital-team',
    loadChildren: () => import('./features/hospital-team/hospital-team.routes').then(m => m.HOSPITAL_TEAM_ROUTES),
  },
  // Diagnóstico GLIM do paciente (FT-004-5).
  {
    path: 'patients/:id/diagnosis',
    loadComponent: () => import('./features/diagnosis/diagnosis.component').then(m => m.DiagnosisComponent),
  },
  // Hub do paciente (FT-004-2): destino da lista de pacientes e das notificações.
  {
    path: 'patients/:id',
    loadComponent: () => import('./features/patient-hub/patient-hub.component').then(m => m.PatientHubComponent),
  },
  // Solicitar acesso a um hospital (US-001-2-01).
  {
    path: 'hospital-links/request',
    loadComponent: () =>
      import('./features/hospital-links/hospital-access-request.component').then(m => m.HospitalAccessRequestComponent),
  },
  // Vínculos com hospitais (US-001-2-02): destino pós-login sem hospital aprovado e acessível pelo menu.
  {
    path: 'hospital-links',
    loadChildren: () => import('./features/hospital-links/hospital-links.routes').then(m => m.HOSPITAL_LINKS_ROUTES),
  },
];

/** Telas públicas: entrada, splash (decide o destino), bloqueio e recuperação de senha. */
const publicRoutes: Routes = [
  {
    path: 'splash',
    data: { hideShell: true },
    loadChildren: () => import('./features/splash/splash.routes').then(m => m.SPLASH_ROUTES),
  },
  // LockScreen (US-001-1-08): bloqueio por inatividade, sem o shell de navegação.
  {
    path: 'lock',
    data: { hideShell: true },
    loadComponent: () => import('./features/auth/lock/lock-screen.component').then(m => m.LockScreenComponent),
  },
  // Login com e-mail e senha (US-001-1-03).
  {
    path: 'login',
    data: { hideShell: true },
    loadChildren: () => import('./features/login/login.routes').then(m => m.LOGIN_ROUTES),
  },
  // Aceite de convite (Figma seção 12, tela 06) e segundo fator (telas 12 a 14): sem o shell de navegação.
  {
    path: 'invite',
    data: { hideShell: true },
    loadChildren: () => import('./features/invite/invite.routes').then(m => m.INVITE_ROUTES),
  },
  {
    path: 'mfa',
    data: { hideShell: true },
    loadChildren: () => import('./features/mfa/mfa.routes').then(m => m.MFA_ROUTES),
  },
  // A raiz vem ANTES da rota vazia de recuperação de senha: sem isso `/` casava com ela e ficava em branco.
  // A splash decide entre login, bloqueio, vínculos e Hospitais. Com o token de dev (`--configuration local`)
  // a raiz leva direto a Hospitais: a splash mandaria ao login quem não tem sessão real.
  { path: '', pathMatch: 'full', redirectTo: environment.devBackend ? 'home' : 'splash' },
  {
    path: '',
    data: { hideShell: true },
    loadChildren: () =>
      import('./features/password-recovery/password-recovery.routes').then(m => m.PASSWORD_RECOVERY_ROUTES),
  },
];

export const routes: Routes = [
  ...devRoutes,
  // Redirecionamentos não aceitam guarda (o destino já é guardado).
  ...authenticatedRoutes.map(route =>
    route.redirectTo === undefined ? { ...route, canActivate: [sessionGuard, ...(route.canActivate ?? [])] } : route,
  ),
  ...publicRoutes,
];
