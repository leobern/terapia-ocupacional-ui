import { Injectable } from '@angular/core';

import { InviteLookup, InviteResult, LinkRelation } from './hospital-invite.models';
import { HospitalInvitePort, ManagerAccessReader } from './hospital-invite-port';

interface Account {
  readonly name: string;
  readonly specialty: string;
  relation: LinkRelation;
}

/** Provisório: contas de exemplo em memória até existir a API de vínculos. */
@Injectable()
export class ProvisionalHospitalInvite extends HospitalInvitePort {
  private readonly accounts = new Map<string, Account>([
    ['filippa@conductia.com', { name: 'Filippa Martins', relation: 'none', specialty: 'Nutricionista' }],
    ['jairo@conductia.com', { name: 'Jairo Nepomuceno', relation: 'pending', specialty: 'Farmacêutico' }],
    ['almira@conductia.com', { name: 'Almira Borges Pereira', relation: 'approved', specialty: 'Enfermeira' }],
  ]);

  lookup(_: number, email: string): Promise<InviteLookup> {
    const key = email.trim().toLowerCase();
    const account = this.accounts.get(key);

    return Promise.resolve(
      account === undefined
        ? { kind: 'not-registered' }
        : {
            kind: 'found',
            profile: { email: key, name: account.name, specialty: account.specialty },
            relation: account.relation,
          },
    );
  }

  confirm(_: number, email: string): Promise<InviteResult> {
    const account = this.accounts.get(email.trim().toLowerCase());

    if (account === undefined || account.relation === 'approved') {
      return Promise.reject(new Error('invite-not-allowed'));
    }
    const approvedRequest = account.relation === 'pending';

    account.relation = 'approved';

    return Promise.resolve({ approvedRequest });
  }
}

/** Provisório: o perfil gestor é atribuído pela equipe Conductia; aqui o usuário de exemplo é gestor. */
@Injectable()
export class ProvisionalManagerAccess extends ManagerAccessReader {
  isManager(): boolean {
    return true;
  }
}
