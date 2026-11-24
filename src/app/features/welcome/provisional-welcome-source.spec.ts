import { TestBed } from '@angular/core/testing';

import { ProfessionalProfileReader } from '../home/professional-profile';
import { LocalStartupState, StartupStateReader } from '../splash/startup-state';
import { ProvisionalWelcomeSource, WELCOME_SEEN_KEY } from './provisional-welcome-source';

describe('ProvisionalWelcomeSource', () => {
  let approved: boolean;
  let source: ProvisionalWelcomeSource;

  beforeEach(() => {
    localStorage.removeItem(WELCOME_SEEN_KEY);
    approved = true;
    TestBed.configureTestingModule({
      providers: [
        ProvisionalWelcomeSource,
        {
          provide: StartupStateReader,
          useValue: {
            readLocal: (): LocalStartupState => ({
              hasApprovedHospitalLink: approved,
              isLocked: false,
              isSessionValid: true,
            }),
          },
        },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): { name: string; role: 'doctor' } => ({ name: 'Ana', role: 'doctor' }) },
        },
      ],
    });
    source = TestBed.inject(ProvisionalWelcomeSource);
  });

  afterEach(() => localStorage.removeItem(WELCOME_SEEN_KEY));

  it('shows once with an approved hospital, with the professional name', async () => {
    expect(await source.getStatus()).toEqual({ name: 'Ana', shouldShow: true });
  });

  it('does not show again after completing (RN01)', async () => {
    await source.complete();

    expect((await source.getStatus()).shouldShow).toBeFalse();
  });

  it('does not show without an approved hospital', async () => {
    approved = false;

    expect((await source.getStatus()).shouldShow).toBeFalse();
  });
});
