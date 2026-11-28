import { Routes } from '@angular/router';

import { administrationGuard } from './administration.guard';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    canActivate: [administrationGuard],
    loadComponent: () => import('./team-list.component').then(m => m.TeamListComponent),
  },
  {
    path: ':id',
    canActivate: [administrationGuard],
    loadComponent: () => import('./person-detail.component').then(m => m.PersonDetailComponent),
  },
];

export const HOSPITAL_ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [administrationGuard],
    loadComponent: () => import('./hospital-admin.component').then(m => m.HospitalAdminComponent),
  },
];

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    data: { self: true },
    loadComponent: () => import('./person-detail.component').then(m => m.PersonDetailComponent),
  },
];
