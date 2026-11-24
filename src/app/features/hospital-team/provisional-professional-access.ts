import { inject, Injectable } from '@angular/core';

import { HospitalProfessional } from './professional-access.models';
import { ProfessionalAccessRevoker, ProfessionalAccessSource } from './professional-access-port';

/** Erro com `status` HTTP, no mesmo formato que o `HttpErrorResponse` expõe. */
export class ProvisionalHttpError extends Error {
  constructor(readonly status: number) {
    super(`provisional-${status}`);
  }
}

/** Provisório: profissionais de exemplo em memória até existir a API de listagem. */
@Injectable()
export class ProvisionalProfessionalAccess extends ProfessionalAccessSource {
  private readonly professionals: HospitalProfessional[] = [
    { id: 11, name: 'Almira Borges Pereira', specialty: 'Enfermeira', status: 'approved' },
    { id: 12, name: 'Filippa Martins', specialty: 'Nutricionista', status: 'approved' },
    { id: 13, name: 'Jairo Nepomuceno', specialty: 'Farmacêutico', status: 'approved' },
  ];

  list(): Promise<readonly HospitalProfessional[]> {
    return Promise.resolve(this.professionals.map(p => ({ ...p })));
  }

  /** Aplica a revogação na lista em memória; 404 se não existe, 409 se não está aprovado. */
  markRevoked(professionalId: number): void {
    const index = this.professionals.findIndex(p => p.id === professionalId);

    if (index < 0) {
      throw new ProvisionalHttpError(404);
    }
    if (this.professionals[index].status !== 'approved') {
      throw new ProvisionalHttpError(409);
    }
    this.professionals[index] = { ...this.professionals[index], status: 'revoked' };
  }
}

@Injectable()
export class ProvisionalProfessionalRevoker extends ProfessionalAccessRevoker {
  private readonly access = inject(ProvisionalProfessionalAccess);

  revoke(_: number, professionalId: number): Promise<void> {
    try {
      this.access.markRevoked(professionalId);

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
