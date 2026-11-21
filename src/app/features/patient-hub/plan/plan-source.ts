import {
  ConductFlag,
  ConductFlagRequest,
  CurrentRoute,
  RouteSaveRequest,
  SwallowingDecision,
  SwallowingSaveRequest,
} from './plan.models';

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
}
