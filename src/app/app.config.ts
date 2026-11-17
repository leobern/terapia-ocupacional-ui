import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore } from '@ngrx/router-store';
import { provideStore } from '@ngrx/store';

import { routes } from './app.routing';
import { LocalProfessionalProfileReader } from './features/home/local-professional-profile-reader';
import { ProfessionalProfileReader } from './features/home/professional-profile';
import { LinkedHospitalsReader } from './features/home/linked-hospitals';
import { MockLinkedHospitalsReader } from './features/home/mock-linked-hospitals-reader';
import { LocalUnreadNotificationsReader } from './features/home/local-unread-notifications-reader';
import { UnreadNotificationsReader } from './features/home/unread-notifications-reader';
import { LocalStartupStateReader } from './features/splash/local-startup-state-reader';
import { StartupStateReader } from './features/splash/startup-state';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ProfessionalProfileReader, useClass: LocalProfessionalProfileReader },
    { provide: StartupStateReader, useClass: LocalStartupStateReader },
    { provide: LinkedHospitalsReader, useClass: MockLinkedHospitalsReader },
    { provide: UnreadNotificationsReader, useClass: LocalUnreadNotificationsReader },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideStore(),
    provideEffects(),
    provideRouterStore(),
  ],
};
