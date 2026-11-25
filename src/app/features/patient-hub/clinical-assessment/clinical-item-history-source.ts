import { ClinicalItemTemplate } from './clinical-assessment.models';

/**
 * Histórico de itens que o profissional já cadastrou na avaliação clínica (título, unidade e faixas), usado para sugerir um
 * novo cadastro. Sem contrato de API ainda: a implementação real substitui a provisória em `app.config.ts`.
 */
export abstract class ClinicalItemHistorySource {
  /** Do mais recente para o mais antigo. */
  abstract load(): Promise<readonly ClinicalItemTemplate[]>;
  abstract remember(items: readonly ClinicalItemTemplate[]): Promise<void>;
}
