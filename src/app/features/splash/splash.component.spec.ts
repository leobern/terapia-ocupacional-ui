import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';

import { TutorialStateStore, TutorialStatus } from '../tutorial/tutorial-state';
import { WelcomeSource, WelcomeStatus } from '../welcome/welcome-source';
import { SPLASH_MIN_DISPLAY_MS, SPLASH_TIMEOUT_MS, SplashComponent } from './splash.component';
import { LocalStartupState, StartupStateReader } from './startup-state';

class FakeTutorial extends TutorialStateStore {
  status: Promise<TutorialStatus> = Promise.resolve('CONCLUIDO');

  read(): Promise<TutorialStatus> {
    return this.status;
  }

  register(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeReader extends StartupStateReader {
  state: LocalStartupState = { hasApprovedHospitalLink: false, isLocked: false, isSessionValid: false };
  initialize!: jasmine.Spy<() => Promise<void>>;

  readLocal(): LocalStartupState {
    return this.state;
  }
}

class FakeWelcome extends WelcomeSource {
  status: Promise<WelcomeStatus> = Promise.resolve({ name: 'Ana', shouldShow: false });

  getStatus(): Promise<WelcomeStatus> {
    return this.status;
  }

  complete(): Promise<void> {
    return Promise.resolve();
  }
}

describe('SplashComponent', () => {
  let reader: FakeReader;
  let welcome: FakeWelcome;
  let tutorial: FakeTutorial;
  let navigate: jasmine.Spy;
  let fixture: ComponentFixture<SplashComponent>;

  async function drain(times: number): Promise<void> {
    if (times > 0) {
      await Promise.resolve();
      await drain(times - 1);
    }
  }

  /** Avança o relógio simulado e drena as promises pendentes. */
  async function tick(ms: number): Promise<void> {
    jasmine.clock().tick(ms);
    await drain(8);
    await new Promise<void>(resolve => queueMicrotask(resolve));
  }

  beforeEach(() => {
    jasmine.clock().install();
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    reader = new FakeReader();
    welcome = new FakeWelcome();
    tutorial = new FakeTutorial();
    reader.initialize = jasmine.createSpy('initialize').and.callFake(() => Promise.resolve());
    TestBed.configureTestingModule({
      imports: [SplashComponent],
      providers: [
        provideRouter([]),
        { provide: StartupStateReader, useValue: reader },
        { provide: WelcomeSource, useValue: welcome },
        { provide: TutorialStateStore, useValue: tutorial },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  afterEach(() => jasmine.clock().uninstall());

  function open(): void {
    fixture = TestBed.createComponent(SplashComponent);
    fixture.detectChanges();
  }

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('renders the logo with accessible name, no buttons and no loader', () => {
    open();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Conductia');
    expect(el.querySelector('app-icon-logo')?.getAttribute('state') ?? 'anim').toBe('anim');
    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('[role="progressbar"], [role="status"]')).toBeNull();
  });

  it('C1: routes to login without valid session', async () => {
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('C2: routes to lock', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: true, isSessionValid: true };
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/lock', { replaceUrl: true });
  });

  it('welcome: routes to the welcome screen on the first approved access', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    welcome.status = Promise.resolve({ name: 'Ana', shouldShow: true });
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/welcome', { replaceUrl: true });
  });

  it('welcome has priority over a pending tutorial on the first approved access', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    welcome.status = Promise.resolve({ name: 'Ana', shouldShow: true });
    tutorial.status = Promise.resolve('PENDENTE');
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledOnceWith('/welcome', { replaceUrl: true });
  });

  it('routes to the tutorial when the welcome was already seen and the tutorial is pending', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    welcome.status = Promise.resolve({ name: 'Ana', shouldShow: false });
    tutorial.status = Promise.resolve('PENDENTE');
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledOnceWith('/tutorial', { replaceUrl: true });
  });

  it('welcome: falls back to home when reading the welcome state fails', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    welcome.status = Promise.reject(new Error('offline'));
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  describe('returnUrl (rota pedida antes do login)', () => {
    function openWith(returnUrl: string): void {
      (TestBed.inject(ActivatedRoute) as { snapshot: unknown }).snapshot = {
        queryParamMap: convertToParamMap({ returnUrl }),
      };
      reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
      open();
    }

    it('vai à rota pedida quando o destino seria o Painel', async () => {
      openWith('/patients/7');
      await tick(SPLASH_MIN_DISPLAY_MS);

      expect(navigate).toHaveBeenCalledWith('/patients/7', { replaceUrl: true });
    });

    it('ignora destino externo', async () => {
      openWith('//evil.example');
      await tick(SPLASH_MIN_DISPLAY_MS);

      expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
    });

    it('não passa na frente do tutorial pendente', async () => {
      tutorial.status = Promise.resolve('PENDENTE');
      openWith('/patients/7');
      await tick(SPLASH_MIN_DISPLAY_MS);

      expect(navigate).toHaveBeenCalledWith('/tutorial', { replaceUrl: true });
    });
  });

  it('welcome: does not consult the welcome state without a session', async () => {
    const spy = spyOn(welcome, 'getStatus').and.callThrough();

    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(spy).not.toHaveBeenCalled();
  });

  it('C3: routes to home', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('routes to the tutorial when it is pending (first access)', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    tutorial.status = Promise.resolve('PENDENTE');
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/tutorial', { replaceUrl: true });
  });

  it('routes straight to home when the tutorial was skipped', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    tutorial.status = Promise.resolve('PULADO');
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('routes to home without blocking when reading the tutorial state fails', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    tutorial.status = Promise.reject(new Error('offline'));
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('does not read the tutorial before login, lock or hospital links', async () => {
    const read = spyOn(tutorial, 'read').and.callThrough();

    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(read).not.toHaveBeenCalled();
  });

  it('does not navigate when destroyed while reading the tutorial', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    let resolve!: (s: TutorialStatus) => void;

    tutorial.status = new Promise<TutorialStatus>(r => (resolve = r));
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);
    fixture.destroy();
    resolve('PENDENTE');
    await tick(0);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('RN-03: routes to hospital links without approved link', async () => {
    reader.state = { hasApprovedHospitalLink: false, isLocked: false, isSessionValid: true };
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/hospital-links', { replaceUrl: true });
  });

  it('C4: waits the 2s minimum even when initialization is instant', async () => {
    open();
    await tick(SPLASH_MIN_DISPLAY_MS - 1);

    expect(navigate).not.toHaveBeenCalled();

    await tick(1);

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('waits for slow initialization beyond 2s', async () => {
    let resolve!: () => void;

    reader.initialize.and.returnValue(new Promise<void>(r => (resolve = r)));
    open();
    await tick(SPLASH_MIN_DISPLAY_MS + 1000);

    expect(navigate).not.toHaveBeenCalled();

    resolve();
    await tick(0);

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('C7: offline with valid local session routes normally', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    reader.initialize.and.rejectWith(new Error('offline'));
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('C5: network failure without session shows MSG-01 immediately', async () => {
    reader.initialize.and.rejectWith(new Error('offline'));
    open();
    await tick(0);
    fixture.detectChanges();

    expect(text()).toContain('Sem conexão');
    expect(text()).toContain('Tentar novamente');
    expect(navigate).not.toHaveBeenCalled();
    await tick(SPLASH_TIMEOUT_MS);
  });

  it('C6: timeout after 30s shows MSG-01', async () => {
    reader.initialize.and.returnValue(new Promise<void>(() => undefined));
    open();
    await tick(SPLASH_TIMEOUT_MS - 1);
    fixture.detectChanges();

    expect(text()).not.toContain('Sem conexão');

    await tick(1);
    fixture.detectChanges();

    expect(text()).toContain('Sem conexão');
  });

  it('C8: retry returns to INITIALIZING, reruns init and restarts timers', async () => {
    reader.initialize.and.rejectWith(new Error('offline'));
    open();
    await tick(0);
    fixture.detectChanges();
    reader.initialize.and.callFake(() => Promise.resolve());
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    fixture.detectChanges();

    expect(reader.initialize).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('Sem conexão');

    await tick(SPLASH_MIN_DISPLAY_MS - 1);

    expect(navigate).not.toHaveBeenCalled();

    await tick(1);

    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('ignores a stale attempt result after destroy', async () => {
    open();
    fixture.destroy();
    await tick(SPLASH_TIMEOUT_MS);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores a stale rejection after retry superseded it', async () => {
    let reject!: (e: Error) => void;

    reader.initialize.and.returnValue(new Promise<void>((_, r) => (reject = r)));
    open();
    await tick(SPLASH_TIMEOUT_MS);
    fixture.detectChanges();
    reader.initialize.and.callFake(() => Promise.resolve());
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    reject(new Error('late'));
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
