import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('aceita caminho interno com query', () => {
    expect(safeReturnUrl('/patients/7?data=2026-11-20')).toBe('/patients/7?data=2026-11-20');
  });

  it('recusa o que não é caminho interno', () => {
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl('patients')).toBeNull();
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('/\\evil.example')).toBeNull();
  });

  it('recusa as telas de entrada', () => {
    ['/login', '/login?returnUrl=%2Fa', '/lock', '/splash', '/splash/x'].forEach(url =>
      expect(safeReturnUrl(url)).withContext(url).toBeNull(),
    );
    expect(safeReturnUrl('/loginx')).toBe('/loginx');
  });
});
