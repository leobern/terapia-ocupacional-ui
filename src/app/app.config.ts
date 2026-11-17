import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore } from '@ngrx/router-store';
import { provideStore } from '@ngrx/store';

import { routes } from './app.routing';
import { DailyPatientsSource } from './features/home/daily-patients';
import { HomeNotificationsSource } from './features/home/home-notifications';
import { LinkedHospitalsReader } from './features/home/linked-hospitals';
import { LocalProfessionalProfileReader } from './features/home/local-professional-profile-reader';
import { LocalUnreadNotificationsReader } from './features/home/local-unread-notifications-reader';
import { MockLinkedHospitalsReader } from './features/home/mock-linked-hospitals-reader';
import { ProfessionalProfileReader } from './features/home/professional-profile';
import { ProvisionalDailyPatientsSource } from './features/home/provisional-daily-patients';
import { ProvisionalHomeNotificationsSource } from './features/home/provisional-home-notifications';
import { UnreadNotificationsReader } from './features/home/unread-notifications-reader';
import { LocalStartupStateReader } from './features/splash/local-startup-state-reader';
import { StartupStateReader } from './features/splash/startup-state';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ProfessionalProfileReader, useClass: LocalProfessionalProfileReader },
    { provide: StartupStateReader, useClass: LocalStartupStateReader },
    { provide: LinkedHospitalsReader, useClass: MockLinkedHospitalsReader },
    { provide: UnreadNotificationsReader, useClass: LocalUnreadNotificationsReader },
    { provide: DailyPatientsSource, useClass: ProvisionalDailyPatientsSource },
    { provide: HomeNotificationsSource, useClass: ProvisionalHomeNotificationsSource },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideStore(),
    provideEffects(),
    provideRouterStore(),
  ],
};
