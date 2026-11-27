import { Routes } from '@angular/router';

export const INVITE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./accept-invite.component').then(m => m.AcceptInviteComponent) },
];
