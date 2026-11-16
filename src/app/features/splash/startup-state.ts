/** Estado local lido na abertura do app (sem depender de rede). */
export interface LocalStartupState {
  /** `localSession.isValid`: há token armazenado e não expirado. */
  readonly isSessionValid: boolean;
  /** `lockState == LOCKED`. */
  readonly isLocked: boolean;
  /** Existe ≥1 `HospitalLink.status == APPROVED` (em cache local). */
  readonly hasApprovedHospitalLink: boolean;
}

/**
 * Fronteira de leitura do estado de sessão, bloqueio e vínculos.
 *
 * DEPENDÊNCIA: US-001-1-08 (sessão/bloqueio) e US-001-2-02 (vínculos) fornecerão a
 * implementação real, substituindo `LocalStartupStateReader` em `app.config.ts`.
 */
export abstract class StartupStateReader {
  /** Lê o estado persistido no dispositivo. */
  abstract readLocal(): LocalStartupState;
  /**
   * Registra um login bem-sucedido (US-001-1-03): sessão válida, sem bloqueio e com o
   * estado de vínculos retornado. A persistência real do token é da US-001-1-08.
   */
  abstract registerLogin(hasApprovedHospitalLink: boolean): void;
  /** Inicialização remota (ex.: renovar sessão). Rejeita em falha de rede. */
  abstract initialize(): Promise<void>;
}
