import { HospitalInvitePort } from '../../features/hospital-team/hospital-invite-port';
import { FormulasApi } from '../../features/pharmacy/formulas-api';
import { DEV_BACKEND_PROVIDERS } from './dev-backend.providers';
import { HttpFormulasApi } from './http-formulas-api';
import { HttpHospitalInvite } from './http-hospital-invite';

describe('DEV_BACKEND_PROVIDERS', () => {
  it('troca os provisórios pelas implementações HTTP do backend', () => {
    expect(DEV_BACKEND_PROVIDERS).toEqual([
      { provide: FormulasApi, useClass: HttpFormulasApi },
      { provide: HospitalInvitePort, useClass: HttpHospitalInvite },
    ]);
  });
});
