import { Routes } from '@angular/router';

export const PATIENT_LIST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./patient-list.component').then(m => m.PatientListComponent),
  },
];
