import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { environment } from '@environments/environment';

import { LocalSessionStore } from './local-session-store';
import { InactivityLockService } from './lock/inactivity-lock.service';
import { sessionGuard } from './session.guard';

describe('sessionGuard', () => {
  let locked: boolean;
  let originalDev: boolean | undefined;
  const state = { url: '/patients/7' } as RouterStateSnapshot;
  const run = (): unknown => TestBed.runInInjectionContext(() => sessionGuard({} as ActivatedRouteSnapshot, state));

  beforeEach(() => {
    localStorage.clear();
    locked = false;
    originalDev = environment.devBackend;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: { createUrlTree: (commands: string[], extras?: object): unknown => ({ commands, extras }) },
        },
        { provide: InactivityLockService, useValue: { evaluate: (): string => (locked ? 'LOCKED' : 'UNLOCKED') } },
      ],
    });
  });

  afterEach(() => {
    environment.devBackend = originalDev;
    localStorage.clear();
  });

  it('sem sessão manda ao login com a rota pedida', () => {
    environment.devBackend = false;

    expect(run()).toEqual({ commands: ['/login'], extras: { queryParams: { returnUrl: '/patients/7' } } });
  });

  it('com o token de dev tolera a falta de sessão', () => {
    environment.devBackend = true;

    expect(run()).toBeTrue();
  });

  it('com sessão libera a rota', () => {
    TestBed.inject(LocalSessionStore).open({ accessToken: 'a', refreshToken: 'r' });

    expect(run()).toBeTrue();
  });

  it('com o prazo de inatividade vencido (ou app já bloqueado) leva à tela de bloqueio', () => {
    TestBed.inject(LocalSessionStore).open({ accessToken: 'a', refreshToken: 'r' });
    locked = true;

    expect(run()).toEqual({ commands: ['/lock'], extras: undefined });
  });
});
