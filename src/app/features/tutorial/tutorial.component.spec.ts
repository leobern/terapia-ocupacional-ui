import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { TutorialComponent } from './tutorial.component';
import { TutorialResult, TutorialStateStore, TutorialStatus } from './tutorial-state';
import { TUTORIAL_STEPS } from './tutorial-steps';

class FakeStore extends TutorialStateStore {
  register!: jasmine.Spy<(result: TutorialResult) => Promise<void>>;

  read(): Promise<TutorialStatus> {
    return Promise.resolve('PENDENTE');
  }
}

describe('TutorialComponent', () => {
  let store: FakeStore;
  let navigate: jasmine.Spy;
  let fixture: ComponentFixture<TutorialComponent>;

  let routeData: Record<string, unknown>;

  beforeEach(() => {
    routeData = {};
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    store = new FakeStore();
    store.register = jasmine.createSpy('register').and.resolveTo();
    TestBed.configureTestingModule({
      imports: [TutorialComponent],
      providers: [
        provideRouter([]),
        { provide: TutorialStateStore, useValue: store },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get data(): Record<string, unknown> {
                return routeData;
              },
            },
          },
        },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  function open(): void {
    fixture = TestBed.createComponent(TutorialComponent);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const buttons = (): HTMLButtonElement[] => Array.from(el().querySelectorAll('button'));
  const button = (label: string): HTMLButtonElement | undefined => buttons().find(b => b.textContent?.trim() === label);
  const click = (label: string): void => {
    button(label)?.click();
    fixture.detectChanges();
  };
  const flush = (): Promise<void> => fixture.whenStable();

  it('has at most 5 steps (RN01)', () => {
    expect(TUTORIAL_STEPS.length).toBeLessThanOrEqual(5);
  });

  it('shows the first step with progress, skip and no back button', () => {
    open();

    expect(el().querySelector('h1')?.textContent).toContain('Painel Metabólico');
    expect(el().textContent).toContain(`Passo 1 de ${TUTORIAL_STEPS.length}`);
    expect(button('Pular')).toBeDefined();
    expect(button('Voltar')).toBeUndefined();
  });

  it('advances and goes back', () => {
    open();
    click('Avançar');

    expect(el().querySelector('h1')?.textContent).toContain('Pacientes');
    expect(button('Voltar')).toBeDefined();

    click('Voltar');

    expect(el().querySelector('h1')?.textContent).toContain('Painel Metabólico');
  });

  it('keeps "Pular" visible on every step (RN02)', () => {
    open();
    TUTORIAL_STEPS.forEach(() => {
      expect(button('Pular')).toBeDefined();
      click(button('Avançar') ? 'Avançar' : 'Concluir');
    });
  });

  it('Scenario 1: finishing registers CONCLUIDO and goes to home', async () => {
    open();
    TUTORIAL_STEPS.slice(1).forEach(() => click('Avançar'));

    expect(button('Avançar')).toBeUndefined();

    click('Concluir');
    await flush();

    expect(store.register).toHaveBeenCalledOnceWith('CONCLUIDO' satisfies TutorialResult);
    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('Scenario 2: skipping registers PULADO and goes straight to home', async () => {
    open();
    click('Pular');
    await flush();

    expect(store.register).toHaveBeenCalledOnceWith('PULADO');
    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('still goes to home when registering fails', async () => {
    open();
    store.register.and.rejectWith(new Error('offline'));
    click('Pular');
    await flush();

    expect(navigate).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('review mode: registers nothing and returns to settings', async () => {
    routeData['review'] = true;
    open();
    click('Pular');
    await flush();

    expect(store.register).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/settings', { replaceUrl: true });
  });
});
