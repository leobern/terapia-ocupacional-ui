import { Routes } from '@angular/router';

export const PASSWORD_RECOVERY_ROUTES: Routes = [
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./reset-password.component').then(m => m.ResetPasswordComponent),
  },
];
