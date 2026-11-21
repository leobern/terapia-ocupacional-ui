import { TestBed } from '@angular/core/testing';

import { ProfessionalProfile, ProfessionalProfileReader } from '../../home/professional-profile';
import { ProvisionalPrescriptionSource } from './provisional-prescription-source';

describe('ProvisionalPrescriptionSource', () => {
  const make = (role: ProfessionalProfile['role']): ProvisionalPrescriptionSource => {
    TestBed.configureTestingModule({
      providers: [
        ProvisionalPrescriptionSource,
        { provide: ProfessionalProfileReader, useValue: { read: (): ProfessionalProfile => ({ name: 'Ana', role }) } },
      ],
    });

    return TestBed.inject(ProvisionalPrescriptionSource);
  };

  it('não tem prescrição ativa nem revisão ao iniciar', async () => {
    const source = make('doctor');

    expect(await source.loadActive()).toBeNull();
    expect(await source.loadReview('p1', '2026-11-21')).toBeNull();
  });

  it('médico registra a revisão do dia', async () => {
    const source = make('doctor');
    const request = { at: '2026-11-21T10:00:00Z', author: 'Ana', day: '2026-11-21', patientId: 'p1' };

    expect(await source.keep(request)).toEqual({ at: request.at, author: 'Ana', day: request.day });
    expect((await source.loadReview('p1', '2026-11-21'))?.author).toBe('Ana');
  });

  it('recusa quem não é médico', async () => {
    const source = make('other');

    await expectAsync(
      source.keep({ at: '2026-11-21T10:00:00Z', author: 'Bia', day: '2026-11-21', patientId: 'p1' }),
    ).toBeRejected();

    expect(await source.loadReview('p1', '2026-11-21')).toBeNull();
  });
});
