import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { I18nService } from '../../shared/services/i18n.service';
import { DailyPatientsSource, DailyPatientsSummary } from './daily-patients';
import { HomeComponent, HomeLoadState } from './home.component';
import { HomeData, HomeDataSource } from './home-data-source';
import { HomeStateService } from './home-state.service';
import { HospitalContextService } from './hospital-context.service';
import { LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';
import { LocalProfessionalProfileReader } from './local-professional-profile-reader';
import { ProfessionalProfileReader } from './professional-profile';

const HOSPITALS: LinkedHospital[] = [
  { id: 'a', name: 'Hospital A' },
  { id: 'b', name: 'Hospital B' },
];

import { UnreadNotificationsReader } from './unread-notifications-reader';

class FakePatients extends DailyPatientsSource {
  calls: { hospitalId: string; day: Date }[] = [];

  loadForDay(hospitalId: string, day: Date): Promise<DailyPatientsSummary> {
    this.calls.push({ day, hospitalId });

    return Promise.resolve({ averageCaloricPercentage: 80, averageProteinPercentage: 70, patientCount: 10 });
  }
}

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let patients: FakePatients;
  let navigate: jasmine.Spy;

  async function setup(
    hospitals: readonly LinkedHospital[],
    unread = 0,
    source?: Pick<HomeDataSource, 'load'>,
  ): Promise<void> {
    patients = new FakePatients();
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: DailyPatientsSource, useValue: patients },
        ...(source ? [{ provide: HomeDataSource, useValue: source }] : []),
        { provide: ProfessionalProfileReader, useClass: LocalProfessionalProfileReader },
        { provide: LinkedHospitalsReader, useValue: { read: (): readonly LinkedHospital[] => hospitals } },
        {
          provide: UnreadNotificationsReader,
          useValue: { countUnread: (): Promise<number> => Promise.resolve(unread) },
        },
      ],
    }).compileComponents();

    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    if (!source) {
      TestBed.inject(HomeStateService).setStatus('success');
    }
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const combobox = (): HTMLElement => el().querySelector('[role="combobox"]') as HTMLElement;
  const options = (): HTMLElement[] => Array.from(el().querySelectorAll('[role="option"]'));

  // Acessibilidade (Princípio X): a rota precisa de um marco de navegação e de um
  // título de nível 1 para leitor de tela ancorar a página.
  it('renders a single <main> landmark with a level-1 heading', async () => {
    await setup([HOSPITALS[0]]);

    expect(el().querySelectorAll('main').length).toBe(1);
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('main.home h1')?.textContent?.trim()).toBe('Conductia');
  });

  (['loading', 'success', 'error'] as HomeLoadState[]).forEach(state => {
    it(`keeps the same header element visible in the ${state} state`, async () => {
      await setup([HOSPITALS[0]]);
      const before = fixture.nativeElement.querySelector('.home-header');

      fixture.componentInstance.loadState.set(state);
      fixture.detectChanges();
      const after = fixture.nativeElement.querySelector('.home-header');

      expect(after).toBeTruthy();
      expect(after).toBe(before);
      expect(after.textContent).toContain('Michelle Franklin');
    });
  });

  it('does not mount the bottom nav bar itself (the shell owns it)', async () => {
    await setup([HOSPITALS[0]]);

    expect(fixture.nativeElement.querySelector('app-bottom-nav-bar')).toBeNull();
  });

  describe('single hospital', () => {
    beforeEach(() => setup([HOSPITALS[0]]));

    it('shows the hospital name in an accessibly named selector', () => {
      expect(combobox().textContent?.trim()).toBe('Hospital A');
      expect(combobox().getAttribute('aria-label')).toBe('Hospital');
    });

    it('does not open an option list', () => {
      combobox().click();
      fixture.detectChanges();

      expect(options().length).toBe(0);
    });
  });

  describe('multiple hospitals', () => {
    beforeEach(() => setup(HOSPITALS));

    it('lists linked hospitals and marks the current one', () => {
      combobox().click();
      fixture.detectChanges();

      expect(options().map(o => o.textContent?.trim())).toEqual(['Hospital A', 'Hospital B']);
      expect(options().map(o => o.getAttribute('aria-selected'))).toEqual(['true', 'false']);
      expect(combobox().getAttribute('aria-expanded')).toBe('true');
    });

    it('switches the context when choosing another hospital', () => {
      combobox().click();
      fixture.detectChanges();
      options()[1].click();
      fixture.detectChanges();

      expect(combobox().textContent?.trim()).toBe('Hospital B');
      expect(TestBed.inject(HospitalContextService).selected()?.id).toBe('b');
      expect(options().length).toBe(0);
    });

    it('closes without changing when choosing the current hospital', () => {
      combobox().click();
      fixture.detectChanges();
      options()[0].click();
      fixture.detectChanges();

      expect(TestBed.inject(HospitalContextService).selected()?.id).toBe('a');
      expect(options().length).toBe(0);
    });

    it('supports keyboard: arrows move focus, Enter selects, Escape closes', () => {
      combobox().click();
      fixture.detectChanges();
      options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

      expect(document.activeElement).toBe(options()[1]);

      options()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(options().length).toBe(0);

      combobox().click();
      fixture.detectChanges();
      options()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(combobox().textContent?.trim()).toBe('Hospital B');
    });

    it('toggles the list closed on a second trigger', () => {
      combobox().click();
      fixture.detectChanges();
      combobox().click();
      fixture.detectChanges();

      expect(options().length).toBe(0);
    });
  });

  describe('notification bell', () => {
    const bell = (): HTMLButtonElement => el().querySelector('.home__bell button') as HTMLButtonElement;

    it('shows 5 unread notifications on the bell', async () => {
      await setup([HOSPITALS[0]], 5);

      expect(el().querySelector('app-badge')?.textContent?.trim()).toBe('5');
      expect(bell().getAttribute('aria-label')).toBe('Notificações, 5 não lidas');
    });

    it('shows no badge when there are no unread notifications', async () => {
      await setup([HOSPITALS[0]], 0);

      expect(el().querySelector('app-badge')).toBeNull();
      expect(bell().getAttribute('aria-label')).toBe('Notificações');
    });

    it('caps the badge above 999', async () => {
      await setup([HOSPITALS[0]], 1500);

      expect(el().querySelector('app-badge')?.textContent?.trim()).toBe('+999');
    });

    it('navigates to notifications when the bell is tapped', async () => {
      await setup([HOSPITALS[0]], 5);
      bell().click();

      expect(navigate).toHaveBeenCalledWith('/notificacoes');
    });
  });

  describe('initial loading', () => {
    beforeEach(() => setup([HOSPITALS[0]]));

    it('shows the skeleton in place of the selector while loading, keeping the header', () => {
      TestBed.inject(HomeStateService).setStatus('loading');
      fixture.detectChanges();

      expect(el().querySelector('app-home-skeleton')).toBeTruthy();
      expect(el().querySelector('.home__hospital')).toBeNull();
      expect(el().querySelector('.home-header')).toBeTruthy();
    });

    it('removes the skeleton on success and on failure', () => {
      (['success', 'error'] as const).forEach(status => {
        TestBed.inject(HomeStateService).setStatus(status);
        fixture.detectChanges();

        expect(el().querySelector('app-home-skeleton')).toBeNull();
      });
    });
  });

  describe('load failure', () => {
    let results: (HomeData | Error)[];
    let calls: number;
    let pending: ((d: HomeData) => void)[];
    const fake: Pick<HomeDataSource, 'load'> = {
      load: (): Promise<HomeData> => {
        calls++;
        const next = results.shift();

        if (next === undefined) {
          return new Promise(resolve => pending.push(resolve));
        }

        return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
      },
    };
    const t = (key: string): string => TestBed.inject(I18nService).t(key);
    const alert = (): Element | null => el().querySelector('[role="alert"]');
    const retry = (): HTMLButtonElement | null => el().querySelector('app-button button');
    const settle = async (): Promise<void> => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const open = async (...r: (HomeData | Error)[]): Promise<void> => {
      results = r;
      await setup([HOSPITALS[0]], 0, fake);
    };

    beforeEach(() => {
      calls = 0;
      pending = [];
    });

    it('shows the generic error with the header visible when loading fails without cache', async () => {
      await open(new Error('offline'));

      expect(el().querySelector('.home-header')).toBeTruthy();
      expect(alert()?.querySelector('h2')?.textContent).toContain(t('home.error.title'));
      expect(alert()?.querySelector('ph-icon')).toBeTruthy();
      expect(retry()?.textContent).toContain(t('home.error.retry'));
    });

    it('replaces the error with normal content when retry succeeds', async () => {
      await open(new Error('offline'), {});
      retry()?.click();
      await settle();

      expect(alert()).toBeNull();
      expect(calls).toBe(2);
    });

    it('keeps the error and allows another retry when retry fails', async () => {
      await open(new Error('a'), new Error('b'));
      retry()?.click();
      await settle();

      expect(alert()).toBeTruthy();
      expect(retry()?.disabled).toBeFalse();
    });

    it('ignores repeated retries while one is in flight', async () => {
      await open(new Error('a'));
      retry()?.click();
      fixture.detectChanges();
      await fixture.componentInstance.refresh();

      expect(calls).toBe(2);
      expect(retry()?.disabled).toBeTrue();
      pending[0]({});
      await settle();

      expect(alert()).toBeNull();
    });

    it('keeps last valid data with a stale notice when a refresh fails with cache', async () => {
      await open({}, new Error('offline'));
      await fixture.componentInstance.refresh();
      fixture.detectChanges();

      expect(alert()).toBeNull();
      expect(el().querySelector('.home__stale')?.textContent).toContain(t('home.stale'));
      expect(fixture.componentInstance.controlsEnabled()).toBeFalse();
    });

    it('recovers from the stale state after a successful refresh', async () => {
      await open({}, new Error('offline'), {});
      await fixture.componentInstance.refresh();
      await fixture.componentInstance.refresh();
      fixture.detectChanges();

      expect(el().querySelector('.home__stale')).toBeNull();
      expect(fixture.componentInstance.controlsEnabled()).toBeTrue();
    });

    it('opens normally with the default data source', async () => {
      await setup([HOSPITALS[0]]);
      await settle();

      expect(alert()).toBeNull();
      expect(combobox()).toBeTruthy();
    });
  });

  describe('daily patients card', () => {
    const grid = (): HTMLElement[] => Array.from(el().querySelectorAll('.home__grid > li'));
    const settled = async (): Promise<void> => {
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('shows "10 Pacientes" in the first card for the hospital in context and the current day', async () => {
      await setup([HOSPITALS[0]]);
      await settled();

      expect(grid()[0].textContent).toContain('10 Pacientes');
      expect(patients.calls.length).toBe(1);
      expect(patients.calls[0].hospitalId).toBe('a');
      expect(patients.calls[0].day.toDateString()).toBe(new Date().toDateString());
    });

    it('keeps the count card first when many other items exist', async () => {
      await setup([HOSPITALS[0]]);
      fixture.componentRef.setInput(
        'items',
        Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, text: `Notificação ${i}` })),
      );
      fixture.detectChanges();
      await settled();

      expect(grid().length).toBe(6);
      expect(grid()[0].querySelector('app-card-patients')).toBeTruthy();
      expect(grid()[1].textContent).toContain('Notificação 0');
    });

    it('reloads the count when the hospital in context changes', async () => {
      await setup(HOSPITALS);
      await settled();
      TestBed.inject(HospitalContextService).select('b');
      fixture.detectChanges();
      await settled();

      expect(patients.calls.map(c => c.hospitalId)).toEqual(['a', 'b']);
    });

    it('does not render the count card nor query the source without a hospital in context', async () => {
      await setup([]);
      await settled();

      expect(el().querySelector('app-card-patients')).toBeNull();
      expect(patients.calls.length).toBe(0);
    });

    it('does nothing when the arrow button is clicked', async () => {
      await setup([HOSPITALS[0]]);
      await settled();
      const button = el().querySelector('app-card-patients button') as HTMLElement;

      expect(() => button.click()).not.toThrow();
      expect(el().querySelector('app-card-patients')).toBeTruthy();
    });
  });
});
