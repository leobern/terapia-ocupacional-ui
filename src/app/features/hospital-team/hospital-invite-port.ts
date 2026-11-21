import { InviteLookup, InviteResult } from './hospital-invite.models';

/**
 * Porta do convite direto (FT-009-1). Sem contrato de API: a implementação real substitui a
 * provisória em `app.config.ts`. Ambas as operações exigem conexão e só valem após a resposta
 * do servidor. Duplicidade, aproveitamento da solicitação pendente (FR-004/FR-006) e
 * notificação ao profissional (mecanismo da spec 003) são responsabilidade do servidor.
 */
export abstract class HospitalInvitePort {
  /** Busca a conta por e-mail e informa a relação dela com o hospital. Rejeita em falha de rede. */
  abstract lookup(hospitalId: string, email: string): Promise<InviteLookup>;
  /** Cria o vínculo direto como "Aprovado" (ou aprova a solicitação pendente). Rejeita em falha. */
  abstract confirm(hospitalId: string, email: string): Promise<InviteResult>;
}

/** O perfil atual é gestor? Provisório até existir sessão/perfil real (ADR-002). */
export abstract class ManagerAccessReader {
  abstract isManager(): boolean;
}
