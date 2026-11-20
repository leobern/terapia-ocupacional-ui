import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore } from '@ngrx/router-store';
import { provideStore } from '@ngrx/store';

import { routes } from './app.routing';
import { DailyPatientsSource } from './features/home/daily-patients';
import { HomeApiService } from './features/home/data-access/home-api.service';
import { HomeNotificationsSource } from './features/home/home-notifications-source';
import { LinkedHospitalsReader } from './features/home/linked-hospitals';
import { LocalProfessionalProfileReader } from './features/home/local-professional-profile-reader';
import { LocalUnreadNotificationsReader } from './features/home/local-unread-notifications-reader';
import { MockLinkedHospitalsReader } from './features/home/mock-linked-hospitals-reader';
import { ProfessionalProfileReader } from './features/home/professional-profile';
import { ProvisionalDailyPatientsSource } from './features/home/provisional-daily-patients';
import { ProvisionalHomeNotificationsSource } from './features/home/provisional-home-notifications';
import { UnreadNotificationsReader } from './features/home/unread-notifications-reader';
import { PendingNotificationsQueryResolver } from './features/notifications/assistant/pending-notifications-query.resolver';
import { NotificationsApiService } from './features/notifications/data-access/notifications-api.service';
import {
  ProvisionalHomeApiService,
  ProvisionalNotificationsApiService,
} from './features/notifications/data-access/provisional-notifications-api.service';
import { PatientListAiCommandPort } from './features/patient-list/patient-list-ai-command';
import { PatientListSource } from './features/patient-list/patient-list-source';
import { ProvisionalPatientListSource } from './features/patient-list/provisional-patient-list';
import { ProvisionalPatientListAiCommand } from './features/patient-list/provisional-patient-list-ai-command';
import { NutritionResultsSource } from './features/patients/nutrition-panel/nutrition-results-source';
import { ProvisionalNutritionResultsSource } from './features/patients/nutrition-panel/provisional-nutrition-results';
import { LocalStartupStateReader } from './features/splash/local-startup-state-reader';
import { StartupStateReader } from './features/splash/startup-state';
import { ASSISTANT_QUERY_RESOLVERS } from './shared/services/assistant-query-resolver';
import { ProvisionalUserDirectory } from './shared/services/provisional-user-directory';
import { UserDirectory } from './shared/services/user-directory';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ProfessionalProfileReader, useClass: LocalProfessionalProfileReader },
    { provide: StartupStateReader, useClass: LocalStartupStateReader },
    { provide: LinkedHospitalsReader, useClass: MockLinkedHospitalsReader },
    { provide: UnreadNotificationsReader, useClass: LocalUnreadNotificationsReader },
    { provide: DailyPatientsSource, useClass: ProvisionalDailyPatientsSource },
    { provide: PatientListAiCommandPort, useClass: ProvisionalPatientListAiCommand },
    { provide: PatientListSource, useClass: ProvisionalPatientListSource },
    { provide: NutritionResultsSource, useClass: ProvisionalNutritionResultsSource },
    { provide: HomeNotificationsSource, useClass: ProvisionalHomeNotificationsSource },
    // Provisórios (sem backend ainda): notificações em memória, hospital único e usuários de exemplo.
    { provide: NotificationsApiService, useClass: ProvisionalNotificationsApiService },
    { provide: HomeApiService, useClass: ProvisionalHomeApiService },
    { provide: UserDirectory, useClass: ProvisionalUserDirectory },
    // Consultas de leitura do assistente (um resolvedor por intenção).
    { multi: true, provide: ASSISTANT_QUERY_RESOLVERS, useClass: PendingNotificationsQueryResolver },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideStore(),
    provideEffects(),
    provideRouterStore(),
  ],
};
