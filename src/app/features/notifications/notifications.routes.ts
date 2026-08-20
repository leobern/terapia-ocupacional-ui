import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';

import { canDeactivateNotifications } from './notifications.guard';
import * as NotificationsEffects from './state/notifications.effects';
import { notificationsFeature } from './state/notifications.reducer';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    providers: [provideState(notificationsFeature), provideEffects(NotificationsEffects)],
    loadComponent: () => import('./notifications.component').then(m => m.NotificationsComponent),
    canDeactivate: [canDeactivateNotifications],
  },
];
