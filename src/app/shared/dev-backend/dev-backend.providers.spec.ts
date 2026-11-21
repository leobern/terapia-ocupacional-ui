import { LinkedHospitalsReader } from '../../features/home/linked-hospitals';
import { HospitalInvitePort } from '../../features/hospital-team/hospital-invite-port';
import { FormulasApi } from '../../features/pharmacy/formulas-api';
import { DEV_BACKEND_PROVIDERS } from './dev-backend.providers';
import { DevLinkedHospitalsReader } from './dev-linked-hospitals-reader';
import { HttpFormulasApi } from './http-formulas-api';
import { HttpHospitalInvite } from './http-hospital-invite';

describe('DEV_BACKEND_PROVIDERS', () => {
  it('troca os provisórios pelas implementações HTTP e pelo hospital de exemplo do backend', () => {
    expect(DEV_BACKEND_PROVIDERS).toEqual([
      { provide: LinkedHospitalsReader, useClass: DevLinkedHospitalsReader },
      { provide: FormulasApi, useClass: HttpFormulasApi },
      { provide: HospitalInvitePort, useClass: HttpHospitalInvite },
    ]);
  });

  it('o hospital de exemplo tem o id numérico criado pelo seed do backend', () => {
    expect(new DevLinkedHospitalsReader().read()).toEqual([{ id: '1', name: 'Hospital Vila Nova Star' }]);
  });
});
