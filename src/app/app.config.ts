import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { environment } from '@environments/environment';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore } from '@ngrx/router-store';
import { provideStore } from '@ngrx/store';

import { routes } from './app.routing';
import { HttpTokenRefresher } from './features/auth/http-token-refresher';
import { AccountPasswordVerifier } from './features/auth/lock/account-password-verifier';
import { BiometricAuth } from './features/auth/lock/biometric-auth';
import { InactivityLockService } from './features/auth/lock/inactivity-lock.service';
import { ProvisionalAccountPasswordVerifier } from './features/auth/lock/provisional-account-password-verifier';
import { ProvisionalBiometricAuth } from './features/auth/lock/provisional-biometric-auth';
import { NoopSessionRevoker } from './features/auth/noop-session-revoker';
import { sessionAuthInterceptor } from './features/auth/session-auth.interceptor';
import { SessionRevoker } from './features/auth/session-revoker';
import { TokenRefresher } from './features/auth/token-refresher';
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
import { FollowUpClosureSource, FollowUpClosureWriter } from './features/follow-up-closure/follow-up-closure-source';
import { ProvisionalFollowUpClosureSource } from './features/follow-up-closure/provisional-follow-up-closure';
import { ApiLinkRevocationChecker } from './features/home/api-link-revocation-checker';
import { ApiUnreadNotificationsReader } from './features/home/api-unread-notifications-reader';
import { CensusDailyPatientsSource } from './features/home/census-daily-patients';
import { DailyPatientsSource } from './features/home/daily-patients';
import { HomeHospitalsApiService } from './features/home/data-access/home-hospitals-api.service';
import { HomeNotificationsApiService } from './features/home/data-access/home-notifications-api.service';
import { HomeNotificationsSource } from './features/home/home-notifications-source';
import { LinkRevocationChecker } from './features/home/link-revocation-checker';
import { LinkedHospitalsReader } from './features/home/linked-hospitals';
import { LocalProfessionalProfileReader } from './features/home/local-professional-profile-reader';
import { ProfessionalProfileReader } from './features/home/professional-profile';
import { UnreadNotificationsReader } from './features/home/unread-notifications-reader';
import { HospitalLinksApiService } from './features/hospital-links/hospital-links-api.service';
import { HospitalLinksSource } from './features/hospital-links/hospital-links-source';
import { HospitalInviteApiService } from './features/hospital-team/hospital-invite-api.service';
import { HospitalInvitePort, ManagerAccessReader } from './features/hospital-team/hospital-invite-port';
import { ProfessionalAccessApiService } from './features/hospital-team/professional-access-api.service';
import { ProfessionalAccessRevoker, ProfessionalAccessSource } from './features/hospital-team/professional-access-port';
import { ProvisionalProfessionalAccess } from './features/hospital-team/provisional-professional-access';
import { SessionManagerAccess } from './features/hospital-team/session-manager-access';
import { AuthGateway } from './features/login/auth-gateway';
import { HttpAuthGateway } from './features/login/http-auth-gateway';
import { AnnouncementAssistant } from './features/notifications/assistant/announcement-assistant';
import { PendingNotificationsQueryResolver } from './features/notifications/assistant/pending-notifications-query.resolver';
import { ProvisionalAnnouncementAssistant } from './features/notifications/assistant/provisional-announcement-assistant';
import { HttpPasswordResetGateway } from './features/password-recovery/http-password-reset-gateway';
import { PasswordResetGateway } from './features/password-recovery/password-reset-gateway';
import { ApiHypothesisWriter } from './features/patient-hub/api-hypothesis-writer';
import { ApiPatientHubSource } from './features/patient-hub/api-patient-hub-source';
import { AssessmentAiStructurer } from './features/patient-hub/assessment/assessment-ai-structurer';
import { AssessmentSource } from './features/patient-hub/assessment/assessment-source';
import { AssessmentWriter } from './features/patient-hub/assessment/assessment-writer';
import { ProvisionalAssessmentAiStructurer } from './features/patient-hub/assessment/provisional-assessment-ai-structurer';
import { ProvisionalAssessmentSource } from './features/patient-hub/assessment/provisional-assessment-source';
import { LocationChangePort, LocationExtractor } from './features/patient-hub/change-location/location-change.port';
import { LocationChangeApiService } from './features/patient-hub/change-location/location-change-api.service';
import { ProvisionalLocationExtractor } from './features/patient-hub/change-location/provisional-location-extractor';
import { ApiClinicalAssessmentSource } from './features/patient-hub/clinical-assessment/api-clinical-assessment-source';
import { ClinicalAssessmentSource } from './features/patient-hub/clinical-assessment/clinical-assessment-source';
import { ClinicalItemHistorySource } from './features/patient-hub/clinical-assessment/clinical-item-history-source';
import { ProvisionalClinicalAssessmentSource } from './features/patient-hub/clinical-assessment/provisional-clinical-assessment-source';
import { ProvisionalClinicalItemHistorySource } from './features/patient-hub/clinical-assessment/provisional-clinical-item-history-source';
import { DailyEvolutionSource } from './features/patient-hub/daily-record/daily-evolution-source';
import { DailyRecordSource } from './features/patient-hub/daily-record/daily-record-source';
import { DailyRecordWriter } from './features/patient-hub/daily-record/daily-record-writer';
import { EvolutionAiStructurer } from './features/patient-hub/daily-record/evolution-ai-structurer';
import { ParameterAiStructurer } from './features/patient-hub/daily-record/parameter-ai-structurer';
import { ProvisionalDailyEvolutionSource } from './features/patient-hub/daily-record/provisional-daily-evolution-source';
import { ProvisionalDailyRecordSource } from './features/patient-hub/daily-record/provisional-daily-record-source';
import { ProvisionalEvolutionAiStructurer } from './features/patient-hub/daily-record/provisional-evolution-ai-structurer';
import { ProvisionalParameterAiStructurer } from './features/patient-hub/daily-record/provisional-parameter-ai-structurer';
import { ObservationFollowUpPort } from './features/patient-hub/messages/observation-follow-up.port';
import { ObservationFollowUpApiService } from './features/patient-hub/messages/observation-follow-up-api.service';
import {
  PatientMessageApiService,
  PatientTeamApiService,
} from './features/patient-hub/messages/patient-message-api.service';
import {
  MessageAiAssistant,
  PatientMessageSource,
  PatientTeamSource,
} from './features/patient-hub/messages/patient-message-source';
import { ProvisionalMessageAiAssistant } from './features/patient-hub/messages/provisional-patient-message';
import { BedMovementPort, BedOccupancyPort } from './features/patient-hub/move-bed/bed-movement.port';
import { BedMovementApiService } from './features/patient-hub/move-bed/bed-movement-api.service';
import { BedNumberExtractor } from './features/patient-hub/move-bed/bed-number-extractor';
import { BedOccupancyApiService } from './features/patient-hub/move-bed/bed-occupancy-api.service';
import { PatientNameExtractor } from './features/patient-hub/move-bed/patient-name-extractor';
import { ProvisionalBedNumberExtractor } from './features/patient-hub/move-bed/provisional-bed-number-extractor';
import { ProvisionalPatientNameExtractor } from './features/patient-hub/move-bed/provisional-patient-name-extractor';
import {
  HypothesisSynthesizer,
  HypothesisWriter,
  PatientHubSource,
  PriorStaysSource,
  PriorStaysSynthesizer,
} from './features/patient-hub/patient-hub-source';
import { ApiPlanSource } from './features/patient-hub/plan/api-plan-source';
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
import { ApiPatientListSource } from './features/patient-list/api-patient-list-source';
import { PatientListAiCommandPort } from './features/patient-list/patient-list-ai-command';
import { PatientListSource } from './features/patient-list/patient-list-source';
import { ProvisionalPatientListAiCommand } from './features/patient-list/provisional-patient-list-ai-command';
import {
  PatientMessagesSource,
  PatientMessagesWriter,
  ReplyTranscriber,
} from './features/patient-messages/patient-messages-source';
import { PatientThreadsApiService } from './features/patient-messages/patient-threads-api.service';
import { ProvisionalReplyTranscriber } from './features/patient-messages/provisional-reply-transcriber';
import { InternacaoCreationPort } from './features/patient-registration/internacao-creation.port';
import { InternacoesApiService } from './features/patient-registration/internacoes-api.service';
import { PacientesApiService } from './features/patient-registration/pacientes-api.service';
import { PatientCreationPort } from './features/patient-registration/patient-creation.port';
import { PatientDuplicateApiService } from './features/patient-registration/patient-duplicate-api.service';
import { PatientDuplicateSource } from './features/patient-registration/patient-duplicate-source';
import { FormulasApi } from './features/pharmacy/formulas-api';
import { ProvisionalFormulasApi } from './features/pharmacy/provisional-formulas-api';
import { HospitalSiteSource } from './features/shift/hospital-site-source';
import { ProvisionalHospitalSiteSource } from './features/shift/provisional-hospital-site-source';
import { ProvisionalShiftSource } from './features/shift/provisional-shift-source';
import { ShiftSource } from './features/shift/shift-source';
import { LocalStartupStateReader } from './features/splash/local-startup-state-reader';
import { StartupStateReader } from './features/splash/startup-state';
import { TutorialApiService } from './features/tutorial/tutorial-api.service';
import { TutorialStateStore } from './features/tutorial/tutorial-state';
import { WelcomeApiService } from './features/welcome/welcome-api.service';
import { WelcomeSource } from './features/welcome/welcome-source';
import { JwtSessionRoleReader } from './shared/auth/jwt-session-role-reader';
import { SessionRoleReader } from './shared/auth/session-role';
import { DEV_BACKEND_PROVIDERS } from './shared/dev-backend/dev-backend.providers';
import { devTokenInterceptor } from './shared/dev-backend/dev-token.interceptor';
import { ASSISTANT_QUERY_RESOLVERS } from './shared/services/assistant-query-resolver';
import { AudioTranscriber } from './shared/services/audio-transcriber';
import { FormAssistant } from './shared/services/form-assistant';
import { PrivacyOverlayService } from './shared/services/privacy-overlay.service';
import { ProvisionalAudioTranscriber } from './shared/services/provisional-audio-transcriber';
import { ProvisionalFormAssistant } from './shared/services/provisional-form-assistant';
import { ProvisionalUserDirectory } from './shared/services/provisional-user-directory';
import { UserDirectory } from './shared/services/user-directory';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ProfessionalProfileReader, useClass: LocalProfessionalProfileReader },
    { provide: AuthGateway, useClass: HttpAuthGateway },
    { provide: PasswordResetGateway, useClass: HttpPasswordResetGateway },
    // Biometria e senha da conta do desbloqueio: provisórios até haver shell nativo e API de login.
    { provide: BiometricAuth, useClass: ProvisionalBiometricAuth },
    { provide: AccountPasswordVerifier, useClass: ProvisionalAccountPasswordVerifier },
    // Renovação de token: provisória até haver contrato OpenAPI (recusa toda renovação).
    { provide: TokenRefresher, useClass: HttpTokenRefresher },
    { provide: SessionRevoker, useClass: NoopSessionRevoker },
    { provide: StartupStateReader, useClass: LocalStartupStateReader },
    { provide: WelcomeSource, useClass: WelcomeApiService },
    { provide: TutorialStateStore, useClass: TutorialApiService },
    { provide: LinkedHospitalsReader, useClass: HomeHospitalsApiService },
    // Turno de trabalho e localização do hospital: provisórios (localStorage) até haver backend.
    { provide: HospitalSiteSource, useClass: ProvisionalHospitalSiteSource },
    { provide: ShiftSource, useClass: ProvisionalShiftSource },
    { provide: HospitalLinksSource, useClass: HospitalLinksApiService },
    { provide: LinkRevocationChecker, useClass: ApiLinkRevocationChecker },
    { provide: UnreadNotificationsReader, useClass: ApiUnreadNotificationsReader },
    { provide: DailyPatientsSource, useClass: CensusDailyPatientsSource },
    { provide: PatientCreationPort, useClass: PacientesApiService },
    { provide: InternacaoCreationPort, useClass: InternacoesApiService },
    { provide: BedMovementPort, useClass: BedMovementApiService },
    { provide: BedOccupancyPort, useClass: BedOccupancyApiService },
    { provide: LocationChangePort, useClass: LocationChangeApiService },
    { provide: LocationExtractor, useClass: ProvisionalLocationExtractor },
    { provide: BedNumberExtractor, useClass: ProvisionalBedNumberExtractor },
    { provide: PatientNameExtractor, useClass: ProvisionalPatientNameExtractor },
    { provide: PatientListAiCommandPort, useClass: ProvisionalPatientListAiCommand },
    PatientThreadsApiService,
    { provide: PatientMessagesSource, useExisting: PatientThreadsApiService },
    { provide: PatientMessagesWriter, useExisting: PatientThreadsApiService },
    { provide: ReplyTranscriber, useClass: ProvisionalReplyTranscriber },
    ProvisionalFollowUpClosureSource,
    { provide: FollowUpClosureSource, useExisting: ProvisionalFollowUpClosureSource },
    { provide: FollowUpClosureWriter, useExisting: ProvisionalFollowUpClosureSource },
    { provide: PatientListSource, useClass: ApiPatientListSource },
    ProvisionalPatientHubSource,
    { provide: PatientHubSource, useClass: ApiPatientHubSource },
    { provide: HypothesisSynthesizer, useClass: ProvisionalHypothesisSynthesizer },
    ProvisionalHypothesisWriter,
    { provide: HypothesisWriter, useClass: ApiHypothesisWriter },
    ProvisionalAssessmentSource,
    { provide: AssessmentAiStructurer, useClass: ProvisionalAssessmentAiStructurer },
    ProvisionalClinicalAssessmentSource,
    { provide: ClinicalAssessmentSource, useClass: ApiClinicalAssessmentSource },
    { provide: ClinicalItemHistorySource, useClass: ProvisionalClinicalItemHistorySource },
    { provide: AssessmentSource, useExisting: ProvisionalAssessmentSource },
    { provide: AssessmentWriter, useExisting: ProvisionalAssessmentSource },
    ProvisionalDailyRecordSource,
    { provide: DailyRecordSource, useExisting: ProvisionalDailyRecordSource },
    { provide: DailyRecordWriter, useExisting: ProvisionalDailyRecordSource },
    { provide: DiagnosisSource, useClass: ProvisionalDiagnosisSource },
    { provide: DiagnosisDecisionSource, useClass: ProvisionalDiagnosisDecisionSource },
    { provide: DailyEvolutionSource, useClass: ProvisionalDailyEvolutionSource },
    { provide: EvolutionAiStructurer, useClass: ProvisionalEvolutionAiStructurer },
    { provide: PrescriptionSource, useClass: ProvisionalPrescriptionSource },
    { provide: ParameterAiStructurer, useClass: ProvisionalParameterAiStructurer },
    { provide: PatientMessageSource, useClass: PatientMessageApiService },
    { provide: PatientTeamSource, useClass: PatientTeamApiService },
    { provide: ObservationFollowUpPort, useClass: ObservationFollowUpApiService },
    { provide: MessageAiAssistant, useClass: ProvisionalMessageAiAssistant },
    ProvisionalPlanSource,
    { provide: PlanSource, useClass: ApiPlanSource },
    { provide: PrescriptionSource, useClass: ProvisionalPrescriptionSource },
    { provide: NutritionTargetsReader, useClass: PlanNutritionTargetsReader },
    { provide: RefeedingRiskSource, useClass: ProvisionalRefeedingRiskSource },
    { provide: InfusedIntakeSource, useClass: ProvisionalInfusedIntakeSource },
    { provide: FoodRecallSource, useClass: ProvisionalFoodRecallSource },
    { provide: AudioTranscriber, useClass: ProvisionalAudioTranscriber },
    { provide: FormAssistant, useClass: ProvisionalFormAssistant },
    { provide: PriorStaysSource, useClass: ProvisionalPriorStaysSource },
    { provide: PriorStaysSynthesizer, useClass: ProvisionalPriorStaysSynthesizer },
    { provide: HomeNotificationsSource, useClass: HomeNotificationsApiService },
    // Provisórios (sem backend ainda): usuários de exemplo.
    { provide: HospitalInvitePort, useClass: HospitalInviteApiService },
    ProvisionalProfessionalAccess,
    { provide: ProfessionalAccessSource, useExisting: ProvisionalProfessionalAccess },
    { provide: ProfessionalAccessRevoker, useClass: ProfessionalAccessApiService },
    { provide: ManagerAccessReader, useClass: SessionManagerAccess },
    { provide: UserDirectory, useClass: ProvisionalUserDirectory },
    { provide: AnnouncementAssistant, useClass: ProvisionalAnnouncementAssistant },
    { provide: SessionRoleReader, useClass: JwtSessionRoleReader },
    { provide: PatientDuplicateSource, useClass: PatientDuplicateApiService },
    { provide: FormulasApi, useClass: ProvisionalFormulasApi },
    // Consultas de leitura do assistente (um resolvedor por intenção).
    { multi: true, provide: ASSISTANT_QUERY_RESOLVERS, useClass: PendingNotificationsQueryResolver },
    // Observa segundo plano/primeiro plano para o bloqueio por inatividade (US-001-1-08).
    provideAppInitializer(() => inject(InactivityLockService).start()),
    // Tela de privacidade: cobre o conteúdo quando o app vai para segundo plano (RN-03).
    provideAppInitializer(() => inject(PrivacyOverlayService).start()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([sessionAuthInterceptor, ...(environment.devBackend ? [devTokenInterceptor] : [])]),
    ),
    provideStore(),
    provideEffects(),
    provideRouterStore(),
    // Backend real do EP-009 com token de teste: só em `ng serve --configuration local`.
    ...(environment.devBackend ? DEV_BACKEND_PROVIDERS : []),
  ],
};
