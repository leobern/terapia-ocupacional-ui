import { CurrentRoute, RouteSaveRequest, SwallowingDecision, SwallowingSaveRequest } from './plan.models';
import { CadenceSaveRequest, ReviewCadence } from './review-cadence';

/**
 * Porta de leitura e gravação da via vigente do Plano de Intervenção (FT-004-6). Sem contrato de API: a
 * implementação real substitui a provisória em `app.config.ts`. `loadRoute` devolve `null` quando o
 * paciente não tem via definida; ambos rejeitam em caso de falha. Última gravação prevalece (sem lock).
 */
export abstract class PlanSource {
  abstract loadRoute(patientId: string): Promise<CurrentRoute | null>;
  abstract saveRoute(request: RouteSaveRequest): Promise<CurrentRoute>;
  /** Decisão vigente sobre avaliação de deglutição; `null` quando ainda não há. Independente da via. */
  abstract loadSwallowing(patientId: string): Promise<SwallowingDecision | null>;
  abstract saveSwallowing(request: SwallowingSaveRequest): Promise<SwallowingDecision>;
  /** Cadência da próxima revisão (FR-012/013); `null` quando não há gravada (vale a diária). */
  abstract loadCadence(patientId: string): Promise<ReviewCadence | null>;
  abstract saveCadence(request: CadenceSaveRequest): Promise<ReviewCadence>;
}
