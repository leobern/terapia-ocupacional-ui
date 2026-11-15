import { Routes } from '@angular/router';

export const SPLASH_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./splash.component').then(m => m.SplashComponent) },
];
