import { Routes } from '@angular/router';

export const PASSWORD_RECOVERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
];
