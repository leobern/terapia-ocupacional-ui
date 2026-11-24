import { decideDestination } from './splash-destination';

describe('decideDestination', () => {
  const base = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };

  it('goes to login without a valid session', () => {
    expect(decideDestination({ ...base, isSessionValid: false })).toBe('/login');
  });

  it('goes to lock when the session is valid and locked', () => {
    expect(decideDestination({ ...base, isLocked: true })).toBe('/lock');
  });

  it('goes to home with an approved link', () => {
    expect(decideDestination(base)).toBe('/home');
  });

  it('goes to hospital links without an approved link', () => {
    expect(decideDestination({ ...base, hasApprovedHospitalLink: false })).toBe('/hospital-links');
  });

  it('goes to the tutorial when it is pending and the access is complete', () => {
    expect(decideDestination(base, true)).toBe('/tutorial');
  });

  it('keeps login, lock and hospital links ahead of a pending tutorial', () => {
    expect(decideDestination({ ...base, isSessionValid: false }, true)).toBe('/login');
    expect(decideDestination({ ...base, isLocked: true }, true)).toBe('/lock');
    expect(decideDestination({ ...base, hasApprovedHospitalLink: false }, true)).toBe('/hospital-links');
  });
});
