import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';

import * as HomeEffects from './state/home.effects';
import { homeFeature } from './state/home.reducer';

export const HOME_ROUTES: Routes = [
  {
    path: '',
    providers: [provideState(homeFeature), provideEffects(HomeEffects)],
    loadComponent: () => import('./home.component').then(m => m.HomeComponent),
  },
];
