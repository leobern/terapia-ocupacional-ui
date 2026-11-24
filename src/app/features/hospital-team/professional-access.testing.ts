import { inject, Injectable } from '@angular/core';

import { ProfessionalAccessRevoker } from './professional-access-port';
import { ProvisionalProfessionalAccess } from './provisional-professional-access';

/** Erro com `status` HTTP, no mesmo formato que o `HttpErrorResponse` expõe. */
export class ProvisionalHttpError extends Error {
  constructor(readonly status: number) {
    super(`provisional-${status}`);
  }
}

/** Só para testes: lista provisória que aceita revogação em memória. */
@Injectable()
export class RevocableProvisionalAccess extends ProvisionalProfessionalAccess {
  /** 404 se não existe, 409 se não está aprovado. */
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

/** Só para testes: revoga na `RevocableProvisionalAccess`. */
@Injectable()
export class ProvisionalProfessionalRevoker extends ProfessionalAccessRevoker {
  private readonly access = inject(RevocableProvisionalAccess);

  revoke(_: number, professionalId: number): Promise<void> {
    try {
      this.access.markRevoked(professionalId);

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
