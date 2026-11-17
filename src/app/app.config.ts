import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore } from '@ngrx/router-store';
import { provideStore } from '@ngrx/store';

import { routes } from './app.routing';
import { AuthGateway } from './features/login/auth-gateway';
import { ProvisionalAuthGateway } from './features/login/provisional-auth-gateway';
import { LocalStartupStateReader } from './features/splash/local-startup-state-reader';
import { StartupStateReader } from './features/splash/startup-state';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: AuthGateway, useClass: ProvisionalAuthGateway },
    { provide: StartupStateReader, useClass: LocalStartupStateReader },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideStore(),
    provideEffects(),
    provideRouterStore(),
  ],
};
