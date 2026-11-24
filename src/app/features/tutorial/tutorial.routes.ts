import { Routes } from '@angular/router';

export const TUTORIAL_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./tutorial.component').then(m => m.TutorialComponent) },
];
