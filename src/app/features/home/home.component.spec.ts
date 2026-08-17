import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { HomeComponent } from './home.component';
import { HomeActions } from './state/home.actions';
import { HomeState, initialHomeState } from './state/home.reducer';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let store: MockStore;

  async function configureStore(overrides: Partial<HomeState> = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideMockStore({ initialState: { home: { ...initialHomeState, ...overrides } } })],
    }).compileComponents();
    store = TestBed.inject(MockStore);
  }

  function createComponent(): void {
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  }

  it('despacha pageOpened na inicialização (US1)', async () => {
    await configureStore();
    spyOn(store, 'dispatch');
    createComponent();

    expect(store.dispatch).toHaveBeenCalledWith(HomeActions.pageOpened());
  });

  it('exibe o skeleton enquanto status é loading-initial (FR-018)', async () => {
    await configureStore({ status: 'loading-initial' });
    createComponent();

    expect(fixture.nativeElement.querySelector('app-home-skeleton')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-home-error')).toBeFalsy();
  });

  it('exibe a mensagem de erro genérica quando status é error (FR-013)', async () => {
    await configureStore({ status: 'error', errorMessage: 'Verifique sua conexão...' });
    createComponent();

    expect(fixture.nativeElement.querySelector('app-home-error')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-home-skeleton')).toBeFalsy();
  });

  it('despacha retryRequested ao clicar em "Tentar novamente" (FR-014)', async () => {
    await configureStore({ status: 'error' });
    createComponent();
    spyOn(store, 'dispatch');

    const retryButton: HTMLButtonElement = fixture.nativeElement.querySelector('.home-error__retry');

    retryButton.click();

    expect(store.dispatch).toHaveBeenCalledWith(HomeActions.retryRequested());
  });

  it('exibe o banner de dados desatualizados quando stale (Comportamento Offline)', async () => {
    await configureStore({ status: 'success', stale: true });
    createComponent();

    expect(fixture.nativeElement.querySelector('.home__stale-banner')).toBeTruthy();
  });

  it('exibe a tag com o nome do hospital selecionado (FR-009)', async () => {
    await configureStore({
      status: 'success',
      hospitals: [
        { id: 1, name: 'Hospital Vila Nova Star' },
        { id: 2, name: 'Hospital Central' },
      ],
      selectedHospitalId: 2,
    });
    createComponent();

    const tag = fixture.nativeElement.querySelector('app-tag');

    expect(tag.textContent).toContain('Hospital Central');
  });

  it('exibe o resumo e as notificações quando status é success (FR-008/FR-005)', async () => {
    await configureStore({
      status: 'success',
      summary: {
        patientCount: 5,
        nutritionalGoalIndicator: {
          caloricPercentage: 80,
          caloricStatus: 'NORMAL',
          proteinPercentage: 70,
          proteinStatus: 'NORMAL',
        },
        unreadNotificationCount: 2,
      },
      ids: [1],
      entities: {
        1: {
          id: 1,
          author: { id: 1, name: 'Filippa Martins', specialty: 'Nutricionista', photoUrl: null },
          description: 'Descrição',
          createdAt: new Date().toISOString(),
          read: false,
        },
      },
    });
    createComponent();

    expect(fixture.nativeElement.querySelector('app-card-patients')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-card-notify')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.home__notify-badge').textContent).toContain('2');
  });

  it('não exibe o badge de não lidas quando a contagem é zero', async () => {
    await configureStore({
      status: 'success',
      summary: {
        patientCount: 5,
        nutritionalGoalIndicator: {
          caloricPercentage: 80,
          caloricStatus: 'NORMAL',
          proteinPercentage: 70,
          proteinStatus: 'NORMAL',
        },
        unreadNotificationCount: 0,
      },
    });
    createComponent();

    expect(fixture.nativeElement.querySelector('.home__notify-badge')).toBeFalsy();
  });

  it('exibe a mensagem de carregando mais quando status é loading-more (FR-004)', async () => {
    await configureStore({ status: 'loading-more' });
    createComponent();

    expect(fixture.nativeElement.querySelector('.home__loading-more')).toBeTruthy();
  });

  it('onViewNotificationDetail, onViewAllNotifications e onViewPatients não lançam erro (rotas fora de escopo)', async () => {
    await configureStore({ status: 'success' });
    createComponent();

    expect(() => fixture.componentInstance.onViewNotificationDetail(1)).not.toThrow();
    expect(() => fixture.componentInstance.onViewAllNotifications()).not.toThrow();
    expect(() => fixture.componentInstance.onViewPatients()).not.toThrow();
  });

  it('abre o assistente de IA ao clicar no botão de atalhos do cabeçalho (desktop)', async () => {
    await configureStore({ status: 'success' });
    createComponent();

    const shortcutsButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.home__shortcuts-wrapper button[aria-label="Ações da tela"]',
    );

    shortcutsButton.click();

    expect(fixture.componentInstance.aiAssistant.isOpen()).toBeTrue();
  });

  it('formatTime formata um ISO date como HH:mm', async () => {
    await configureStore();
    createComponent();

    const formatted = fixture.componentInstance.formatTime('2026-07-30T19:27:00.000Z');

    expect(formatted).toMatch(/^\d{2}:\d{2}$/);
  });

  describe('sentinel de scroll (FR-004)', () => {
    let originalIntersectionObserver: typeof IntersectionObserver;
    let observeSpy: jasmine.Spy;
    let disconnectSpy: jasmine.Spy;
    let intersectionCallback: ((entries: Partial<IntersectionObserverEntry>[]) => void) | undefined;

    beforeEach(() => {
      originalIntersectionObserver = window.IntersectionObserver;
      observeSpy = jasmine.createSpy('observeSpy');
      disconnectSpy = jasmine.createSpy('disconnectSpy');
      intersectionCallback = undefined;

      class FakeIntersectionObserver {
        observe = observeSpy;
        disconnect = disconnectSpy;

        constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          intersectionCallback = callback;
        }
      }
      window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
      window.IntersectionObserver = originalIntersectionObserver;
    });

    it('despacha loadNextBatch quando o sentinel fica visível e há próxima página', async () => {
      await configureStore({ status: 'success', nextCursor: 'cursor-1' });
      createComponent();
      fixture.detectChanges();
      spyOn(store, 'dispatch');

      expect(observeSpy).toHaveBeenCalledWith(jasmine.any(HTMLElement));
      intersectionCallback?.([{ isIntersecting: true }]);

      expect(store.dispatch).toHaveBeenCalledWith(HomeActions.loadNextBatch());
    });

    it('não despacha loadNextBatch quando não há próxima página', async () => {
      await configureStore({ status: 'success', nextCursor: null });
      createComponent();
      fixture.detectChanges();
      spyOn(store, 'dispatch');

      intersectionCallback?.([{ isIntersecting: true }]);

      expect(store.dispatch).not.toHaveBeenCalledWith(HomeActions.loadNextBatch());
    });

    it('desconecta o IntersectionObserver ao destruir o componente', async () => {
      await configureStore({ status: 'success', nextCursor: 'cursor-1' });
      createComponent();
      fixture.detectChanges();

      fixture.destroy();

      expect(disconnectSpy).toHaveBeenCalledWith();
    });
  });
});
