import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { approvedHospitalLinkGuard } from './approved-hospital-link.guard';
import { HospitalLinksSource } from './hospital-links-source';

describe('approvedHospitalLinkGuard', () => {
  let list: jasmine.Spy;

  const run = (): Promise<boolean | UrlTree> =>
    TestBed.runInInjectionContext(() =>
      approvedHospitalLinkGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;

  beforeEach(() => {
    list = jasmine.createSpy('list');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: HospitalLinksSource, useValue: { list } }],
    });
  });

  it('deixa abrir com vínculo aprovado', async () => {
    list.and.resolveTo({ hasApprovedLink: true, items: [] });

    expect(await run()).toBeTrue();
  });

  it('sem vínculo aprovado redireciona à tela de vínculos com o aviso', async () => {
    list.and.resolveTo({ hasApprovedLink: false, items: [] });

    const result = await run();

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/hospital-links?acesso=bloqueado');
  });

  it('falha ao consultar não redireciona (evita loop)', async () => {
    list.and.rejectWith(new Error('falha'));

    expect(await run()).toBeTrue();
  });
});
