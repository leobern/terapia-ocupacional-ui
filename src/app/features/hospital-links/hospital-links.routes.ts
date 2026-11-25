import { Routes } from '@angular/router';

export const HOSPITAL_LINKS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./hospital-links.component').then(m => m.HospitalLinksComponent) },
];
