import { LocalProfessionalProfileReader } from './local-professional-profile-reader';

describe('LocalProfessionalProfileReader (provisional)', () => {
  it('returns the provisional professional', () => {
    expect(new LocalProfessionalProfileReader().read().name).toBe('Michelle Franklin');
  });
});
