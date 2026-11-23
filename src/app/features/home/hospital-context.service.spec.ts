import { TestBed } from '@angular/core/testing';

import { HospitalContextService } from './hospital-context.service';
import { LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';

const A: LinkedHospital = { id: 1, name: 'Hospital A' };
const B: LinkedHospital = { id: 2, name: 'Hospital B' };

async function create(read: () => Promise<readonly LinkedHospital[]>): Promise<HospitalContextService> {
  TestBed.configureTestingModule({ providers: [{ provide: LinkedHospitalsReader, useValue: { read } }] });
  const service = TestBed.inject(HospitalContextService);

  await service.load();

  return service;
}

const hospitals =
  (list: readonly LinkedHospital[]): (() => Promise<readonly LinkedHospital[]>) =>
  () =>
    Promise.resolve(list);

describe('HospitalContextService', () => {
  it('starts loading, with no context', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: LinkedHospitalsReader, useValue: { read: (): Promise<never> => new Promise(() => undefined) } },
      ],
    });
    const service = TestBed.inject(HospitalContextService);

    expect(service.status()).toBe('loading');
    expect(service.selected()).toBeNull();
  });

  it('uses the first linked hospital as initial context', async () => {
    const service = await create(hospitals([A, B]));

    expect(service.status()).toBe('success');
    expect(service.selected()).toEqual(A);
  });

  it('has no context and cannot switch without links', async () => {
    const service = await create(hospitals([]));

    expect(service.selected()).toBeNull();
    expect(service.canSwitch()).toBeFalse();
  });

  it('cannot switch with a single hospital (RN-03)', async () => {
    const service = await create(hospitals([A]));

    expect(service.canSwitch()).toBeFalse();
    expect(service.selected()).toEqual(A);
  });

  it('switches context to another linked hospital', async () => {
    const service = await create(hospitals([A, B]));

    service.select(2);

    expect(service.selected()).toEqual(B);
    expect(service.canSwitch()).toBeTrue();
  });

  it('ignores unknown ids and the current hospital', async () => {
    const service = await create(hospitals([A, B]));

    service.select(999);
    service.select(1);

    expect(service.selected()).toEqual(A);
  });

  it('reports an error when loading fails and recovers on reload', async () => {
    let fail = true;
    const service = await create(() => (fail ? Promise.reject(new Error('x')) : Promise.resolve([A])));

    expect(service.status()).toBe('error');
    expect(service.selected()).toBeNull();

    fail = false;
    await service.load();

    expect(service.status()).toBe('success');
    expect(service.selected()).toEqual(A);
  });

  it('keeps the chosen hospital on reload while it is still linked, else falls back to the first', async () => {
    let list: readonly LinkedHospital[] = [A, B];
    const service = await create(() => Promise.resolve(list));

    service.select(2);
    await service.load();

    expect(service.selected()).toEqual(B);

    list = [A];
    await service.load();

    expect(service.selected()).toEqual(A);
  });

  it('ignores a stale load that finishes after a newer one', async () => {
    const resolvers: ((value: readonly LinkedHospital[]) => void)[] = [];

    TestBed.configureTestingModule({
      providers: [
        {
          provide: LinkedHospitalsReader,
          useValue: {
            read: (): Promise<readonly LinkedHospital[]> =>
              new Promise<readonly LinkedHospital[]>(resolve => resolvers.push(resolve)),
          },
        },
      ],
    });
    const service = TestBed.inject(HospitalContextService);
    const second = service.load();

    resolvers[1]([B]);
    await second;
    resolvers[0]([A]);
    await Promise.resolve();

    expect(service.selected()).toEqual(B);
  });
});
