import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { GeolocationError, GeolocationService, GeoPoint } from '../../shared/services/geolocation.service';
import { ScreenActionsService } from '../../shared/services/screen-actions.service';
import { ManagerAccessReader } from '../hospital-team/hospital-invite-port';
import { LocationChangePort, LocationExtractor } from '../patient-hub/change-location/location-change.port';
import { BedMovementPort, BedOccupancyPort } from '../patient-hub/move-bed/bed-movement.port';
import { BedNumberExtractor } from '../patient-hub/move-bed/bed-number-extractor';
import { HospitalSiteSource } from '../shift/hospital-site-source';
import { ProvisionalHospitalSiteSource } from '../shift/provisional-hospital-site-source';
import { ProvisionalShiftSource } from '../shift/provisional-shift-source';
import { ShiftService } from '../shift/shift.service';
import { ShiftSource } from '../shift/shift-source';
import { DailyPatientsSource, DailyPatientsSummary } from './daily-patients';
import { HomeComponent } from './home.component';
import { HomeNotification, NotificationPage } from './home.models';
import { HomeData, HomeDataSource } from './home-data-source';
import { HomeNotificationsSource } from './home-notifications-source';
import { HomeStateService } from './home-state.service';
import { HospitalContextService } from './hospital-context.service';
import { LinkRevocationChecker } from './link-revocation-checker';
import { LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';
import { LocalProfessionalProfileReader } from './local-professional-profile-reader';
import { ProfessionalProfileReader } from './professional-profile';
import { UnreadNotificationsReader } from './unread-notifications-reader';

const HOSPITALS: LinkedHospital[] = [
  { id: 1, name: 'Hospital A' },
  { id: 2, name: 'Hospital B' },
];

class FakePatients extends DailyPatientsSource {
  calls: { hospitalId: number; day: Date }[] = [];
  summary: DailyPatientsSummary = { averageCaloricPercentage: 80, averageProteinPercentage: 70, patientCount: 10 };
  counts: Record<number, number> = {};

  loadForDay(hospitalId: number, day: Date): Promise<DailyPatientsSummary> {
    this.calls.push({ day, hospitalId });

    return Promise.resolve({
      ...this.summary,
      patientCount: this.counts[hospitalId] ?? this.summary.patientCount,
    });
  }
}

/** Feed fake com `total` notificações; cursor = índice do próximo item. */
class FakeNotifications extends HomeNotificationsSource {
  calls: { hospitalId: number; cursor: string | null; limit: number }[] = [];
  total = 35;
  fail = false;
  failFirst = false;
  custom: readonly HomeNotification[] | null = null;
  gate: Promise<void> | null = null;

  loadPage(hospitalId: number, cursor: string | null, limit: number): Promise<NotificationPage> {
    this.calls.push({ cursor, hospitalId, limit });
    if (this.failFirst && cursor === null) {
      return Promise.reject(new Error('offline'));
    }
    if (this.custom) {
      return Promise.resolve({ items: [...this.custom], nextCursor: null });
    }
    if (this.fail && cursor !== null) {
      return Promise.reject(new Error('offline'));
    }
    const start = cursor === null ? 0 : Number(cursor);
    const end = Math.min(start + limit, this.total);
    const items: HomeNotification[] = Array.from({ length: end - start }, (_, i) => ({
      author: { id: start + i, name: `Autor ${start + i}`, photoUrl: null, specialty: 'Nutrição' },
      createdAt: new Date(Date.UTC(2026, 10, 17, 12) - (start + i) * 60_000).toISOString(),
      description: `Notificação ${start + i}`,
      id: start + i,
      read: false,
    }));
    const page = { items, nextCursor: end < this.total ? String(end) : null };

    return (this.gate ?? Promise.resolve()).then(() => page);
  }
}

interface SetupOptions {
  feed?: FakeNotifications;
  hospitals?: readonly LinkedHospital[];
  /** Substitui a leitura dos hospitais (ex.: pendente ou com falha). */
  hospitalsRead?: () => Promise<readonly LinkedHospital[]>;
  unread?: number;
  source?: Pick<HomeDataSource, 'load'>;
  summary?: DailyPatientsSummary;
  counts?: Record<number, number>;
  /** Resposta do verificador de vínculo revogado (padrão: revogado). */
  linkRevoked?: boolean;
}

const geo = {
  point: { lat: -23.5505, lng: -46.6333 } as GeoPoint | GeolocationError,
  locate(): Promise<GeoPoint> {
    return this.point instanceof GeolocationError ? Promise.reject(this.point) : Promise.resolve(this.point);
  },
};

const shiftProviders = [
  { provide: GeolocationService, useValue: geo },
  { provide: HospitalSiteSource, useClass: ProvisionalHospitalSiteSource },
  { provide: ShiftSource, useClass: ProvisionalShiftSource },
];

describe('HomeComponent', () => {
  let byNameCalls: unknown[][] = [];

  beforeEach(() => {
    byNameCalls = [];
    localStorage.clear();
    geo.point = { lat: -23.5505, lng: -46.6333 };
  });

  afterEach(() => localStorage.clear());

  let fixture: ComponentFixture<HomeComponent>;
  let patients: FakePatients;
  let navigate: jasmine.Spy;
  let notifications: FakeNotifications;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setup(options: SetupOptions = {}): Promise<void> {
    const {
      hospitals = [HOSPITALS[0]],
      hospitalsRead,
      unread = 0,
      source,
      summary,
      counts = {},
      feed = new FakeNotifications(),
      linkRevoked = true,
    } = options;

    notifications = feed;

    patients = new FakePatients();
    if (summary) {
      patients.summary = summary;
    }
    patients.counts = counts;

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        {
          provide: BedMovementPort,
          useValue: {
            resolveByName: (...args: unknown[]): Promise<never> => (
              byNameCalls.push(args),
              Promise.reject(new Error('x'))
            ),
          },
        },
        { provide: BedNumberExtractor, useValue: {} },
        { provide: LocationChangePort, useValue: {} },
        { provide: LocationExtractor, useValue: { extract: (): null => null } },
        { provide: BedOccupancyPort, useValue: {} },
        ...shiftProviders,
        provideRouter([]),
        { provide: DailyPatientsSource, useValue: patients },
        { provide: HomeNotificationsSource, useValue: feed },
        {
          provide: LinkRevocationChecker,
          useValue: { isRevoked: (): Promise<boolean> => Promise.resolve(linkRevoked) },
        },
        ...(source ? [{ provide: HomeDataSource, useValue: source }] : []),
        { provide: ProfessionalProfileReader, useClass: LocalProfessionalProfileReader },
        {
          provide: LinkedHospitalsReader,
          useValue: { read: hospitalsRead ?? ((): Promise<readonly LinkedHospital[]> => Promise.resolve(hospitals)) },
        },
        {
          provide: UnreadNotificationsReader,
          useValue: { countUnread: (): Promise<number> => Promise.resolve(unread) },
        },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);

    // `setup()` é o helper de cada teste: o espião vale só dentro dele.
    // eslint-disable-next-line jasmine/no-unsafe-spy
    spyOn(router, 'navigate').and.resolveTo(true);
    navigate = router.navigate as jasmine.Spy;
    if (!source) {
      TestBed.inject(HomeStateService).setStatus('success');
    }
    if (!hospitalsRead) {
      await TestBed.inject(HospitalContextService).load();
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

  describe('turno de trabalho (geolocalização)', () => {
    const SITE = { address: '', hospitalId: HOSPITALS[0].id, lat: -23.5505, lng: -46.6333, radiusMeters: 300 };
    const startButton = (): HTMLButtonElement => q<HTMLButtonElement>('.home__shift button') as HTMLButtonElement;
    const click = async (button: HTMLButtonElement): Promise<void> => {
      button.click();
      await settle();
      // Sem zona, o `whenStable` não espera a cadeia de promessas da gravação: cede a vez antes de olhar a tela.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      await settle();
    };

    beforeEach(() => setup());

    it('"Cadastrar hospital" fica no topo, ao lado do sino; "Iniciar turno" (outline, sem ícone) à direita, acima da data', () => {
      const actions = q('.home__header-actions') as HTMLElement;
      const aside = q('.home__local-aside') as HTMLElement;

      expect(actions.querySelector('.home__register-hospital')?.textContent).toContain('Cadastrar hospital');
      expect(actions.firstElementChild).toBe(actions.querySelector('.home__register-hospital'));
      expect(q('.home__hospital-row .home__register-hospital')).toBeNull();
      expect(aside.firstElementChild).toBe(q('.home__shift'));
      expect(aside.lastElementChild?.classList).toContain('home__date');
      expect(q('.home__shift button')?.className).toContain('outlined');
      expect(q('.home__shift ph-icon')).toBeNull();
    });

    it('sem localização cadastrada, não inicia e orienta em texto', async () => {
      await click(startButton());

      expect(q('.home__stale-banner[role="alert"]')?.textContent).toContain('ainda não tem localização cadastrada');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('fora do raio, não inicia e diz a distância', async () => {
      await TestBed.inject(HospitalSiteSource).save({ ...SITE, lat: -23.5505 + 0.0135 });
      await click(startButton());

      expect(q('.home__stale-banner[role="alert"]')?.textContent).toContain('Você está a');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('dentro do raio, inicia o turno, leva à lista de pacientes e o botão vira "Retomar turno de trabalho"', async () => {
      await TestBed.inject(HospitalSiteSource).save(SITE);
      await click(startButton());

      expect(navigate).toHaveBeenCalledWith(['/patients'], { queryParams: { turno: '1' } });
      expect(q('.home__shift')?.textContent).toContain('Retomar turno de trabalho');
      expect(q('[data-testid="shift-member"]')?.textContent).toContain('Michelle Franklin');

      navigate.calls.reset();
      await click(startButton());

      expect(navigate).toHaveBeenCalledOnceWith(['/patients'], { queryParams: { turno: '1' } });
    });

    it('sem permissão de localização, avisa em texto', async () => {
      await TestBed.inject(HospitalSiteSource).save(SITE);
      geo.point = new GeolocationError('denied');
      await click(startButton());

      expect(q('.home__stale-banner[role="alert"]')?.textContent).toContain('Sem acesso à localização');
    });

    it('mostra a equipe em turno: quem já está trabalhando e quantos pacientes escolheu', async () => {
      const shifts = TestBed.inject(ShiftSource);
      const other = await shifts.start({
        hospitalId: HOSPITALS[0].id,
        professionalName: 'Dr. Bruno Lima',
        professionalRole: 'Médico',
        startedAt: new Date().toISOString(),
      });

      await shifts.selectPatients(other.id, ['p1', 'p2']);
      await TestBed.inject(ShiftService).refresh(HOSPITALS[0].id);
      await settle();

      expect(q('.home__team')?.textContent).toContain('Dr. Bruno Lima');
      expect(q('.home__team')?.textContent).toContain('Médico · 2 pacientes');
    });

    it('"Cadastrar hospital" abre o cadastro no painel lateral; ao salvar, limpa o aviso', async () => {
      const assistant = TestBed.inject(AiAssistantService);

      await click(startButton());

      expect(q('.home__stale-banner[role="alert"]')).not.toBeNull();

      await click(q<HTMLButtonElement>('.home__register-hospital button') as HTMLButtonElement);
      const inputs = assistant.activeAction()?.editor?.inputs as { saved: (id: number) => void };

      expect(assistant.activeAction()?.id).toBe('hospital-registration');

      inputs.saved(HOSPITALS[0].id);
      await settle();

      expect(q('.home__stale-banner[role="alert"]')).toBeNull();
    });
  });

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
      expect(q('.home__date')?.textContent?.trim()).toMatch(/, \d+ de /);
    });

    it('does not mount the bottom nav bar itself (the shell owns it)', () => {
      expect(q('app-bottom-nav-bar')).toBeNull();
    });

    it('opens the AI assistant from the desktop shortcuts button', () => {
      const component = fixture.componentInstance;

      spyOn(component.aiAssistant, 'openShortcuts');

      (q('.home__shortcuts-wrapper button') as HTMLButtonElement).click();

      expect(component.aiAssistant.openShortcuts).toHaveBeenCalledWith();
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

    it('navigates to the notifications screen, passing the hospital in context, when the bell is tapped', async () => {
      await setup({ unread: 5 });
      bell().click();

      expect(navigate).toHaveBeenCalledWith(['/notifications'], { queryParams: { hospitalId: 1 } });
    });

    it('passes no hospital when there is none in context', async () => {
      await setup({ hospitals: [] });
      bell().click();

      expect(navigate).toHaveBeenCalledWith(['/notifications'], { queryParams: {} });
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
      expect(TestBed.inject(HospitalContextService).selected()?.id).toBe(2);
      expect(options().length).toBe(0);
    });

    it('closes without changing when choosing the current hospital', () => {
      trigger()?.click();
      fixture.detectChanges();
      options()[0].click();
      fixture.detectChanges();

      expect(TestBed.inject(HospitalContextService).selected()?.id).toBe(1);
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
      TestBed.inject(HospitalContextService).select(2);
      fixture.detectChanges();
      await settle();

      expect(patients.calls.map(c => c.hospitalId)).toEqual([1, 2]);
    });
  });

  describe('daily patients card', () => {
    it('shows "10 pacientes" in the first card for the hospital in context and the current day', async () => {
      await setup();

      expect(grid()[0].tagName.toLowerCase()).toBe('app-card-patients');
      expect(grid()[0].textContent).toContain('10 pacientes');
      expect(patients.calls.length).toBe(1);
      expect(patients.calls[0].hospitalId).toBe(1);
      expect(patients.calls[0].day.toDateString()).toBe(new Date().toDateString());
    });

    it('replaces the number with "Todos os pacientes foram atendidos" when the count is zero', async () => {
      await setup({ counts: { 1: 0 } });

      expect(grid()[0].textContent).toContain('Todos os pacientes foram atendidos');
      expect(grid()[0].textContent).not.toContain(' Pacientes');
    });

    it('switches between number and message when changing to a hospital with a different count', async () => {
      await setup({ counts: { 2: 0 }, hospitals: HOSPITALS });

      expect(grid()[0].textContent).toContain('10 pacientes');

      TestBed.inject(HospitalContextService).select(2);
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

    it('on small screens uses 2 columns with the patients card spanning the full row (Figma v2)', async () => {
      await setup();
      const gridEl = q('.home__grid') as HTMLElement;
      const tracks = getComputedStyle(gridEl).gridTemplateColumns.split(' ');
      const cardWidth = (grid()[0].firstElementChild as HTMLElement).getBoundingClientRect().width;

      expect(tracks.length).toBe(2);
      expect(Math.round(cardWidth)).toBe(Math.round(gridEl.getBoundingClientRect().width));
    });

    it('shows the "Ver detalhes" action enabled on each notification card (Figma v2/CardNotify)', async () => {
      await setup();
      fixture.componentInstance.notifications.set([
        {
          author: { id: 1, name: 'Autor 1', photoUrl: null, specialty: 'Nutrição' },
          createdAt: '2026-11-17T10:30:00',
          description: 'Notificação 1',
          id: 1,
          read: false,
        },
      ]);
      fixture.detectChanges();
      const cta = q<HTMLButtonElement>('app-card-notify button.card-notify__cta');

      expect(cta?.disabled).toBeFalse();
      expect(cta?.textContent).toContain('Ver detalhes');
    });

    it('o card de pacientes do dia leva à listagem de pacientes', async () => {
      await setup();
      navigate.calls.reset();

      (q('app-card-patients button') as HTMLButtonElement).click();
      fixture.detectChanges();
      await settle();

      expect(navigate).toHaveBeenCalledWith(['/patients']);
    });

    it('lists notifications after the count card in the grid', async () => {
      const feed = new FakeNotifications();

      feed.total = 0;
      await setup({ feed });
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

      // v2: o título "Notificações" separa o card fixo do feed.
      expect(grid().length).toBe(5);
      expect(grid()[0].tagName.toLowerCase()).toBe('app-card-patients');
      expect(grid()[1].textContent).toContain('Notificações');
      expect(grid()[2].tagName.toLowerCase()).toBe('app-card-notify');
      expect(grid()[2].textContent).toContain('Notificação 0');
      expect(fixture.componentInstance.formatTime('2026-11-17T10:30:00')).toContain('10:30');
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

    it('opens the notification detail when the card is tapped anywhere (US-003-3-04)', async () => {
      await setup({ feed: Object.assign(new FakeNotifications(), { total: 1 }) });
      (q('app-card-notify .card-notify') as HTMLElement).click();

      expect(navigate).toHaveBeenCalledWith(['/notifications', 0]);
    });

    it('shows only the fixed card plus an empty-state note when there are no notifications (US-003-3-05)', async () => {
      await setup({ feed: Object.assign(new FakeNotifications(), { total: 0 }) });

      expect(grid()[0].tagName.toLowerCase()).toBe('app-card-patients');
      expect(el().querySelectorAll('app-card-notify').length).toBe(0);
      expect(q('.home__empty')?.textContent).toContain('Nenhuma notificação');
    });

    it('does not show the empty-state note while there are notifications', async () => {
      await setup();

      expect(q('.home__empty')).toBeNull();
    });

    it('ignores the patients-card callback (listing screen is a separate spec)', async () => {
      await setup();

      expect(() => fixture.componentInstance.onViewPatients()).not.toThrow();
    });
  });

  describe('notification feed ordering (US-003-3-01)', () => {
    const notif = (id: number, createdAt: string): HomeNotification => ({
      author: { id, name: `Autor ${id}`, photoUrl: null, specialty: 'Nutrição' },
      createdAt,
      description: `Notificação ${id}`,
      id,
      read: false,
    });
    const order = (): (string | undefined)[] =>
      Array.from(el().querySelectorAll('app-card-notify')).map(c => /Notificação (\d)/.exec(c.textContent ?? '')?.[1]);

    it('lists notifications after the fixed card, newest first', async () => {
      const feed = new FakeNotifications();

      feed.custom = [notif(1, '2026-11-17T08:00:00'), notif(3, '2026-11-17T10:00:00'), notif(2, '2026-11-17T09:00:00')];
      await setup({ feed });

      expect(grid()[0].tagName.toLowerCase()).toBe('app-card-patients');
      expect(order()).toEqual(['3', '2', '1']);
    });

    it('breaks exact time ties by creation order (latest created first)', async () => {
      const feed = new FakeNotifications();

      feed.custom = [notif(5, '2026-11-17T10:00:00'), notif(7, '2026-11-17T10:00:00'), notif(6, '2026-11-17T10:00:00')];
      await setup({ feed });

      expect(order()).toEqual(['7', '6', '5']);
    });

    it('clears the list when there is no hospital in context', async () => {
      await setup({ hospitals: [] });

      expect(fixture.componentInstance.notifications()).toEqual([]);
    });

    it('acesso negado (403) no primeiro lote trata como revogação: troca o hospital e avisa em texto', async () => {
      const feed = new FakeNotifications();
      const original = feed.loadPage.bind(feed);

      feed.loadPage = (hospitalId, cursor, limit): Promise<NotificationPage> =>
        hospitalId === 1 ? Promise.reject({ status: 403 }) : original(hospitalId, cursor, limit);
      await setup({ feed, hospitals: HOSPITALS });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(TestBed.inject(HospitalContextService).selected()).toEqual(HOSPITALS[1]);
      expect(TestBed.inject(HospitalContextService).hospitals()).toEqual([HOSPITALS[1]]);
      expect(fixture.componentInstance.stale()).toBeFalse();
      expect(q('.home__stale-banner')?.textContent).toContain(`Seu acesso a ${HOSPITALS[0].name} foi revogado`);
    });

    it('403 sem vínculo revogado (ex.: não é gestor) não troca o hospital: sinaliza dados desatualizados', async () => {
      const feed = new FakeNotifications();

      feed.loadPage = (): Promise<NotificationPage> => Promise.reject({ status: 403 });
      await setup({ feed, hospitals: HOSPITALS, linkRevoked: false });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(TestBed.inject(HospitalContextService).selected()).toEqual(HOSPITALS[0]);
      expect(TestBed.inject(HospitalContextService).hospitals()).toEqual([...HOSPITALS]);
      expect(fixture.componentInstance.stale()).toBeTrue();
    });

    it('flags stale data (without the generic error) when the first batch fails', async () => {
      const feed = new FakeNotifications();

      feed.failFirst = true;
      await setup({ feed });

      expect(fixture.componentInstance.stale()).toBeTrue();
      expect(q('.home__stale-banner')).toBeTruthy();
      expect(q('app-home-error')).toBeNull();
    });
  });

  describe('infinite scroll', () => {
    const cards = (): HTMLElement[] => Array.from(el().querySelectorAll('app-card-notify'));
    const sentinel = (): HTMLElement | null => q('.home__scroll-sentinel');

    it('shows only the 10 most recent of 35 notifications on load (RN-01)', async () => {
      await setup();

      expect(notifications.calls).toEqual([{ cursor: null, hospitalId: 1, limit: 10 }]);
      expect(cards().length).toBe(10);
      expect(cards()[0].textContent).toContain('Notificação 0');
    });

    it('loads the next batch of 10 when reaching the end (RN-02)', async () => {
      await setup();

      await fixture.componentInstance.loadNextBatch();
      fixture.detectChanges();

      expect(notifications.calls[1]).toEqual({ cursor: '10', hospitalId: 1, limit: 10 });
      expect(cards().length).toBe(20);
      expect(cards()[19].textContent).toContain('Notificação 19');
    });

    it('keeps loading 10 by 10 until exhausted, then stops without requests or sentinel (RN-03)', async () => {
      await setup();
      const component = fixture.componentInstance;

      await component.loadNextBatch();
      await component.loadNextBatch();
      await component.loadNextBatch();
      fixture.detectChanges();

      expect(cards().length).toBe(35);
      expect(sentinel()).toBeNull();
      const callsBefore = notifications.calls.length;

      await component.loadNextBatch();

      expect(notifications.calls.length).toBe(callsBefore);
      expect(q('[role="alert"], app-home-error')).toBeNull();
    });

    it('does not fire duplicate requests while a batch is in flight', async () => {
      await setup();
      let release!: () => void;

      notifications.gate = new Promise<void>(resolve => (release = resolve));
      const component = fixture.componentInstance;
      const first = component.loadNextBatch();

      void component.loadNextBatch();
      void component.loadNextBatch();
      release();
      await first;

      expect(notifications.calls.length).toBe(2);
      expect(component.notifications().length).toBe(20);
    });

    it('keeps the cards and the generic error away when an extra batch fails', async () => {
      await setup();
      notifications.fail = true;

      await fixture.componentInstance.loadNextBatch();
      fixture.detectChanges();

      expect(cards().length).toBe(10);
      expect(q('app-home-error')).toBeNull();
    });

    it('does not load more batches while the data is stale (offline)', async () => {
      await setup();
      fixture.componentInstance.stale.set(true);

      await fixture.componentInstance.loadNextBatch();

      expect(notifications.calls.length).toBe(1);
    });

    it('restarts the feed with only the first batch when the hospital changes', async () => {
      await setup({ hospitals: HOSPITALS });
      await fixture.componentInstance.loadNextBatch();

      TestBed.inject(HospitalContextService).select(2);
      fixture.detectChanges();
      await settle();

      expect(notifications.calls[notifications.calls.length - 1]).toEqual({ cursor: null, hospitalId: 2, limit: 10 });
      expect(cards().length).toBe(10);
    });

    it('ignores a stale batch that resolves after the hospital changed', async () => {
      await setup({ hospitals: HOSPITALS });
      let release!: () => void;

      notifications.gate = new Promise<void>(resolve => (release = resolve));
      const pendingBatch = fixture.componentInstance.loadNextBatch();

      notifications.gate = null;
      TestBed.inject(HospitalContextService).select(2);
      fixture.detectChanges();
      await settle();
      release();
      await pendingBatch;

      expect(fixture.componentInstance.notifications().length).toBe(10);
    });

    it('keeps loading while the sentinel stays visible after each batch (large screens)', async () => {
      const original = window.IntersectionObserver;

      window.IntersectionObserver = function (cb: (entries: { isIntersecting: boolean }[]) => void): unknown {
        return {
          disconnect: (): void => undefined,
          observe: (): void => {
            // Assíncrono como no navegador: só avisa na criação da observação.
            setTimeout(() => cb([{ isIntersecting: true }]));
          },
        };
      } as unknown as typeof IntersectionObserver;
      try {
        await setup();
        await settle();
        await settle();
        await settle();

        expect(cards().length).toBe(35);
        expect(sentinel()).toBeNull();
      } finally {
        window.IntersectionObserver = original;
      }
    });

    it('loads the next batch when the sentinel becomes visible', async () => {
      let notify!: (entries: { isIntersecting: boolean }[]) => void;
      const disconnect = jasmine.createSpy('disconnect');
      const original = window.IntersectionObserver;

      window.IntersectionObserver = function (cb: typeof notify): unknown {
        notify = cb;

        return { disconnect, observe: (): void => undefined };
      } as unknown as typeof IntersectionObserver;
      try {
        await setup();
        notify([{ isIntersecting: false }]);
        await settle();

        expect(notifications.calls.length).toBe(1);

        notify([{ isIntersecting: true }]);
        await settle();

        expect(notifications.calls.length).toBe(2);
      } finally {
        window.IntersectionObserver = original;
      }
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

  describe('hospitais vinculados (US-003-1-03)', () => {
    const retryButton = (): HTMLButtonElement | null => q<HTMLButtonElement>('app-home-error app-button button');

    it('mostra o skeleton enquanto os hospitais carregam', async () => {
      await setup({ hospitalsRead: () => new Promise<readonly LinkedHospital[]>(() => undefined) });

      expect(q('app-home-skeleton')).toBeTruthy();
      expect(q('.home__local')).toBeNull();
    });

    it('mostra o erro genérico quando os hospitais falham e recarrega ao tentar de novo', async () => {
      let fail = true;

      await setup({
        hospitalsRead: () => (fail ? Promise.reject(new Error('x')) : Promise.resolve([HOSPITALS[0]])),
      });
      await TestBed.inject(HospitalContextService)
        .load()
        .catch(() => undefined);
      await settle();

      expect(q('app-home-error')).toBeTruthy();
      expect(q('.home__header')).toBeTruthy();

      fail = false;
      retryButton()?.click();
      await settle();
      await settle();

      expect(q('app-home-error')).toBeNull();
      expect(q('.home__local app-tag')?.textContent).toContain('Hospital A');
    });

    it('usa o id numérico do hospital único nas fontes, sem seletor navegável (RN-03)', async () => {
      await setup({ hospitals: [{ id: 42, name: 'Hospital 42' }] });

      expect(notifications.calls[0].hospitalId).toBe(42);
      expect(patients.calls[0].hospitalId).toBe(42);
      expect(q('.home__hospital-trigger')).toBeNull();
    });
  });

  it('registra "Movimentar leito" citando o paciente e busca só no hospital ativo (US-002-2-02)', async () => {
    await setup();
    const action = TestBed.inject(ScreenActionsService)
      .actions()
      .find(a => a.id === 'move-bed');

    await action?.conversation
      ?.submit({ request: JSON.stringify({ bed: '210', name: 'Beatriz Ramos Costa' }) })
      .catch(() => undefined);

    expect(byNameCalls).toEqual([[1, 'Beatriz Ramos Costa', '210']]);
  });

  describe('atalho do gestor (FT-009-1)', () => {
    it('gestor vê "Convidar profissional" nos atalhos e ele navega ao convite', async () => {
      await setup();
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HomeComponent],
        providers: [
          provideRouter([]),
          { provide: BedMovementPort, useValue: {} },
          { provide: BedNumberExtractor, useValue: {} },
          { provide: LocationChangePort, useValue: {} },
          { provide: LocationExtractor, useValue: { extract: (): null => null } },
          { provide: BedOccupancyPort, useValue: {} },
          ...shiftProviders,
          { provide: DailyPatientsSource, useValue: new FakePatients() },
          { provide: HomeNotificationsSource, useValue: new FakeNotifications() },
          { provide: LinkRevocationChecker, useValue: { isRevoked: (): Promise<boolean> => Promise.resolve(false) } },
          { provide: ProfessionalProfileReader, useClass: LocalProfessionalProfileReader },
          { provide: ManagerAccessReader, useValue: { isManager: (): boolean => true } },
          {
            provide: LinkedHospitalsReader,
            useValue: { read: (): Promise<readonly LinkedHospital[]> => Promise.resolve([{ id: 1, name: 'H1' }]) },
          },
          { provide: UnreadNotificationsReader, useValue: { countUnread: (): Promise<number> => Promise.resolve(0) } },
        ],
      }).compileComponents();
      const router = TestBed.inject(Router);

      spyOn(router, 'navigate').and.resolveTo(true);
      TestBed.inject(HomeStateService).setStatus('success');
      TestBed.createComponent(HomeComponent).detectChanges();
      const action = TestBed.inject(ScreenActionsService)
        .actions()
        .find(a => a.id === 'invite-professional');

      action?.navigate?.();

      expect(action?.label).toBe('Convidar profissional');
      expect(router.navigate).toHaveBeenCalledWith(['/hospital-team', 'invite']);

      const revoke = TestBed.inject(ScreenActionsService)
        .actions()
        .find(a => a.id === 'revoke-professional-access');

      revoke?.navigate?.();

      expect(router.navigate).toHaveBeenCalledWith(['/hospital-team', 'access']);
    });
  });
});
