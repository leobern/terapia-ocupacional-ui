import {
  ConductFlag,
  ConductFlagRequest,
  CurrentRoute,
  RouteSaveRequest,
  SwallowingDecision,
  SwallowingSaveRequest,
} from './plan.models';
import {
  CalculatedWeights,
  NutritionTargets,
  ReferenceWeight,
  ReferenceWeightSaveRequest,
  TargetsSaveRequest,
} from './plan-targets';
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
  /** Sinalizações de mudança de conduta, da mais antiga para a mais recente; não expiram nem mudam a via. */
  abstract loadConductFlags(patientId: string): Promise<readonly ConductFlag[]>;
  /** Acrescenta a sinalização e grava autor e data/hora na trilha de auditoria imutável (só acréscimo). */
  abstract addConductFlag(request: ConductFlagRequest): Promise<ConductFlag>;
  /** Pesos já calculados na Avaliação (somente leitura); objeto vazio quando não há nenhum. */
  abstract loadCalculatedWeights(patientId: string): Promise<CalculatedWeights>;
  /** Peso de referência vigente; `null` quando ainda não escolhido. */
  abstract loadReferenceWeight(patientId: string): Promise<ReferenceWeight | null>;
  abstract saveReferenceWeight(request: ReferenceWeightSaveRequest): Promise<ReferenceWeight>;
  /** Metas vigentes; `null` quando ainda não definidas. */
  abstract loadTargets(patientId: string): Promise<NutritionTargets | null>;
  abstract saveTargets(request: TargetsSaveRequest): Promise<NutritionTargets>;
  /** Cadência da próxima revisão (FR-012/013); `null` quando não há gravada (vale a diária). */
  abstract loadCadence(patientId: string): Promise<ReviewCadence | null>;
  abstract saveCadence(request: CadenceSaveRequest): Promise<ReviewCadence>;
  /** Responsável pelo plano (nome do médico); `null` quando ainda não escolhido. */
  abstract loadResponsible(patientId: string): Promise<string | null>;
  abstract saveResponsible(request: ResponsibleSaveRequest): Promise<string>;
  /** Médicos vinculados ao hospital do paciente que podem ser responsáveis. */
  abstract loadResponsibleOptions(patientId: string): Promise<readonly string[]>;
}

export interface ResponsibleSaveRequest {
  readonly at: string;
  readonly author: string;
  readonly name: string;
  readonly patientId: string;
}
