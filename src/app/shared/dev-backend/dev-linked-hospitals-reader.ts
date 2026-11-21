import { Injectable } from '@angular/core';

import { LinkedHospital, LinkedHospitalsReader } from '../../features/home/linked-hospitals';

/** Hospital de exemplo do backend em dev (id 1, criado por `db/dev` no backend). */
@Injectable()
export class DevLinkedHospitalsReader extends LinkedHospitalsReader {
  read(): readonly LinkedHospital[] {
    return [{ id: '1', name: 'Hospital Vila Nova Star' }];
  }
}
