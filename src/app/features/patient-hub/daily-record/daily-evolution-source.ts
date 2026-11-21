import { DailyEvolution, EvolutionSaveRequest } from './daily-record.models';

/**
 * Porta de leitura e gravação da evolução médica do dia (FT-004-7). Sem contrato de API: a implementação
 * real substitui a provisória em `app.config.ts`; offline, devolve o último cache local. `load` devolve
 * `null` quando ainda não há evolução no dia; ambos rejeitam em caso de falha. A trilha de auditoria
 * (autor e data/hora de cada alteração) é feita no backend. Independe dos parâmetros assistenciais.
 */
export abstract class DailyEvolutionSource {
  abstract load(patientId: string, day: string): Promise<DailyEvolution | null>;
  abstract save(request: EvolutionSaveRequest): Promise<DailyEvolution>;
}
