/** Estado do tutorial: `PENDENTE` até o médico concluir ou pular (contrato `tutorial-api.yaml`). */
export type TutorialStatus = 'PENDENTE' | 'CONCLUIDO' | 'PULADO';

/** Resultado que o médico registra ao sair do tutorial. */
export type TutorialResult = Exclude<TutorialStatus, 'PENDENTE'>;

/**
 * Fronteira de leitura e registro do estado do tutorial (US-001-3-02).
 * Provisória (`LocalTutorialStateStore`) até o serviço HTTP do contrato entrar em `app.config.ts`.
 */
export abstract class TutorialStateStore {
  abstract read(): Promise<TutorialStatus>;
  /** Idempotente: depois do primeiro registro, mantém o resultado original. */
  abstract register(result: TutorialResult): Promise<void>;
}
