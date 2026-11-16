import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore } from '@ngrx/router-store';
import { provideStore } from '@ngrx/store';

import { routes } from './app.routing';
import { HttpPasswordResetGateway } from './features/password-recovery/http-password-reset-gateway';
import { PasswordResetGateway } from './features/password-recovery/password-reset-gateway';
import { LocalStartupStateReader } from './features/splash/local-startup-state-reader';
import { StartupStateReader } from './features/splash/startup-state';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: PasswordResetGateway, useClass: HttpPasswordResetGateway },
    { provide: StartupStateReader, useClass: LocalStartupStateReader },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideStore(),
    provideEffects(),
    provideRouterStore(),
  ],
};
