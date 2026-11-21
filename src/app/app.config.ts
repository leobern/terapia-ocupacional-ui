import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { environment } from '@environments/environment';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore } from '@ngrx/router-store';
import { provideStore } from '@ngrx/store';

import { routes } from './app.routing';
import {
  FoodRecallSource,
  InfusedIntakeSource,
  ProvisionalFoodRecallSource,
  ProvisionalInfusedIntakeSource,
} from './features/daily-evolution/adequacy/intake-sources';
import { DiagnosisDecisionSource } from './features/diagnosis/diagnosis-decision-source';
import { DiagnosisSource } from './features/diagnosis/diagnosis-source';
import { ProvisionalDiagnosisDecisionSource } from './features/diagnosis/provisional-diagnosis-decision-source';
import { ProvisionalDiagnosisSource } from './features/diagnosis/provisional-diagnosis-source';
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
import { HospitalInvitePort, ManagerAccessReader } from './features/hospital-team/hospital-invite-port';
import {
  ProvisionalHospitalInvite,
  ProvisionalManagerAccess,
} from './features/hospital-team/provisional-hospital-invite';
import { PendingNotificationsQueryResolver } from './features/notifications/assistant/pending-notifications-query.resolver';
import { NotificationsApiService } from './features/notifications/data-access/notifications-api.service';
import {
  ProvisionalHomeApiService,
  ProvisionalNotificationsApiService,
} from './features/notifications/data-access/provisional-notifications-api.service';
import { AssessmentAiStructurer } from './features/patient-hub/assessment/assessment-ai-structurer';
import { AssessmentSource } from './features/patient-hub/assessment/assessment-source';
import { AssessmentWriter } from './features/patient-hub/assessment/assessment-writer';
import { ProvisionalAssessmentAiStructurer } from './features/patient-hub/assessment/provisional-assessment-ai-structurer';
import { ProvisionalAssessmentSource } from './features/patient-hub/assessment/provisional-assessment-source';
import { DailyEvolutionSource } from './features/patient-hub/daily-record/daily-evolution-source';
import { DailyRecordSource } from './features/patient-hub/daily-record/daily-record-source';
import { DailyRecordWriter } from './features/patient-hub/daily-record/daily-record-writer';
import { EvolutionAiStructurer } from './features/patient-hub/daily-record/evolution-ai-structurer';
import { ProvisionalDailyEvolutionSource } from './features/patient-hub/daily-record/provisional-daily-evolution-source';
import { ProvisionalDailyRecordSource } from './features/patient-hub/daily-record/provisional-daily-record-source';
import { ProvisionalEvolutionAiStructurer } from './features/patient-hub/daily-record/provisional-evolution-ai-structurer';
import {
  HypothesisSynthesizer,
  HypothesisWriter,
  PatientHubSource,
  PriorStaysSource,
  PriorStaysSynthesizer,
} from './features/patient-hub/patient-hub-source';
import {
  NutritionTargetsReader,
  PlanNutritionTargetsReader,
} from './features/patient-hub/plan/nutrition-targets-reader';
import { PlanSource } from './features/patient-hub/plan/plan-source';
import { ProvisionalPlanSource } from './features/patient-hub/plan/provisional-plan-source';
import { ProvisionalRefeedingRiskSource } from './features/patient-hub/plan/provisional-refeeding-risk-source';
import { RefeedingRiskSource } from './features/patient-hub/plan/refeeding-risk-source';
import { PrescriptionSource } from './features/patient-hub/prescription/prescription-source';
import { ProvisionalPrescriptionSource } from './features/patient-hub/prescription/provisional-prescription-source';
import {
  ProvisionalHypothesisSynthesizer,
  ProvisionalHypothesisWriter,
  ProvisionalPatientHubSource,
  ProvisionalPriorStaysSource,
  ProvisionalPriorStaysSynthesizer,
} from './features/patient-hub/provisional-patient-hub';
import { PatientListAiCommandPort } from './features/patient-list/patient-list-ai-command';
import { PatientListSource } from './features/patient-list/patient-list-source';
import { ProvisionalPatientListSource } from './features/patient-list/provisional-patient-list';
import { ProvisionalPatientListAiCommand } from './features/patient-list/provisional-patient-list-ai-command';
import {
  NutritionAddedCards,
  NutritionHiddenCards,
  NutritionHistorySource,
  NutritionValueWriter,
} from './features/patients/nutrition-panel/nutrition-card-ports';
import { NutritionResultsSource } from './features/patients/nutrition-panel/nutrition-results-source';
import { ProvisionalNutritionCardStore } from './features/patients/nutrition-panel/provisional-nutrition-card-store';
import { ProvisionalNutritionResultsSource } from './features/patients/nutrition-panel/provisional-nutrition-results';
import { FormulasApi } from './features/pharmacy/formulas-api';
import { ProvisionalFormulasApi } from './features/pharmacy/provisional-formulas-api';
import { LocalStartupStateReader } from './features/splash/local-startup-state-reader';
import { StartupStateReader } from './features/splash/startup-state';
import { ProvisionalSessionRoleReader } from './shared/auth/provisional-session-role-reader';
import { SessionRoleReader } from './shared/auth/session-role';
import { DEV_BACKEND_PROVIDERS } from './shared/dev-backend/dev-backend.providers';
import { devTokenInterceptor } from './shared/dev-backend/dev-token.interceptor';
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
    { provide: PatientHubSource, useClass: ProvisionalPatientHubSource },
    { provide: HypothesisSynthesizer, useClass: ProvisionalHypothesisSynthesizer },
    { provide: HypothesisWriter, useClass: ProvisionalHypothesisWriter },
    ProvisionalAssessmentSource,
    { provide: AssessmentAiStructurer, useClass: ProvisionalAssessmentAiStructurer },
    { provide: AssessmentSource, useExisting: ProvisionalAssessmentSource },
    { provide: AssessmentWriter, useExisting: ProvisionalAssessmentSource },
    ProvisionalDailyRecordSource,
    { provide: DailyRecordSource, useExisting: ProvisionalDailyRecordSource },
    { provide: DailyRecordWriter, useExisting: ProvisionalDailyRecordSource },
    { provide: DiagnosisSource, useClass: ProvisionalDiagnosisSource },
    { provide: DiagnosisDecisionSource, useClass: ProvisionalDiagnosisDecisionSource },
    { provide: DailyEvolutionSource, useClass: ProvisionalDailyEvolutionSource },
    { provide: EvolutionAiStructurer, useClass: ProvisionalEvolutionAiStructurer },
    { provide: PlanSource, useClass: ProvisionalPlanSource },
    { provide: PrescriptionSource, useClass: ProvisionalPrescriptionSource },
    { provide: NutritionTargetsReader, useClass: PlanNutritionTargetsReader },
    { provide: RefeedingRiskSource, useClass: ProvisionalRefeedingRiskSource },
    { provide: InfusedIntakeSource, useClass: ProvisionalInfusedIntakeSource },
    { provide: FoodRecallSource, useClass: ProvisionalFoodRecallSource },
    { provide: PriorStaysSource, useClass: ProvisionalPriorStaysSource },
    { provide: PriorStaysSynthesizer, useClass: ProvisionalPriorStaysSynthesizer },
    { provide: NutritionResultsSource, useClass: ProvisionalNutritionResultsSource },
    ProvisionalNutritionCardStore,
    { provide: NutritionHistorySource, useExisting: ProvisionalNutritionCardStore },
    { provide: NutritionValueWriter, useExisting: ProvisionalNutritionCardStore },
    { provide: NutritionAddedCards, useExisting: ProvisionalNutritionCardStore },
    { provide: NutritionHiddenCards, useExisting: ProvisionalNutritionCardStore },
    { provide: HomeNotificationsSource, useClass: ProvisionalHomeNotificationsSource },
    // Provisórios (sem backend ainda): notificações em memória, hospital único e usuários de exemplo.
    { provide: NotificationsApiService, useClass: ProvisionalNotificationsApiService },
    { provide: HomeApiService, useClass: ProvisionalHomeApiService },
    { provide: HospitalInvitePort, useClass: ProvisionalHospitalInvite },
    { provide: ManagerAccessReader, useClass: ProvisionalManagerAccess },
    { provide: UserDirectory, useClass: ProvisionalUserDirectory },
    { provide: SessionRoleReader, useClass: ProvisionalSessionRoleReader },
    { provide: FormulasApi, useClass: ProvisionalFormulasApi },
    // Consultas de leitura do assistente (um resolvedor por intenção).
    { multi: true, provide: ASSISTANT_QUERY_RESOLVERS, useClass: PendingNotificationsQueryResolver },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors(environment.devBackend ? [devTokenInterceptor] : [])),
    provideStore(),
    provideEffects(),
    provideRouterStore(),
    // Backend real do EP-009 com token de teste: só em `ng serve --configuration local`.
    ...(environment.devBackend ? DEV_BACKEND_PROVIDERS : []),
  ],
};
