import { HospitalProfessional } from './professional-access.models';

/**
 * Listagem dos profissionais com vínculo no hospital. Sem contrato de API (o contrato só cobre a
 * revogação): a implementação é provisória em `app.config.ts`. Rejeita em falha de rede.
 */
export abstract class ProfessionalAccessSource {
  abstract list(hospitalId: number): Promise<readonly HospitalProfessional[]>;
}

/**
 * Revogação do acesso aprovado (US-001-2-04). Exige conexão e só vale após a resposta do servidor.
 * Rejeita com erro que traz `status` HTTP (401/403/404/409) ou sem `status` em falha de rede.
 * Auditoria (RN02) e notificação ao médico (US-001-2-03) são do servidor.
 */
export abstract class ProfessionalAccessRevoker {
  abstract revoke(hospitalId: number, professionalId: number): Promise<void>;
}
