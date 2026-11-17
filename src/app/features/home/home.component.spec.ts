import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { DailyPatientsSource, DailyPatientsSummary } from './daily-patients';
import { HomeComponent } from './home.component';
import { HomeData, HomeDataSource } from './home-data-source';
import { HomeStateService } from './home-state.service';
import { HospitalContextService } from './hospital-context.service';
import { LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';
import { LocalProfessionalProfileReader } from './local-professional-profile-reader';
import { ProfessionalProfileReader } from './professional-profile';
import { UnreadNotificationsReader } from './unread-notifications-reader';

const HOSPITALS: LinkedHospital[] = [
  { id: 'a', name: 'Hospital A' },
  { id: 'b', name: 'Hospital B' },
];

class FakePatients extends DailyPatientsSource {
  calls: { hospitalId: string; day: Date }[] = [];
  summary: DailyPatientsSummary = { averageCaloricPercentage: 80, averageProteinPercentage: 70, patientCount: 10 };
  counts: Record<string, number> = {};

  loadForDay(hospitalId: string, day: Date): Promise<DailyPatientsSummary> {
    this.calls.push({ day, hospitalId });

    return Promise.resolve({
      ...this.summary,
      patientCount: this.counts[hospitalId] ?? this.summary.patientCount,
    });
  }
}

interface SetupOptions {
  hospitals?: readonly LinkedHospital[];
  unread?: number;
  source?: Pick<HomeDataSource, 'load'>;
  summary?: DailyPatientsSummary;
  counts?: Record<string, number>;
}

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let patients: FakePatients;
  let navigate: jasmine.Spy;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setup(options: SetupOptions = {}): Promise<void> {
    const { hospitals = [HOSPITALS[0]], unread = 0, source, summary, counts = {} } = options;

    patients = new FakePatients();
    if (summary) {
      patients.summary = summary;
    }
    patients.counts = counts;

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

    const router = TestBed.inject(Router);

    spyOn(router, 'navigate').and.resolveTo(true);
    navigate = router.navigate as jasmine.Spy;
    if (!source) {
      TestBed.inject(HomeStateService).setStatus('success');
    }
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await settle();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends Element = HTMLElement>(selector: string): T | null => el().querySelector<T>(selector);
  const bell = (): HTMLButtonElement => q<HTMLButtonElement>('.home__notify-wrapper button') as HTMLButtonElement;
  const trigger = (): HTMLButtonElement | null => q<HTMLButtonElement>('.home__hospital-trigger');
  const options = (): HTMLElement[] => Array.from(el().querySelectorAll('[role="option"]'));
  const grid = (): HTMLElement[] => Array.from(el().querySelectorAll('.home__grid > *'));

  describe('layout', () => {
    beforeEach(() => setup());

    // Acessibilidade (Princípio X): marco de navegação e um único título de nível 1.
    it('renders a single <main> landmark with the professional as level-1 heading', () => {
      expect(el().querySelectorAll('h1').length).toBe(1);
      expect(q('h1')?.textContent?.trim()).toBe('Michelle Franklin');
    });

    it('shows the header with title, avatar and the day headline', () => {
      expect(q('.home__header-title')?.textContent?.trim()).toBe('Dra.');
      expect(q('.home__header app-avatar')).toBeTruthy();
      expect(q('.home__headline')?.textContent?.trim()).toBe('Tarefas diárias do hospital');
      expect(q('.home__date')?.textContent?.trim()).toMatch(/ - \d+ de /);
    });

    it('does not mount the bottom nav bar itself (the shell owns it)', () => {
      expect(q('app-bottom-nav-bar')).toBeNull();
    });

    it('opens the AI assistant from the desktop shortcuts button', () => {
      const component = fixture.componentInstance;

      spyOn(component.aiAssistant, 'openPanel');

      (q('.home__shortcuts-wrapper button') as HTMLButtonElement).click();

      expect(component.aiAssistant.openPanel).toHaveBeenCalledWith();
    });
  });

  describe('notification bell', () => {
    it('shows 5 unread notifications on the bell', async () => {
      await setup({ unread: 5 });

      expect(q('app-badge')?.textContent?.trim()).toBe('5');
      expect(bell().getAttribute('aria-label')).toBe('Notificações, 5 não lidas');
    });

    it('shows no badge when there are no unread notifications', async () => {
      await setup({ unread: 0 });

      expect(q('app-badge')).toBeNull();
      expect(bell().getAttribute('aria-label')).toBe('Notificações');
    });

    it('caps the badge above 999', async () => {
      await setup({ unread: 1500 });

      expect(q('app-badge')?.textContent?.trim()).toBe('+999');
    });

    it('navigates to the notifications screen when the bell is tapped', async () => {
      await setup({ unread: 5 });
      bell().click();

      expect(navigate).toHaveBeenCalledWith(['/notifications'], { queryParams: {} });
    });

    it('passes the hospital in context when its id is numeric', async () => {
      await setup({ hospitals: [{ id: '42', name: 'Hospital 42' }] });
      bell().click();

      expect(navigate).toHaveBeenCalledWith(['/notifications'], { queryParams: { hospitalId: '42' } });
    });
  });

  describe('single hospital', () => {
    beforeEach(() => setup());

    it('shows the hospital as a tag, without an option list', () => {
      expect(q('.home__local app-tag')?.textContent).toContain('Hospital A');
      expect(trigger()).toBeNull();
      expect(options().length).toBe(0);
    });
  });

  describe('multiple hospitals', () => {
    beforeEach(() => setup({ hospitals: HOSPITALS }));

    it('lists linked hospitals and marks the current one', () => {
      trigger()?.click();
      fixture.detectChanges();

      expect(options().map(o => o.textContent?.trim())).toEqual(['Hospital A', 'Hospital B']);
      expect(options().map(o => o.getAttribute('aria-selected'))).toEqual(['true', 'false']);
      expect(trigger()?.getAttribute('aria-expanded')).toBe('true');
    });

    it('switches the context when choosing another hospital', () => {
      trigger()?.click();
      fixture.detectChanges();
      options()[1].click();
      fixture.detectChanges();

      expect(q('.home__local app-tag')?.textContent).toContain('Hospital B');
      expect(TestBed.inject(HospitalContextService).selected()?.id).toBe('b');
      expect(options().length).toBe(0);
    });

    it('closes without changing when choosing the current hospital', () => {
      trigger()?.click();
      fixture.detectChanges();
      options()[0].click();
      fixture.detectChanges();

      expect(TestBed.inject(HospitalContextService).selected()?.id).toBe('a');
      expect(options().length).toBe(0);
    });

    it('supports keyboard: arrows move focus, Enter selects, Escape closes', () => {
      trigger()?.click();
      fixture.detectChanges();
      options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

      expect(document.activeElement).toBe(options()[1]);

      options()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(options().length).toBe(0);

      trigger()?.click();
      fixture.detectChanges();
      options()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(q('.home__local app-tag')?.textContent).toContain('Hospital B');
    });

    it('toggles the list closed on a second trigger', () => {
      trigger()?.click();
      fixture.detectChanges();
      trigger()?.click();
      fixture.detectChanges();

      expect(options().length).toBe(0);
    });

    it('reloads the count when the hospital in context changes', async () => {
      TestBed.inject(HospitalContextService).select('b');
      fixture.detectChanges();
      await settle();

      expect(patients.calls.map(c => c.hospitalId)).toEqual(['a', 'b']);
    });
  });

  describe('daily patients card', () => {
    it('shows "10 Pacientes" in the first card for the hospital in context and the current day', async () => {
      await setup();

      expect(grid()[0].tagName.toLowerCase()).toBe('app-card-patients');
      expect(grid()[0].textContent).toContain('10 Pacientes');
      expect(patients.calls.length).toBe(1);
      expect(patients.calls[0].hospitalId).toBe('a');
      expect(patients.calls[0].day.toDateString()).toBe(new Date().toDateString());
    });

    it('replaces the number with "Todos os pacientes foram atendidos" when the count is zero', async () => {
      await setup({ counts: { a: 0 } });

      expect(grid()[0].textContent).toContain('Todos os pacientes foram atendidos');
      expect(grid()[0].textContent).not.toContain(' Pacientes');
    });

    it('switches between number and message when changing to a hospital with a different count', async () => {
      await setup({ counts: { b: 0 }, hospitals: HOSPITALS });

      expect(grid()[0].textContent).toContain('10 Pacientes');

      TestBed.inject(HospitalContextService).select('b');
      fixture.detectChanges();
      await settle();

      expect(grid()[0].textContent).toContain('Todos os pacientes foram atendidos');
    });

    it('shows the average caloric and protein intake of the day (scenario 1)', async () => {
      await setup();
      const graph = grid()[0].querySelector('app-graph-meta svg') as SVGElement;

      expect(graph.getAttribute('aria-label')).toBe('Aporte calórico 80%, aporte protéico 70%');
    });

    it('renders the protein indicator red when the average is 15% of the goal (scenario 2)', async () => {
      await setup({ summary: { averageCaloricPercentage: 80, averageProteinPercentage: 15, patientCount: 10 } });
      const arcs = grid()[0].querySelectorAll('app-graph-meta circle.progress');

      expect(arcs[1].getAttribute('stroke')).toBe('var(--color-comm-alert)');
      expect(arcs[0].getAttribute('stroke')).toBe('var(--color-comm-success)');
    });

    it('keeps the arrow reserved and inert: clicking it or the card changes nothing', async () => {
      await setup();
      const before = el().innerHTML;
      const callsBefore = patients.calls.length;

      (q('app-card-patients button') as HTMLButtonElement).click();
      fixture.detectChanges();
      await settle();

      expect(navigate).not.toHaveBeenCalled();
      expect(patients.calls.length).toBe(callsBefore);
      expect(el().innerHTML).toBe(before);
    });

    it('lists notifications after the count card in the grid', async () => {
      await setup();
      fixture.componentInstance.notifications.set(
        Array.from({ length: 3 }, (_, i) => ({
          author: { id: i, name: `Autor ${i}`, photoUrl: null, specialty: 'Nutrição' },
          createdAt: '2026-11-17T10:30:00',
          description: `Notificação ${i}`,
          id: i,
          read: false,
        })),
      );
      fixture.detectChanges();

      expect(grid().length).toBe(4);
      expect(grid()[0].tagName.toLowerCase()).toBe('app-card-patients');
      expect(grid()[1].tagName.toLowerCase()).toBe('app-card-notify');
      expect(grid()[1].textContent).toContain('Notificação 0');
      expect(fixture.componentInstance.formatTime('2026-11-17T10:30:00')).toBe('10:30');
    });

    it('shows author data, initials avatar, 2-line clamps and the bell icon on the card (US-003-3-03)', async () => {
      await setup();
      fixture.componentInstance.notifications.set([
        {
          author: { id: 1, name: 'Jairo Nepomuceno', photoUrl: null, specialty: 'Farmacêutico' },
          createdAt: '2026-11-17T10:30:00',
          description: 'Resumo da notificação '.repeat(30),
          id: 1,
          read: false,
        },
        {
          author: { id: 2, name: 'Madonna', photoUrl: null, specialty: 'Nutricionista' },
          createdAt: '2026-11-17T10:30:00',
          description: 'Outro',
          id: 2,
          read: false,
        },
        {
          author: { id: 3, name: 'Ana Souza', photoUrl: 'https://x/y.png', specialty: 'Médica' },
          createdAt: '2026-11-17T10:30:00',
          description: 'Outro',
          id: 3,
          read: false,
        },
      ]);
      fixture.detectChanges();
      const cards = Array.from(el().querySelectorAll('app-card-notify')) as HTMLElement[];
      const text = (c: HTMLElement, sel: string): string => c.querySelector(sel)?.textContent?.trim() ?? '';

      expect(text(cards[0], '.card-notify__name')).toBe('Jairo Nepomuceno');
      expect(text(cards[0], '.card-notify__specialty')).toBe('Farmacêutico');
      expect(text(cards[0], '.avatar__initials')).toBe('JN');
      expect(text(cards[1], '.avatar__initials')).toBe('M');
      expect(cards[2].querySelector('.avatar__initials')).toBeNull();
      expect(cards[2].querySelector('img')).not.toBeNull();
      const desc = getComputedStyle(cards[0].querySelector('.card-notify__description') as Element);
      const nameStyle = getComputedStyle(cards[0].querySelector('.card-notify__name') as Element);

      expect(desc.getPropertyValue('-webkit-line-clamp')).toBe('2');
      expect(desc.overflow).toBe('hidden');
      expect(nameStyle.getPropertyValue('-webkit-line-clamp')).toBe('2');
      expect(cards[0].querySelector('.card-notify__time ph-icon')).not.toBeNull();
    });

    it('ignores the card callbacks (no navigation yet)', async () => {
      await setup();
      const component = fixture.componentInstance;

      expect(() => {
        component.onViewPatients();
        component.onViewNotificationDetail(1);
      }).not.toThrow();
    });
  });

  describe('load states', () => {
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
    const errorBlock = (): Element | null => q('app-home-error');
    const retry = (): HTMLButtonElement | null => q<HTMLButtonElement>('app-home-error app-button button');
    const open = async (...r: (HomeData | Error)[]): Promise<void> => {
      results = r;
      await setup({ source: fake });
    };

    beforeEach(() => {
      calls = 0;
      pending = [];
    });

    it('shows the skeleton in place of the hospital and the cards while loading, keeping the header', async () => {
      await open();

      expect(q('app-home-skeleton')).toBeTruthy();
      expect(q('.home__local')).toBeNull();
      expect(q('.home__header')).toBeTruthy();
    });

    it('removes the skeleton once loaded', async () => {
      await open({});

      expect(q('app-home-skeleton')).toBeNull();
      expect(q('.home__local')).toBeTruthy();
    });

    it('shows the generic error with the header visible when loading fails without cache', async () => {
      await open(new Error('offline'));

      expect(q('.home__header')).toBeTruthy();
      expect(errorBlock()).toBeTruthy();
      expect(q('app-home-skeleton')).toBeNull();
      expect(retry()?.textContent).toContain('Tentar novamente');
    });

    it('replaces the error with normal content when retry succeeds', async () => {
      await open(new Error('offline'), {});
      retry()?.click();
      await settle();

      expect(errorBlock()).toBeNull();
      expect(q('.home__local')).toBeTruthy();
      expect(calls).toBe(2);
    });

    it('keeps the error and allows another retry when retry fails', async () => {
      await open(new Error('a'), new Error('b'));
      retry()?.click();
      await settle();

      expect(errorBlock()).toBeTruthy();
    });

    it('ignores repeated retries while one is in flight', async () => {
      await open(new Error('a'));
      retry()?.click();
      fixture.detectChanges();
      await fixture.componentInstance.refresh();

      expect(calls).toBe(2);
      pending[0]({});
      await settle();

      expect(errorBlock()).toBeNull();
    });

    it('keeps last valid data with a stale notice when a refresh fails with cache', async () => {
      await open({}, new Error('offline'));
      await fixture.componentInstance.refresh();
      fixture.detectChanges();

      expect(errorBlock()).toBeNull();
      expect(q('.home__stale-banner')?.textContent).toContain('desatualizados');
      expect(fixture.componentInstance.controlsEnabled()).toBeFalse();
    });

    it('blocks switching hospital while the data is stale and recovers after a refresh', async () => {
      results = [{}, new Error('offline'), {}];
      await setup({ hospitals: HOSPITALS, source: fake });

      expect(trigger()).toBeTruthy();

      await fixture.componentInstance.refresh();
      fixture.detectChanges();

      expect(trigger()).toBeNull();

      await fixture.componentInstance.refresh();
      fixture.detectChanges();

      expect(q('.home__stale-banner')).toBeNull();
      expect(trigger()).toBeTruthy();
    });

    it('opens normally with the default data source', async () => {
      await setup();

      expect(errorBlock()).toBeNull();
      expect(q('.home__local')).toBeTruthy();
    });
  });
});
