/** Estado do fluxo de boas-vindas do profissional autenticado (US-001-3-01). */
export interface WelcomeStatus {
  /** `true` só com ≥1 hospital aprovado e boas-vindas ainda não concluídas (RN01). */
  readonly shouldShow: boolean;
  /** Nome para a saudação personalizada. */
  readonly name: string;
}

/**
 * Fronteira de dados das boas-vindas. Falhas rejeitam a promise; quem chama
 * (splash e tela) nunca trava o médico: segue ao Painel Metabólico.
 */
export abstract class WelcomeSource {
  abstract getStatus(): Promise<WelcomeStatus>;
  /** Marca as boas-vindas como concluídas (idempotente). */
  abstract complete(): Promise<void>;
}
