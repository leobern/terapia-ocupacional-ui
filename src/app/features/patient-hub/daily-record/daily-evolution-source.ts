import { DailyEvolution, EvolutionSaveRequest } from './daily-record.models';

/** Evolução de um dia na lista de evoluções. */
export interface DailyEvolutionDay {
  /** AAAA-MM-DD */
  readonly day: string;
  readonly evolution: DailyEvolution;
}

/**
 * Porta de leitura e gravação da evolução médica do dia (FT-004-7). A implementação real
 * (`ApiDailyEvolutionSource`) usa `/api/v1/pacientes/{id}/evolucoes`; a provisória atende os ids de exemplo.
 * `load` devolve `null` quando ainda não há evolução no dia; ambos rejeitam em caso de falha. Autor e data/hora de
 * cada versão são do servidor (trilha de auditoria). Independe dos parâmetros assistenciais.
 */
export abstract class DailyEvolutionSource {
  /**
   * Evoluções dos dias pedidos (`aaaa-mm-dd`), do mais recente ao mais antigo, só dos dias que têm registro. Padrão:
   * uma leitura por dia, tolerando falha de dias isolados; rejeita só quando todas falham. A API real troca por
   * leitura paginada.
   */
  async list(patientId: string, days: readonly string[]): Promise<readonly DailyEvolutionDay[]> {
    const results = await Promise.allSettled(days.map(day => this.load(patientId, day)));

    if (results.length > 0 && results.every(r => r.status === 'rejected')) {
      throw new Error('Nenhuma evolução pôde ser lida.');
    }
    const list: DailyEvolutionDay[] = [];

    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value !== null) {
        list.push({ day: days[i], evolution: r.value });
      }
    });

    return list.sort((a, b) => b.day.localeCompare(a.day));
  }

  abstract load(patientId: string, day: string): Promise<DailyEvolution | null>;
  abstract save(request: EvolutionSaveRequest): Promise<DailyEvolution>;
}
