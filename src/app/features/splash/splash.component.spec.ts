import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SPLASH_MIN_DISPLAY_MS, SPLASH_TIMEOUT_MS, SplashComponent } from './splash.component';
import { LocalStartupState, StartupStateReader } from './startup-state';

class FakeReader extends StartupStateReader {
  state: LocalStartupState = { hasApprovedHospitalLink: false, isLocked: false, isSessionValid: false };
  initialize!: jasmine.Spy<() => Promise<void>>;

  readLocal(): LocalStartupState {
    return this.state;
  }
}

describe('SplashComponent', () => {
  let reader: FakeReader;
  let navigate: jasmine.Spy;
  let fixture: ComponentFixture<SplashComponent>;

  /** Avança o relógio simulado e drena as promises pendentes. */
  async function tick(ms: number): Promise<void> {
    jasmine.clock().tick(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    jasmine.clock().install();
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    reader = new FakeReader();
    reader.initialize = jasmine.createSpy('initialize').and.callFake(() => Promise.resolve());
    TestBed.configureTestingModule({
      imports: [SplashComponent],
      providers: [provideRouter([]), { provide: StartupStateReader, useValue: reader }],
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

  it('C3: routes to home', async () => {
    reader.state = { hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true };
    open();
    await tick(SPLASH_MIN_DISPLAY_MS);

    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
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

    expect(text()).toContain('Sem conexão. Verifique sua internet.');
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

    expect(text()).toContain('Sem conexão. Verifique sua internet.');
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
