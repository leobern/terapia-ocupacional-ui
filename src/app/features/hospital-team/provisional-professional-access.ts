import { Injectable } from '@angular/core';

import { HospitalProfessional } from './professional-access.models';
import { ProfessionalAccessSource } from './professional-access-port';

/** Provisório: profissionais de exemplo em memória até existir a API de listagem. */
@Injectable()
export class ProvisionalProfessionalAccess extends ProfessionalAccessSource {
  protected readonly professionals: HospitalProfessional[] = [
    { id: 11, name: 'Almira Borges Pereira', specialty: 'Enfermeira', status: 'approved' },
    { id: 12, name: 'Filippa Martins', specialty: 'Nutricionista', status: 'approved' },
    { id: 13, name: 'Jairo Nepomuceno', specialty: 'Farmacêutico', status: 'approved' },
  ];

  list(): Promise<readonly HospitalProfessional[]> {
    return Promise.resolve(this.professionals.map(p => ({ ...p })));
  }
}
