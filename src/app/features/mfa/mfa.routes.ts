import { Routes } from '@angular/router';

export const MFA_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./mfa-code.component').then(m => m.MfaCodeComponent) },
  { path: 'setup', loadComponent: () => import('./mfa-setup.component').then(m => m.MfaSetupComponent) },
];
