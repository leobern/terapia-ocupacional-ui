import { TestBed } from '@angular/core/testing';

import { HospitalContextService } from './hospital-context.service';
import { LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';

const A: LinkedHospital = { id: 'a', name: 'Hospital A' };
const B: LinkedHospital = { id: 'b', name: 'Hospital B' };

function create(hospitals: readonly LinkedHospital[]): HospitalContextService {
  TestBed.configureTestingModule({
    providers: [{ provide: LinkedHospitalsReader, useValue: { read: (): readonly LinkedHospital[] => hospitals } }],
  });

  return TestBed.inject(HospitalContextService);
}

describe('HospitalContextService', () => {
  it('uses the first linked hospital as initial context', () => {
    const service = create([A, B]);

    expect(service.selected()).toEqual(A);
  });

  it('has no context and cannot switch without links', () => {
    const service = create([]);

    expect(service.selected()).toBeNull();
    expect(service.canSwitch).toBeFalse();
  });

  it('cannot switch with a single hospital', () => {
    expect(create([A]).canSwitch).toBeFalse();
  });

  it('switches context to another linked hospital', () => {
    const service = create([A, B]);

    service.select('b');

    expect(service.selected()).toEqual(B);
    expect(service.canSwitch).toBeTrue();
  });

  it('ignores unknown ids and the current hospital', () => {
    const service = create([A, B]);

    service.select('zzz');
    service.select('a');

    expect(service.selected()).toEqual(A);
  });
});
