import { Routes } from '@angular/router';

import { managerOnlyGuard } from './hospital-invite.guard';

export const HOSPITAL_TEAM_ROUTES: Routes = [
  {
    path: 'invite',
    canActivate: [managerOnlyGuard],
    loadComponent: () => import('./hospital-invite.component').then(m => m.HospitalInviteComponent),
  },
];
