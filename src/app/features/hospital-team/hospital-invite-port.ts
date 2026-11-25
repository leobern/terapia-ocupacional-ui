import { InviteLookup, InviteResult } from './hospital-invite.models';

/**
 * Porta do convite direto (FT-009-1, openapi/vinculos-api.yaml). Ambas as operações exigem conexão e só
 * valem após a resposta do servidor. Duplicidade, aproveitamento da solicitação pendente e notificação ao
 * profissional são responsabilidade do servidor. Falhas de HTTP (401/403/404/409...) rejeitam com
 * `HttpErrorResponse`; falha de rede rejeita sem `status`.
 */
export abstract class HospitalInvitePort {
  /** Busca a conta por e-mail e informa a relação dela com o hospital. */
  abstract lookup(hospitalId: number, email: string): Promise<InviteLookup>;
  /** Cria o vínculo direto como "Aprovado" (ou aprova a solicitação pendente) para o `usuarioId` conferido. */
  abstract confirm(hospitalId: number, usuarioId: number): Promise<InviteResult>;
}

/** O perfil atual é gestor? Provisório até existir sessão/perfil real (ADR-002). */
export abstract class ManagerAccessReader {
  abstract isManager(): boolean;
}
