import { Injectable } from '@angular/core';

import { LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';

/** Implementação provisória: um único hospital até o fluxo de vínculo (EP-001) existir. */
@Injectable()
export class MockLinkedHospitalsReader extends LinkedHospitalsReader {
  read(): readonly LinkedHospital[] {
    return [{ id: 'hospital-vila-nova-star', name: 'Hospital Vila Nova Star' }];
  }
}
