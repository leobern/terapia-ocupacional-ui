import { Injectable } from '@angular/core';

import { ProfessionalProfile, ProfessionalProfileReader } from './professional-profile';

/** Implementação provisória: perfil fixo até a story de perfil/sessão real. */
@Injectable()
export class LocalProfessionalProfileReader extends ProfessionalProfileReader {
  read(): ProfessionalProfile {
    return { name: 'Michelle Franklin', role: 'doctor' };
  }
}
