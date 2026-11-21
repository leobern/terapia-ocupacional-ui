import { Routes } from '@angular/router';

import { gestorGuard } from '../../shared/auth/gestor.guard';

export const PHARMACY_ROUTES: Routes = [
  {
    path: '',
    canActivate: [gestorGuard],
    loadComponent: () => import('./pharmacy.component').then(m => m.PharmacyComponent),
  },
];
