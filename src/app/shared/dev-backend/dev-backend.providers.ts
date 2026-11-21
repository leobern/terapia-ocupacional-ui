import { Provider } from '@angular/core';

import { LinkedHospitalsReader } from '../../features/home/linked-hospitals';
import { HospitalInvitePort } from '../../features/hospital-team/hospital-invite-port';
import { FormulasApi } from '../../features/pharmacy/formulas-api';
import { DevLinkedHospitalsReader } from './dev-linked-hospitals-reader';
import { HttpFormulasApi } from './http-formulas-api';
import { HttpHospitalInvite } from './http-hospital-invite';

/**
 * Liga as telas do EP-009 ao backend real (`environment.devBackend`, `ng serve --configuration local`).
 * Vêm depois dos provisórios em `app.config.ts`, então os substituem.
 */
export const DEV_BACKEND_PROVIDERS: readonly Provider[] = [
  { provide: LinkedHospitalsReader, useClass: DevLinkedHospitalsReader },
  { provide: FormulasApi, useClass: HttpFormulasApi },
  { provide: HospitalInvitePort, useClass: HttpHospitalInvite },
];
