import { TestBed } from '@angular/core/testing';

import { OfflineStore } from '../../shared/offline/offline-store';
import { InMemoryOfflineStore, tokenFor } from '../../shared/offline/offline-testing.spec';
import { OutboxService } from '../../shared/offline/outbox.service';
import { LocalSessionStore } from './local-session-store';
import { LogoutService } from './logout.service';
import { SessionRevoker } from './session-revoker';

class FakeRevoker extends SessionRevoker {
  revokeCurrentDevice!: jasmine.Spy<() => Promise<void>>;
  revokeToken = (): Promise<void> => Promise.resolve();
}

const SENSITIVE_KEYS = ['jwt', 'auth_token', 'clinical.notes', 'hospital', 'user', 'token', 'session.x', 'cache.y'];

function expectSensitiveKeysGone(): void {
  SENSITIVE_KEYS.forEach(key => {
    expect(localStorage.getItem(key)).withContext(`localStorage ${key}`).toBeNull();
    expect(sessionStorage.getItem(key)).withContext(`sessionStorage ${key}`).toBeNull();
  });
}

describe('LogoutService', () => {
  let revoker: FakeRevoker;
  let service: LogoutService;

  beforeEach(() => {
    revoker = new FakeRevoker();
    revoker.revokeCurrentDevice = jasmine.createSpy('revokeCurrentDevice').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionRevoker, useValue: revoker },
        { provide: OfflineStore, useFactory: (): InMemoryOfflineStore => new InMemoryOfflineStore() },
      ],
    });
    service = TestBed.inject(LogoutService);
    SENSITIVE_KEYS.forEach(key => {
      localStorage.setItem(key, 'x');
      sessionStorage.setItem(key, 'x');
    });
    localStorage.setItem('lang', 'pt-BR');
    sessionStorage.setItem('ui.sidebar', 'open');
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('revokes only the current device session and clears sensitive local cache', async () => {
    await service.logout();

    expect(revoker.revokeCurrentDevice).toHaveBeenCalledTimes(1);
    expectSensitiveKeysGone();

    expect(localStorage.getItem('lang')).toBe('pt-BR');
    expect(sessionStorage.getItem('ui.sidebar')).toBe('open');
    expect(TestBed.inject(LocalSessionStore).isValid()).toBeFalse();
  });

  it('exposes only the current-device revocation (no sign-out-everywhere)', async () => {
    await service.logout();

    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(service)).filter(m => m !== 'constructor');

    expect(methods).toEqual(['logout']);
    expect(Object.keys(revoker).filter(k => /all/i.test(k))).toEqual([]);
    expect(revoker.revokeCurrentDevice).toHaveBeenCalledOnceWith();
  });

  it('still clears local data when remote revocation fails', async () => {
    revoker.revokeCurrentDevice.and.rejectWith(new Error('offline'));

    await expectAsync(service.logout()).toBeResolved();

    expectSensitiveKeysGone();

    expect(localStorage.getItem('lang')).toBe('pt-BR');
    expect(sessionStorage.getItem('ui.sidebar')).toBe('open');
    expect(TestBed.inject(LocalSessionStore).isValid()).toBeFalse();
  });

  describe('modo offline (ADR-003)', () => {
    let offline: InMemoryOfflineStore;

    beforeEach(async () => {
      offline = TestBed.inject(OfflineStore) as InMemoryOfflineStore;
      TestBed.inject(LocalSessionStore).open({ accessToken: tokenFor({ upn: 'ana@x.com' }), refreshToken: 'r' });
      await offline.putCache('ana@x.com', 'k', 1, 'x');
      await offline.putCache('outra@x.com', 'k', 2, 'x');
      await offline.putOutbox({
        attempted: false,
        attempts: 0,
        day: '2026-11-26',
        nextAttemptAt: 'x',
        occurredAt: 'x',
        opId: 'o1',
        patientId: '42',
        payload: {},
        seq: 1,
        status: 'pending',
        type: 'evolution-text',
        userId: 'ana@x.com',
      });
    });

    it('apaga o cache de leitura do usuário, mas NÃO descarta a fila de escrita pendente', async () => {
      await service.logout();

      expect(await offline.getCache('ana@x.com', 'k')).toBeNull();
      expect((await offline.getCache('outra@x.com', 'k'))?.value).toBe(2);
      expect((await offline.listOutbox('ana@x.com')).length).toBe(1);
    });

    it('a fila some da tela de quem entrar depois (mas continua no aparelho)', async () => {
      const outbox = TestBed.inject(OutboxService);

      await outbox.reload();
      expect(outbox.operations().length).toBe(1);
      await service.logout();

      expect(outbox.operations()).toEqual([]);
      expect((await offline.listOutbox('ana@x.com')).length).toBe(1);
    });

    it('um armazenamento local com defeito não impede o logout', async () => {
      spyOn(offline, 'clearCache').and.callFake(() => Promise.reject(new Error('IDB')));

      await expectAsync(service.logout()).toBeResolved();
      expect(TestBed.inject(LocalSessionStore).isValid()).toBeFalse();
    });
  });
});
