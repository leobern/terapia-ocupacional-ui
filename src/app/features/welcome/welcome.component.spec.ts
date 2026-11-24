import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { WelcomeComponent } from './welcome.component';
import { WelcomeSource, WelcomeStatus } from './welcome-source';

class FakeWelcome extends WelcomeSource {
  status: Promise<WelcomeStatus> = Promise.resolve({ name: 'Ana Souza', shouldShow: true });
  completeResult: Promise<void> = Promise.resolve();
  completed = 0;

  getStatus(): Promise<WelcomeStatus> {
    return this.status;
  }

  complete(): Promise<void> {
    this.completed++;

    return this.completeResult;
  }
}

describe('WelcomeComponent', () => {
  let source: FakeWelcome;
  let navigate: jasmine.Spy;
  let fixture: ComponentFixture<WelcomeComponent>;

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    source = new FakeWelcome();
    TestBed.configureTestingModule({
      imports: [WelcomeComponent],
      providers: [provideRouter([]), { provide: WelcomeSource, useValue: source }],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  async function open(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(WelcomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  const buttons = (el: HTMLElement): HTMLButtonElement[] => Array.from(el.querySelectorAll('button'));

  it('greets the doctor by name with the two next steps', async () => {
    const el = await open();

    expect(el.querySelector('h1')?.textContent).toContain('Olá, Ana Souza!');
    expect(buttons(el).map(b => b.textContent?.trim())).toEqual(['Iniciar tutorial', 'Ir direto ao app']);
  });

  it('starting the tutorial completes the welcome and goes to the tutorial', async () => {
    const el = await open();

    buttons(el)[0].click();
    await fixture.whenStable();

    expect(source.completed).toBe(1);
    expect(navigate).toHaveBeenCalledWith('/welcome/tutorial', { replaceUrl: true });
  });

  it('going straight to the app completes the welcome and goes to home', async () => {
    const el = await open();

    buttons(el)[1].click();
    await fixture.whenStable();

    expect(source.completed).toBe(1);
    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('does not block the doctor when registering the completion fails', async () => {
    source.completeResult = Promise.reject(new Error('offline'));
    const el = await open();

    buttons(el)[1].click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('goes to home without showing anything when the welcome was already seen', async () => {
    source.status = Promise.resolve({ name: 'Ana', shouldShow: false });
    const el = await open();

    expect(el.querySelector('h1')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('goes to home when reading the state fails', async () => {
    source.status = Promise.reject(new Error('offline'));
    await open();

    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });
});
