import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { AssistantConversationService } from '../../shared/services/assistant-conversation.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import {
  type ScreenAction,
  ScreenActionsService,
  type ScreenCommand,
} from '../../shared/services/screen-actions.service';
import { FollowUpClosureWriter } from '../follow-up-closure/follow-up-closure-source';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { ProfessionalProfileReader } from '../home/professional-profile';
import { UnreadNotificationsReader } from '../home/unread-notifications-reader';
import { LocationChangePort, LocationExtractor } from '../patient-hub/change-location/location-change.port';
import { BedMovementPort, BedOccupancyPort } from '../patient-hub/move-bed/bed-movement.port';
import { BedNumberExtractor } from '../patient-hub/move-bed/bed-number-extractor';
import { InternacaoCreationPort } from '../patient-registration/internacao-creation.port';
import { PatientCreationPort } from '../patient-registration/patient-creation.port';
import { HospitalSiteSource } from '../shift/hospital-site-source';
import { ProvisionalHospitalSiteSource } from '../shift/provisional-hospital-site-source';
import { ProvisionalShiftSource } from '../shift/provisional-shift-source';
import { ShiftService } from '../shift/shift.service';
import { ShiftSource } from '../shift/shift-source';
import { PatientListComponent, refreshesOnVisibility } from './patient-list.component';
import { CensusPatient } from './patient-list.models';
import { PatientListAiCommandPort } from './patient-list-ai-command';
import { PatientListSource } from './patient-list-source';

const census = (n: number, name = 'Paciente'): CensusPatient[] =>
  Array.from({ length: n }, (_, i) => ({
    adequacy: { caloric: 80, protein: 70 },
    admissionStatus: 'ADMITTED_BY_EMTN',
    bed: String(i + 1),
    birthDate: '1980-01-01',
    completedCycles: i === 1 ? 0 : 1,
    hospitalId: 1,
    id: `p${i}`,
    name: `${name} ${i}`,
    registeredInConductia: true,
    therapy: i === 0 ? 'MISTA' : 'NE',
    therapyStartDate: '2026-01-01',
    ward: 'Ala 1',
  }));

class FakeAi extends PatientListAiCommandPort {
  readonly sent: ScreenCommand[] = [];
  fail = false;
  send(command: ScreenCommand): Promise<void> {
    this.sent.push(command);

    return this.fail ? Promise.reject(new Error('ia fora')) : Promise.resolve();
  }
}

class FakeSource extends PatientListSource {
  result: Promise<readonly CensusPatient[]> = Promise.resolve([]);
  /** Censo diferente por dia (busca em outras datas); sem isso todos os dias devolvem `result`. */
  byDay: ((day: Date) => Promise<readonly CensusPatient[]>) | null = null;
  loadCensus(_?: number, day?: Date): Promise<readonly CensusPatient[]> {
    return this.byDay !== null && day !== undefined ? this.byDay(day) : this.result;
  }
}

const yesterday = (): Date => {
  const d = new Date();

  d.setDate(d.getDate() - 1);

  return d;
};

describe('PatientListComponent', () => {
  let byNameCalls: unknown[][] = [];

  beforeEach(() => {
    byNameCalls = [];
  });

  let source: FakeSource;
  let ai: FakeAi;
  let fixture: ComponentFixture<PatientListComponent>;
  let router: Router;
  const closureWriter = { close: jasmine.createSpy('close') };

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const q = (sel: string): HTMLElement | null => (fixture.nativeElement as HTMLElement).querySelector(sel);
  const qa = (sel: string): HTMLElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel));

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(PatientListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // Parâmetros da URL (a tela lê `?turno=1`); o `router.navigate` é espionado, então o teste os troca aqui.
  const query$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));

  beforeEach(async () => {
    localStorage.clear();
    query$.next(convertToParamMap({}));
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    source = new FakeSource();
    ai = new FakeAi();
    TestBed.configureTestingModule({
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
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: query$ } },
        { provide: HospitalSiteSource, useClass: ProvisionalHospitalSiteSource },
        { provide: ShiftSource, useClass: ProvisionalShiftSource },
        { provide: PatientListSource, useValue: source },
        { provide: FollowUpClosureWriter, useValue: closureWriter },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): { name: string; role: string } => ({ name: 'Michelle', role: 'doctor' }) },
        },
        { provide: PatientListAiCommandPort, useValue: ai },
        { provide: PatientCreationPort, useValue: { create: (): Promise<void> => Promise.resolve() } },
        { provide: InternacaoCreationPort, useValue: { create: (): Promise<void> => Promise.resolve() } },
        { provide: UnreadNotificationsReader, useValue: { countUnread: (): Promise<number> => Promise.resolve(2) } },
        {
          provide: LinkedHospitalsReader,
          useValue: {
            read: (): Promise<{ id: number; name: string }[]> => Promise.resolve([{ id: 1, name: 'Hospital Um' }]),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    await TestBed.inject(HospitalContextService).load();
  });

  it('mostra skeleton enquanto carrega, com o cabeçalho já visível', () => {
    source.result = new Promise<readonly CensusPatient[]>(() => undefined);
    fixture = TestBed.createComponent(PatientListComponent);
    fixture.detectChanges();

    expect(q('.patient-list__skeleton')).not.toBeNull();
    expect(text()).toContain('Hospital Um');
  });

  it('mostra contagem, hospital e cards com iniciais, idade, ala/leito e terapia', async () => {
    source.result = Promise.resolve(census(3));
    await create();

    expect(text()).toContain('3 pacientes');
    expect(text()).toContain('Hospital Um');
    expect(text()).toContain('Ala 1 · Leito 1');
    expect(text()).toContain('VO · NE · NP');
    expect(text()).toContain('46 anos · 01/01/1980');
    expect(fixture.nativeElement.querySelectorAll('.patient-list__row').length).toBe(3);
  });

  it('paciente real sem terapia nem início informados mostra rótulos neutros e ordena por terapia', async () => {
    source.result = Promise.resolve([
      { ...census(1)[0], completedCycles: null, id: 'r', therapy: null, therapyStartDate: null },
      ...census(1),
    ]);
    await create();

    expect(text()).toContain('Não informada');
    expect(text()).toContain('Início da TN não informado');
    expect(text()).not.toContain('Primeira avaliação');
  });

  it('mostra início da terapia, gauge (sem rótulo de adequação) e primeira avaliação', async () => {
    source.result = Promise.resolve([
      ...census(2),
      { ...census(1)[0], adequacy: null, id: 'n' },
      { ...census(1)[0], adequacy: { caloric: 10, protein: null }, id: 'q' },
    ]);
    await create();

    expect(text()).not.toContain('Calórica');
    expect(text()).not.toContain('Adequação indisponível');
    expect(text()).toContain('TN há');
    expect(fixture.nativeElement.querySelectorAll('app-graph-meta').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.patient-list__first app-therapy-tag').length).toBe(1);
    expect(text()).toContain('Primeira avaliação');
  });

  it('carrossel de datas: hoje destacado e trocar a data recarrega a lista para ela', async () => {
    const days: Date[] = [];

    source.loadCensus = (_?: number, day?: Date): Promise<readonly CensusPatient[]> => {
      days.push(day as Date);

      return Promise.resolve(census(1));
    };
    await create();

    expect(q('.date-strip__day--selected .date-strip__number')?.textContent).toBe(String(new Date().getDate()));
    expect(
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.date-strip__day')).at(-1)?.classList,
    ).toContain('date-strip__day--selected');
    q('[aria-label="Dia anterior"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(days.length).toBe(2);
    expect(days[1].getDate()).toBe(
      new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate() - 1).getDate(),
    );
  });

  it('cabeçalho tem sino e atalhos (sem voltar), sem rótulo de adequação do dia, e o sino abre as notificações', async () => {
    source.result = Promise.resolve(census(2));
    await create();

    expect(text()).not.toContain('Adequação do dia');
    expect(q('[aria-label="Voltar"]')).toBeNull();
    q('[aria-label^="Notificações"]')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/notifications']);
    expect(q('.page-header__title ph-icon i')?.className).toContain('ph-fill');
    q('[aria-label="Ações da tela"]')?.click();

    expect(TestBed.inject(AiAssistantService).view()).toBe('shortcuts');
  });

  it('agrupa em Fora da meta e Dentro da meta com contagem e mostra no subtítulo (por prioridade)', async () => {
    source.result = Promise.resolve([
      ...census(2),
      { ...census(1)[0], adequacy: { caloric: 10, protein: 60 }, id: 'out1', name: 'Crítico Um' },
      { ...census(1)[0], adequacy: { caloric: 30, protein: null }, id: 'out2' },
      { ...census(1)[0], adequacy: null, id: 'none' },
    ]);
    await create();
    fixture.componentInstance.selectSort('priority');
    fixture.detectChanges();
    const titles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.patient-list__section-title'),
    ).map(t => t.textContent?.replace(/\s+/g, ' ').trim());

    // sem nenhum valor de adequação não se afirma que está na meta: grupo próprio, ao fim
    expect(titles).toEqual(['Fora da meta2', 'Dentro da meta2', 'Sem adequação1']);
    expect(text()).toContain('2 fora da meta');
    // o mais crítico (10%) vem primeiro
    expect((q('.patient-list__cluster .patient-list__row') as HTMLElement).textContent).toContain('Crítico Um');
  });

  describe('ordenação pré-definida (US-004-1-05)', () => {
    const mixed = (): CensusPatient[] => [
      { ...census(1)[0], adequacy: { caloric: 90, protein: 90 }, bed: '10', id: 'a', name: 'A', ward: 'Ala 2' },
      { ...census(1)[0], adequacy: { caloric: 10, protein: 90 }, bed: '2', id: 'b', name: 'B', ward: 'Ala 1' },
      { ...census(1)[0], adequacy: null, bed: '10', id: 'c', name: 'C', ward: 'Ala 1' },
      { ...census(1)[0], adequacy: { caloric: 80, protein: 80 }, bed: '9', id: 'd', name: 'D', ward: 'Ala 2' },
    ];
    const titles = (): string[] =>
      qa('.patient-list__section-title').map(t => t.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    const names = (): string[] =>
      qa('.patient-list__cluster .patient-list__name').map(n => n.textContent?.trim() ?? '');
    const sort = (): ReturnType<ScreenActionsService['sort']> => TestBed.inject(ScreenActionsService).sort();

    beforeEach(async () => {
      source.result = Promise.resolve(mixed());
      await create();
    });

    it('o seletor mostra o critério ativo e aparece também carregando', async () => {
      const tag = (): string =>
        q('.patient-list__sort-select > span[aria-hidden]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

      expect(tag()).toBe('Ordenar: prioridade');

      sort()?.select('bed');
      fixture.detectChanges();

      expect(tag()).toBe('Ordenar: leito');

      source.result = new Promise<readonly CensusPatient[]>(() => undefined);
      fixture.componentInstance.selectDate(new Date(Date.now() - 86_400_000));
      fixture.detectChanges();

      expect(q('.patient-list__skeleton')).not.toBeNull();
      expect(tag()).toBe('Ordenar: leito');
    });

    it('padrão: por prioridade (Fora/Dentro da meta), como no Figma, com o chip selecionado', () => {
      expect(titles()).toEqual(['Fora da meta1', 'Dentro da meta2', 'Sem adequação1']);
      expect(sort()?.active()).toBe('priority');
    });

    it('por leito: ordem estável agrupada por ala', () => {
      sort()?.select('bed');
      fixture.detectChanges();

      expect(titles()).toEqual(['Ala 12', 'Ala 22']);
      expect(names()).toEqual(['B', 'C', 'D', 'A']);
    });

    it('por prioridade: fora da meta primeiro, preservando todos os pacientes', () => {
      sort()?.select('priority');
      fixture.detectChanges();

      expect(titles()).toEqual(['Fora da meta1', 'Dentro da meta2', 'Sem adequação1']);
      expect(names()).toEqual(['B', 'A', 'C', 'D'].sort((x, y) => names().indexOf(x) - names().indexOf(y)));
      expect(names().length).toBe(4);
      expect(sort()?.active()).toBe('priority');
    });

    it('por leito substitui a prioridade e ordena os leitos numericamente', () => {
      sort()?.select('priority');
      sort()?.select('bed');
      fixture.detectChanges();

      expect(sort()?.active()).toBe('bed');
      expect(names()).toEqual(['B', 'C', 'D', 'A']);
    });

    it('acionar o critério ativo o mantém', () => {
      sort()?.select('bed');
      sort()?.select('bed');

      expect(sort()?.active()).toBe('bed');
    });

    it('a ordenação não busca dados de novo', () => {
      const spy = spyOn(source, 'loadCensus').and.callThrough();

      sort()?.select('priority');
      fixture.detectChanges();

      expect(spy).not.toHaveBeenCalled();
    });

    it('persiste ao trocar a data: o critério de ordenação não muda', async () => {
      const before = new Date(Date.now() - 86_400_000);

      sort()?.select('priority');
      fixture.componentInstance.selectDate(before);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.readOnly()).toBeTrue();
      expect(sort()?.active()).toBe('priority');
      expect(titles()[0]).toContain('Fora da meta');

      fixture.componentInstance.selectDate(new Date());

      expect(sort()?.active()).toBe('priority');
    });

    it('em data retroativa as ações somem, mas os chips de ordenação continuam', async () => {
      fixture.componentInstance.selectDate(new Date(Date.now() - 86_400_000));
      fixture.detectChanges();

      expect(TestBed.inject(ScreenActionsService).actions()).toEqual([]);
      expect(sort()?.options.map(o => o.label)).toEqual(['Por prioridade', 'Por leito']);
    });
  });

  describe('colunas ajustáveis (desktop)', () => {
    const handle = (index = 0): HTMLElement => fixture.nativeElement.querySelectorAll('.patient-list__resizer')[index];
    const width = (key: 'name' | 'age'): number => fixture.componentInstance.widths()[key];

    beforeEach(async () => {
      source.result = Promise.resolve(census(2));
      await create();
    });

    it('tem uma divisória por coluna ajustável, com rótulo acessível', () => {
      const handles = fixture.nativeElement.querySelectorAll('.patient-list__resizer');

      expect(handles.length).toBe(6);
      expect(handle(0).getAttribute('role')).toBe('separator');
      expect(handle(0).getAttribute('aria-label')).toContain('Paciente');
    });

    it('sem coluna anterior no DOM, parte da largura guardada ao arrastar', () => {
      const detached = document.createElement('span');
      const event = {
        clientX: 0,
        currentTarget: detached,
        pointerId: 1,
        preventDefault: (): void => undefined,
        stopPropagation: (): void => undefined,
      } as unknown as PointerEvent;

      detached.setPointerCapture = (): void => undefined;
      fixture.componentInstance.startResize(event, 'name');
      detached.dispatchEvent(new PointerEvent('pointermove', { clientX: 20 }));

      expect(width('name')).toBe(300);

      detached.dispatchEvent(new PointerEvent('pointerup'));

      expect(fixture.componentInstance.resizing()).toBeNull();
    });

    it('ajusta pelo teclado em passos de 16px, respeita o mínimo e volta ao padrão com Home', () => {
      const start = width('name');

      handle(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

      expect(width('name')).toBe(start + 16);

      for (let i = 0; i < 40; i++) {
        handle(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      }

      expect(width('name')).toBe(180);

      handle(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));

      expect(width('name')).toBe(start);

      const ignored = new KeyboardEvent('keydown', { cancelable: true, key: 'a' });

      handle(0).dispatchEvent(ignored);

      expect(ignored.defaultPrevented).toBeFalse();
    });

    it('ajusta arrastando a divisória (mouse) e respeita o máximo', () => {
      const el = handle(1);

      el.setPointerCapture = (): void => undefined;
      const th = (el.closest('th') as HTMLElement).previousElementSibling as HTMLElement;
      const startWidth = th.getBoundingClientRect().width;

      el.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 100, pointerId: 1 }),
      );

      expect(fixture.componentInstance.resizing()).toBe('age');
      fixture.detectChanges();

      // durante o arrasto a linha fica na borda esquerda do cabeçalho seguinte (Terapia = 3ª coluna)
      expect(q('.patient-list__table')?.getAttribute('data-line')).toBe('3');

      el.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, pointerId: 1 }));

      expect(width('age')).toBe(Math.min(560, Math.max(110, Math.round(startWidth + 300))));

      el.dispatchEvent(new PointerEvent('pointermove', { clientX: 5000, pointerId: 1 }));

      expect(width('age')).toBe(560);

      el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));

      expect(fixture.componentInstance.resizing()).toBeNull();
    });
  });

  describe('ajustar colunas', () => {
    const widths = (): number[] => Object.values(fixture.componentInstance.widths());
    const clickFit = (clientWidth: number): void => {
      const card = q('.patient-list__table-card') as HTMLElement;

      Object.defineProperty(card, 'clientWidth', { configurable: true, value: clientWidth });
      // O botão só aparece depois que o usuário ajusta alguma coluna.
      fixture.componentInstance.fitState.set('needs');
      fixture.detectChanges();
      (q('.patient-list__fit') as HTMLElement).click();
      fixture.detectChanges();
    };

    beforeEach(async () => {
      source.result = Promise.resolve(census(2));
      await create();
    });

    it('encaixa todas as colunas na largura útil (sem rolagem horizontal)', () => {
      clickFit(1272);

      const sum = widths().reduce((a, b) => a + b, 0);

      expect(sum).toBeLessThanOrEqual(1200);
      expect(sum).toBeGreaterThan(1180);
    });

    it('volta ao tamanho padrão quando ele cabe na área útil', () => {
      (q('.patient-list__resizer') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      clickFit(1500);

      expect(fixture.componentInstance.widths()).toEqual({
        age: 150,
        caloric: 170,
        status: 200,
        location: 170,
        name: 280,
        protein: 170,
        therapy: 120,
      });
    });

    it('nunca passa do mínimo: com pouco espaço todas ficam no mínimo', () => {
      clickFit(300);

      expect(fixture.componentInstance.widths()).toEqual({
        age: 110,
        caloric: 130,
        status: 200,
        location: 130,
        name: 180,
        protein: 130,
        therapy: 130,
      });
    });

    it('reparte o que sobra quando alguma coluna bateria no mínimo', () => {
      clickFit(1200);

      const w = fixture.componentInstance.widths();

      expect(w.therapy).toBe(130);
      expect(widths().reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1128);
    });
  });

  it('o botão de ajustar some depois de usado e volta quando o usuário redimensiona', async () => {
    source.result = Promise.resolve(census(2));
    await create();

    expect(q('.patient-list__fit')).toBeNull();

    q('.patient-list__resizer')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    expect(q('.patient-list__fit')).not.toBeNull();

    (q('.patient-list__fit') as HTMLElement).click();
    fixture.detectChanges();

    expect(q('.patient-list__fit')).toBeNull();
  });

  describe('ordenação da tabela', () => {
    const rowNames = (): string[] =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.patient-list__table tbody tr')).map(
        r => r.querySelector('.patient-list__name')?.textContent?.trim() ?? '',
      );
    const sortButton = (index: number): HTMLElement =>
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.patient-list__sort')[index];
    const arrow = (): string[] =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.patient-list__sort ph-icon')).map(
        i => i.getAttribute('ng-reflect-name') ?? i.querySelector('i')?.className ?? '',
      );

    beforeEach(async () => {
      source.result = Promise.resolve([
        {
          ...census(1)[0],
          adequacy: { caloric: 80, protein: 70 },
          bed: '2',
          birthDate: '1986-01-01',
          id: 'a',
          name: 'Bruna',
          therapy: 'VO',
          ward: 'Ala 2',
        },
        {
          ...census(1)[0],
          adequacy: { caloric: 20, protein: null },
          bed: '10',
          birthDate: '1996-01-01',
          id: 'b',
          name: 'Ana',
          therapy: 'NE',
          ward: 'Ala 1',
        },
        {
          ...census(1)[0],
          adequacy: null,
          bed: '3',
          birthDate: '1976-01-01',
          id: 'c',
          name: 'Carla',
          therapy: 'NP',
          ward: 'Ala 1',
        },
      ]);
      await create();
    });

    it('começa ordenada por prioridade; "Por leito" ordena por localização, crescente (ala e leito numérico)', () => {
      expect(fixture.componentInstance.sortKey()).toBe('priority');

      fixture.componentInstance.selectSort('bed');
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Carla', 'Ana', 'Bruna']);
      expect(fixture.componentInstance.sortKey()).toBe('location');
      expect(arrow().length).toBe(1);
      expect((fixture.nativeElement as HTMLElement).querySelector('th[aria-sort="ascending"]')?.textContent).toContain(
        'Localização',
      );
    });

    it('clicar numa coluna ordena crescente; clicar de novo, decrescente; outra coluna reinicia', () => {
      sortButton(0).click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Ana', 'Bruna', 'Carla']);

      sortButton(0).click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Carla', 'Bruna', 'Ana']);
      expect(fixture.componentInstance.sortDir()).toBe('desc');

      sortButton(1).click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Ana', 'Bruna', 'Carla']);
      expect(fixture.componentInstance.sortDir()).toBe('asc');
      expect(arrow().length).toBe(1);
    });

    it('ordena por adequação com indisponível sempre no fim, nas duas direções', () => {
      sortButton(3).click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Ana', 'Bruna', 'Carla']);

      sortButton(3).click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Bruna', 'Ana', 'Carla']);
    });

    it('ordena por idade e por terapia', () => {
      sortButton(1).click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Ana', 'Bruna', 'Carla']);

      sortButton(1).click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Carla', 'Bruna', 'Ana']);
      expect((fixture.nativeElement as HTMLElement).querySelector('th[aria-sort="descending"]')).not.toBeNull();

      sortButton(2).click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Ana', 'Carla', 'Bruna']);

      sortButton(4).click();
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Bruna', 'Carla', 'Ana']);
    });
  });

  it('mostra a linha de divisória da coluna sob o mouse no cabeçalho', async () => {
    source.result = Promise.resolve(census(2));
    await create();
    const th = q('.patient-list__table th:nth-child(2)') as HTMLElement;

    th.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(q('.patient-list__table')?.getAttribute('data-line')).toBe('2');

    th.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();

    expect(q('.patient-list__table')?.getAttribute('data-line')).toBeNull();

    // a primeira coluna não tem divisória à esquerda
    (q('.patient-list__table th:nth-child(1)') as HTMLElement).dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(q('.patient-list__table')?.getAttribute('data-line')).toBeNull();
  });

  it('mostra Indisponível no lugar do gráfico e a Primeira avaliação antes do nome no mobile', async () => {
    source.result = Promise.resolve([{ ...census(1)[0], adequacy: null, completedCycles: 0, id: 'n' }]);
    await create();
    const info = q('.patient-list__row .patient-list__info') as HTMLElement;

    expect(q('.patient-list__gauge-na')?.textContent).toContain('Indisponível');
    expect((info.firstElementChild as HTMLElement).className).toContain('patient-list__first');
  });

  it('registra "Movimentar leito" citando o paciente e busca só no hospital ativo (US-002-2-02)', async () => {
    await create();
    const action = TestBed.inject(ScreenActionsService)
      .actions()
      .find(a => a.id === 'move-bed');

    await action?.conversation
      ?.submit({ request: JSON.stringify({ bed: '210', name: 'Beatriz Ramos Costa' }) })
      .catch(() => undefined);

    expect(byNameCalls).toEqual([[1, 'Beatriz Ramos Costa', '210']]);
  });

  it('registra as ações principais da tela nos atalhos', async () => {
    await create();

    expect(
      TestBed.inject(ScreenActionsService)
        .actions()
        .map(a => a.label),
    ).toEqual([
      'Cadastrar paciente',
      'Movimentar leito',
      'Alterar unidade/ala',
      'Alterar dados de paciente',
      'Encerrar acompanhamento',
    ]);
  });

  it('tabela desktop: idade e nascimento, metas com texto e clique na linha abre o Hub', async () => {
    source.result = Promise.resolve([...census(2), { ...census(1)[0], adequacy: null, id: 'n' }]);
    await create();
    const heads = Array.from(fixture.nativeElement.querySelectorAll('th')).map(th =>
      (th as HTMLElement).textContent?.trim(),
    );

    expect(heads).toContain('Meta calórica');
    expect(heads).toContain('Idade / nascimento');
    expect(heads).toContain('Status');
    expect(text()).toContain('80% · na meta');
    expect(text()).toContain('Indisponível');
    expect(text()).toContain('01/01/1980');
    q('.patient-list__tr')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p0']);
    (fixture.nativeElement.querySelector('.patient-list__open') as HTMLElement).click();

    expect(router.navigate).toHaveBeenCalledTimes(2);
  });

  describe('busca e coluna Status (Figma 4690:24100)', () => {
    const names = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.patient-list__tr .patient-list__name')).map(
        n => (n as HTMLElement).textContent?.trim() ?? '',
      );
    const search = async (value: string): Promise<void> => {
      const input = q('.patient-list__search input') as HTMLInputElement;

      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    beforeEach(async () => {
      source.result = Promise.resolve([
        { ...census(1)[0], id: 'a', name: 'Ana Souza', bed: '10', ward: 'Ala 1', completedCycles: 0 },
        {
          ...census(1)[0],
          id: 'b',
          name: 'Bruno Lima',
          bed: '20',
          ward: 'Subsolo',
          completedCycles: 2,
          pendingTasks: 0,
          reassessmentDone: true,
        },
        { ...census(1)[0], id: 'c', name: 'Carla Dias', bed: '30', ward: 'Ala 1', completedCycles: 2 },
      ]);
      await create();
    });

    it('filtra por paciente, leito ou ala (sem acento nem caixa); sem resultado avisa em texto', async () => {
      await search('bruno');

      expect(names()).toEqual(['Bruno Lima']);

      await search('ala 1');

      expect(names().sort((a, b) => a.localeCompare(b))).toEqual(['Ana Souza', 'Carla Dias']);

      await search('leito 30');

      expect(names()).toEqual(['Carla Dias']);

      await search('subsolo');

      expect(names()).toEqual(['Bruno Lima']);

      await search('zzz');

      expect(text()).toContain('Nenhum paciente encontrado');
      expect(text()).toContain('3 pacientes');

      await search('');

      expect(names().length).toBe(3);
    });

    it('o botão "Ordenar por prioridade" fica oculto por enquanto', () => {
      expect(q('.patient-list__sort-select')?.hasAttribute('hidden')).toBeTrue();
    });

    describe('busca em datas anteriores', () => {
      const old = (): CensusPatient => ({ ...census(1)[0], id: 'old', name: 'Zélia Antiga', bed: '77', ward: 'Ala 9' });
      const base = (): readonly CensusPatient[] => [census(1)[0]];
      const labels = (): string[] => qa('.patient-list__date-label').map(l => l.textContent?.trim() ?? '');

      beforeEach(() => {
        source.byDay = (day: Date): Promise<readonly CensusPatient[]> =>
          Promise.resolve(day.toDateString() === yesterday().toDateString() ? [...base(), old()] : base());
      });

      it('traz o paciente de outra data numa tabela própria, com o rótulo da data', async () => {
        await search('zelia');
        await new Promise(resolve => setTimeout(resolve));
        fixture.detectChanges();

        expect(labels()).toEqual([`Data ${yesterday().toLocaleDateString('pt-BR')}`]);
        expect(qa('.patient-list__table').length).toBe(1);
        expect(text()).toContain('Zélia Antiga');
        expect(text()).not.toContain('Nenhum paciente encontrado');
        q('.patient-list__tr')?.click();
        const d = yesterday();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        expect(router.navigate).toHaveBeenCalledWith(['/patients', 'old'], {
          queryParams: { data: `${d.getFullYear()}-${month}-${day}` },
        });
      });

      it('mantém a tabela do dia e acrescenta as outras; limpar a busca remove as extras', async () => {
        await search('ana');
        await new Promise(resolve => setTimeout(resolve));
        fixture.detectChanges();

        expect(labels()).toEqual([]);
        await search('zelia');
        await search('');
        await new Promise(resolve => setTimeout(resolve));
        fixture.detectChanges();

        expect(labels()).toEqual([]);
      });

      it('um paciente de hoje achado em outro dia fica no rótulo "Hoje"', async () => {
        source.byDay = (day: Date): Promise<readonly CensusPatient[]> =>
          Promise.resolve(day.toDateString() === new Date().toDateString() ? [old()] : []);
        const selected = fixture.componentInstance;

        selected.selectDate(yesterday());
        fixture.detectChanges();
        await fixture.whenStable();
        await search('zelia');
        await new Promise(resolve => setTimeout(resolve));
        fixture.detectChanges();

        expect(labels()).toEqual(['Hoje']);
        q('.patient-list__tr')?.click();

        expect(router.navigate).toHaveBeenCalledWith(['/patients', 'old']);
      });

      it('falha ao ler outra data não derruba a busca', async () => {
        source.byDay = (day: Date): Promise<readonly CensusPatient[]> =>
          day.toDateString() === yesterday().toDateString() ? Promise.reject(new Error('x')) : Promise.resolve(base());
        await search('zelia');
        await new Promise(resolve => setTimeout(resolve));
        fixture.detectChanges();

        expect(labels()).toEqual([]);
      });
    });

    it('todas as tags de status (menos a terapia) ficam na coluna Status; linha normal não tem tag', () => {
      const rows = Array.from(fixture.nativeElement.querySelectorAll('.patient-list__tr')) as HTMLElement[];
      const statusOf = (name: string): string =>
        rows
          .find(r => r.textContent?.includes(name))
          ?.querySelector('.patient-list__cell-first')
          ?.textContent?.trim() ?? '';

      expect(statusOf('Ana Souza')).toBe('Primeira avaliação');
      expect(statusOf('Bruno Lima')).toBe('Finalizado');
      expect(statusOf('Carla Dias')).toBe('');
      expect(
        rows.find(r => r.textContent?.includes('Bruno'))?.querySelector('.patient-list__name-cell')?.textContent,
      ).not.toContain('Finalizado');
    });

    it('ordena pela coluna Status; linhas sem tag ficam sempre no fim', () => {
      const header = Array.from(fixture.nativeElement.querySelectorAll('th .patient-list__sort')).find(b =>
        (b as HTMLElement).textContent?.includes('Status'),
      ) as HTMLButtonElement;

      header.click();
      fixture.detectChanges();

      expect(names()).toEqual(['Bruno Lima', 'Ana Souza', 'Carla Dias']);

      header.click();
      fixture.detectChanges();

      expect(names()).toEqual(['Ana Souza', 'Bruno Lima', 'Carla Dias']);
    });
  });

  it('o seletor "Ordenar" troca o critério (prioridade e leito) e mostra o escolhido', async () => {
    source.result = Promise.resolve(census(3));
    await create();
    const select = q('.patient-list__sort-select select') as HTMLSelectElement;

    select.value = 'bed';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.sortKey()).toBe('location');
    expect(q('.patient-list__sort-select > span[aria-hidden]')?.textContent).toContain('leito');

    select.value = 'priority';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.sortKey()).toBe('priority');
  });

  it('encerramento gravado recarrega a lista; fechar o modal limpa o alvo; voltar a ficar visível rebusca', async () => {
    source.result = Promise.resolve(census(2));
    await create();
    const loads = spyOn(source, 'loadCensus').and.callThrough();

    fixture.componentInstance.closureSaved();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loads).toHaveBeenCalledWith(jasmine.any(Number), jasmine.any(Date));

    fixture.componentInstance.endFollowUp('p0');
    fixture.componentInstance.closeClosure();

    expect(fixture.componentInstance.closureTarget()).toBeNull();

    loads.calls.reset();
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loads).toHaveBeenCalledWith(jasmine.any(Number), jasmine.any(Date));
  });

  describe('escolha dos pacientes do turno (?turno=1)', () => {
    const rows = (): HTMLElement[] => qa('.patient-list__tr');
    const shifts = (): ShiftSource => TestBed.inject(ShiftSource);
    const startMine = async (patientIds: string[] = []): Promise<void> => {
      const mine = await shifts().start({
        hospitalId: 1,
        professionalName: 'Michelle',
        professionalRole: 'Médico',
        startedAt: new Date().toISOString(),
      });

      await shifts().selectPatients(mine.id, patientIds);
    };
    const open = async (): Promise<void> => {
      query$.next(convertToParamMap({ turno: '1' }));
      source.result = Promise.resolve(census(3));
      fixture = TestBed.createComponent(PatientListComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      await TestBed.inject(ShiftService).refresh(1);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const flush = async (): Promise<void> => {
      fixture.detectChanges();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();
    };

    it('com o turno iniciado, mostra a escolha: tocar na linha marca e desmarca, sem abrir o paciente', async () => {
      await startMine();
      await open();

      expect(text()).toContain('Turno de trabalho');
      expect(text()).toContain('(0 escolhidos)');

      rows()[0].click();
      await flush();

      expect(text()).toContain('(1 escolhido)');
      expect(rows()[0].getAttribute('aria-selected')).toBe('true');
      expect(router.navigate).not.toHaveBeenCalled();

      rows()[0].click();
      await flush();

      expect(text()).toContain('(0 escolhidos)');
    });

    it('começa com os pacientes já gravados no turno', async () => {
      await startMine(['p1']);
      await open();

      expect(text()).toContain('(1 escolhido)');
      expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    });

    it('confirmar grava os escolhidos no turno e volta à lista normal', async () => {
      await startMine();
      await open();
      rows()[0].click();
      rows()[2].click();
      await flush();
      const confirm = qa('.patient-list__turn app-button button').find(b => b.textContent.includes('Confirmar'));

      confirm?.click();
      await flush();
      await flush();

      expect((await shifts().listActive(1))[0].patientIds).toEqual(['p0', 'p2']);
      expect(router.navigate).toHaveBeenCalledWith(['/patients'], { replaceUrl: true });
    });

    it('cancelar volta à lista normal sem gravar', async () => {
      await startMine();
      await open();
      rows()[0].click();
      qa('.patient-list__turn app-button button')
        .find(b => b.textContent.includes('Cancelar'))
        ?.click();
      await flush();

      expect((await shifts().listActive(1))[0].patientIds).toEqual([]);
      expect(router.navigate).toHaveBeenCalledWith(['/patients'], { replaceUrl: true });
    });

    it('pacientes escolhidos por outro profissional aparecem com o nome dele', async () => {
      await startMine();
      const other = await shifts().start({
        hospitalId: 1,
        professionalName: 'Dr. Bruno',
        professionalRole: 'Médico',
        startedAt: new Date().toISOString(),
      });

      await shifts().selectPatients(other.id, ['p1']);
      await open();

      expect(rows()[1].textContent).toContain('Dr. Bruno');
      expect(rows()[0].textContent).not.toContain('Dr. Bruno');
    });

    it('sem turno iniciado, ou em data anterior, a lista segue normal e tocar abre o paciente', async () => {
      await open();

      expect(text()).not.toContain('Turno de trabalho');

      rows()[0].click();

      expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p0']);

      await startMine();
      await TestBed.inject(ShiftService).refresh(1);
      fixture.componentInstance.selectDate(new Date(Date.now() - 86_400_000));
      await flush();

      expect(fixture.componentInstance.turnMode()).toBeFalse();
    });

    it('evita gravar duas vezes ao confirmar de novo enquanto grava', async () => {
      await startMine();
      await open();
      const spy = spyOn(TestBed.inject(ShiftService), 'savePatients').and.callThrough();

      void fixture.componentInstance.confirmTurn();
      void fixture.componentInstance.confirmTurn();
      await flush();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('no mobile, o card mostra se o paciente foi escolhido', async () => {
      await startMine(['p0']);
      await open();
      const labels = qa('.patient-list__cluster .patient-list__first').map(e => e.textContent.trim());

      expect(labels.some(l => l.includes('Escolhido para o turno'))).toBeTrue();
      expect(labels.some(l => l.includes('Toque para escolher'))).toBeTrue();
    });
  });

  it('usa singular com um paciente', async () => {
    source.result = Promise.resolve(census(1));
    await create();

    expect(text()).toContain('1 paciente');
    expect(text()).not.toContain('1 pacientes');
  });

  it('não conta paciente não admitido', async () => {
    source.result = Promise.resolve([...census(2), { ...census(1)[0], admissionStatus: 'NOT_ADMITTED', id: 'x' }]);
    await create();

    expect(text()).toContain('2 pacientes');
  });

  describe('finalizado no dia (FR-016/017/018)', () => {
    const finished = (n: number): CensusPatient[] =>
      census(n).map(p => ({ ...p, pendingTasks: 0, reassessmentDone: true }));

    it('mantém o finalizado na lista, em cinza e com rótulo textual, na lista e na tabela', async () => {
      source.result = Promise.resolve([...census(1), { ...census(2)[1], pendingTasks: 0, reassessmentDone: true }]);
      await create();

      expect(text()).toContain('2 pacientes');
      expect(qa('.patient-list__row--finished').length).toBe(1);
      expect(qa('.patient-list__tr--finished').length).toBe(1);
      expect(q('.patient-list__row--finished')?.textContent).toContain('Finalizado');
      expect(q('.patient-list__tr--finished')?.textContent).toContain('Finalizado');
      expect(q('.patient-list__row--finished')?.getAttribute('aria-label')).toContain('finalizado no dia');
    });

    it('com todos finalizados, todos seguem listados e não há estado vazio', async () => {
      source.result = Promise.resolve(finished(3));
      await create();

      expect(text()).toContain('3 pacientes');
      expect(qa('.patient-list__row').length).toBe(3);
      expect(text()).not.toContain('Nenhum paciente para este dia');
    });

    it('não trata paciente sem pendingTasks como finalizado', async () => {
      source.result = Promise.resolve(census(2));
      await create();

      expect(q('.patient-list__row--finished')).toBeNull();
    });

    it('toque na linha e no controle de abrir do finalizado navega ao Hub', async () => {
      source.result = Promise.resolve(finished(1));
      await create();
      q('.patient-list__row--finished')?.click();
      q('.patient-list__open')?.click();

      expect(router.navigate).toHaveBeenCalledTimes(2);
      expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p0']);
    });
  });

  it('mostra estado vazio e o botão de cadastrar abre o cadastro em painel', async () => {
    await create();
    spyOn(TestBed.inject(AiAssistantService), 'openAction');

    expect(text()).toContain('Nenhum paciente para este dia');
    q('.patient-list__register button')?.click();

    expect(TestBed.inject(AiAssistantService).openAction).toHaveBeenCalledWith(
      jasmine.objectContaining({ conversation: jasmine.anything() }),
    );
  });

  describe('atalhos de cadastro e edição (US-004-1-07)', () => {
    const actionByLabel = (label: string): ScreenAction | undefined =>
      TestBed.inject(ScreenActionsService)
        .actions()
        .find(a => a.label === label);

    it('"Cadastrar paciente" abre o cadastro conversacional da FT-002-1 no painel', async () => {
      await create();
      const assistant = TestBed.inject(AiAssistantService);

      assistant.openShortcuts();
      assistant.openAction(actionByLabel('Cadastrar paciente') as ScreenAction);

      expect(assistant.view()).toBe('conversation');
      expect(TestBed.inject(AssistantConversationService).messages()[0].text).toBe(
        'Me fale o nome completo do paciente',
      );
    });

    it('"Alterar dados de paciente" fecha o painel e navega à entrada da edição', async () => {
      await create();
      const assistant = TestBed.inject(AiAssistantService);

      assistant.openShortcuts();
      assistant.openAction(actionByLabel('Alterar dados de paciente') as ScreenAction);

      expect(assistant.isOpen()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/patients', 'edit']);
    });

    it('pedir "cadastrar paciente" ao assistente leva à mesma conversa', async () => {
      await create();
      const assistant = TestBed.inject(AiAssistantService);

      assistant.ask('quero cadastrar um paciente');

      expect(assistant.view()).toBe('conversation');
    });

    it('em data retroativa as duas ações ficam indisponíveis', async () => {
      await create();
      const day = new Date();

      day.setDate(day.getDate() - 1);
      fixture.componentInstance.selectDate(day);
      fixture.detectChanges();

      expect(actionByLabel('Cadastrar paciente')).toBeUndefined();
      expect(actionByLabel('Alterar dados de paciente')).toBeUndefined();
    });
  });

  it('mostra erro e tenta de novo', async () => {
    source.result = Promise.reject(new Error('x'));
    await create();

    expect(text()).toContain('Erro ao carregar os pacientes');
    source.result = Promise.resolve(census(2));
    q('.patient-list__state app-button button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('2 pacientes');
  });

  it('toque no card abre o paciente', async () => {
    source.result = Promise.resolve(census(1));
    await create();

    q('.patient-list__row')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p0']);
  });

  it('toque em cada card abre o paciente tocado, uma única vez, com nome acessível', async () => {
    source.result = Promise.resolve([...census(3), { ...census(1)[0], adequacy: null, id: 'sem-presc' }]);
    await create();
    const rows = Array.from(fixture.nativeElement.querySelectorAll('.patient-list__row')) as HTMLElement[];

    expect(rows.length).toBe(4);
    expect(rows.every(r => r.getAttribute('aria-label')?.startsWith('Abrir '))).toBe(true);
    const ids: string[] = [];

    for (const row of rows) {
      (router.navigate as jasmine.Spy).calls.reset();
      row.click();

      expect(router.navigate).toHaveBeenCalledTimes(1);
      ids.push(((router.navigate as jasmine.Spy).calls.mostRecent().args[0] as string[])[1]);
    }

    expect(ids.toSorted((a, b) => a.localeCompare(b))).toEqual(['p0', 'p1', 'p2', 'sem-presc']);
  });

  it('botão de seta navega uma única vez, sem propagar para a linha', async () => {
    source.result = Promise.resolve(census(2));
    await create();
    (router.navigate as jasmine.Spy).calls.reset();
    const arrows = fixture.nativeElement.querySelectorAll('.patient-list__open') as NodeListOf<HTMLElement>;

    arrows[1].click();

    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p1']);
  });

  it('ignora resposta de carga antiga', async () => {
    source.result = Promise.resolve(census(2));
    await create();
    const comp = fixture.componentInstance;
    let release!: (v: readonly CensusPatient[]) => void;

    source.result = new Promise((r: (v: readonly CensusPatient[]) => void) => (release = r));
    const slow = comp.load(1);

    source.result = Promise.resolve(census(1));
    await comp.load(1);
    release(census(5));
    await slow;

    expect(comp.patients().length).toBe(1);
  });

  describe('data retroativa (US-004-1-03)', () => {
    const labels = (): string[] =>
      TestBed.inject(ScreenActionsService)
        .actions()
        .map(a => a.label);
    const dialog = (): HTMLElement | null => q('[role="alertdialog"].confirm-dialog__panel, .confirm-dialog__panel');

    async function settle(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('abre em hoje, normal e sem alerta', async () => {
      source.result = Promise.resolve(census(2));
      await create();

      expect(fixture.componentInstance.readOnly()).toBeFalse();
      expect(dialog()).toBeNull();
    });

    it('navega direto para a data anterior, sem pedir confirmação', async () => {
      source.result = Promise.resolve(census(2));
      await create();
      const before = fixture.componentInstance.selectedDate();

      fixture.componentInstance.selectDate(yesterday());
      await settle();

      expect(dialog()).toBeNull();
      expect(fixture.componentInstance.selectedDate()).not.toBe(before);
      expect(fixture.componentInstance.readOnly()).toBeTrue();
    });

    it('ir para uma data anterior recarrega a lista, entra em somente leitura e remove as ações de escrita', async () => {
      const days: Date[] = [];

      source.loadCensus = (_?: number, day?: Date): Promise<readonly CensusPatient[]> => {
        days.push(day as Date);

        return Promise.resolve(census(2));
      };
      await create();
      fixture.componentInstance.selectDate(yesterday());
      await settle();

      expect(days.at(-1)?.getDate()).toBe(yesterday().getDate());
      expect(fixture.componentInstance.readOnly()).toBeTrue();
      expect(dialog()).toBeNull();
      expect(text()).toContain('Somente leitura');
      expect(q('.patient-list--read-only')).not.toBeNull();
      expect(q('.patient-list__register')).toBeNull();
      expect(labels()).toEqual([]);
    });

    it('em somente leitura tocar no card ainda abre o Hub', async () => {
      source.result = Promise.resolve(census(2));
      await create();
      fixture.componentInstance.selectDate(yesterday());
      await settle();
      (q('.patient-list__row') as HTMLElement).click();

      expect(router.navigate).toHaveBeenCalledWith(['/patients', jasmine.any(String)], {
        queryParams: { data: jasmine.stringMatching(/^\d{4}-\d{2}-\d{2}$/u) },
      });
    });

    it('voltar a hoje restaura o modo normal sem alerta', async () => {
      source.result = Promise.resolve(census(2));
      await create();
      fixture.componentInstance.selectDate(yesterday());
      await settle();
      fixture.componentInstance.selectDate(new Date());
      await settle();

      expect(dialog()).toBeNull();
      expect(fixture.componentInstance.readOnly()).toBeFalse();
      expect(q('.patient-list--read-only')).toBeNull();
      expect(labels().length).toBe(5);
      expect(q('.patient-list__register')).not.toBeNull();
    });
  });

  describe('atualização da localização (US-004-1-09 / FR-035, FR-036, FR-039)', () => {
    const moved = (ward: string, bed: string): readonly CensusPatient[] => census(1).map(p => ({ ...p, ward, bed }));
    const touch = (type: string, y: number): void => {
      const el = q('.patient-list') as HTMLElement;
      const t = new Touch({ identifier: 1, target: el, clientY: y });

      el.dispatchEvent(
        new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] }),
      );
    };
    const settle = async (): Promise<void> => {
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('ao receber foco busca de novo e o card mostra a nova ala/leito', async () => {
      source.result = Promise.resolve(moved('Ala 1', '1'));
      await create();
      source.result = Promise.resolve(moved('Ala 3', '12'));
      window.dispatchEvent(new Event('focus'));
      await settle();

      expect(text()).toContain('Ala 3 · Leito 12');
    });

    it('ao voltar a ficar visível busca de novo; oculto não busca', () => {
      // Regra pura: eventos reais de foco/visibilidade do runner tornam o teste com DOM intermitente no CI.
      expect(refreshesOnVisibility('visible')).toBeTrue();
      expect(refreshesOnVisibility('hidden')).toBeFalse();
    });

    it('puxar-para-atualizar traz a nova localização e mantém ordenação e data', async () => {
      source.result = Promise.resolve(moved('Ala 1', '1'));
      await create();
      fixture.componentInstance.sortBy('location');
      const date = fixture.componentInstance.selectedDate();

      source.result = Promise.resolve(moved('Ala 4', '7'));
      touch('touchstart', 10);
      touch('touchend', 200);
      await settle();

      expect(text()).toContain('Ala 4 · Leito 7');
      expect(fixture.componentInstance.sortKey()).toBe('location');
      expect(fixture.componentInstance.selectedDate()).toBe(date);
    });

    it('enquanto a lista ainda carrega, a atualização é ignorada', async () => {
      source.result = new Promise<readonly CensusPatient[]>(() => undefined);
      fixture = TestBed.createComponent(PatientListComponent);
      fixture.detectChanges();
      await fixture.componentInstance.refresh();

      expect(fixture.componentInstance.status()).toBe('loading');
    });

    it('arrasto curto não atualiza', async () => {
      source.result = Promise.resolve(moved('Ala 1', '1'));
      await create();
      source.result = Promise.resolve(moved('Ala 4', '7'));
      touch('touchstart', 10);
      touch('touchend', 50);
      await settle();

      expect(text()).not.toContain('Ala 4');
    });

    it('offline ou com erro mantém o último cache sem erro', async () => {
      source.result = Promise.resolve(moved('Ala 1', '1'));
      await create();
      const connectivity = TestBed.inject(ConnectivityService);

      connectivity.online.set(false);
      source.result = Promise.resolve(moved('Ala 4', '7'));
      await fixture.componentInstance.refresh();
      fixture.detectChanges();

      expect(text()).toContain('Ala 1 · Leito 1');
      connectivity.online.set(true);
      source.result = Promise.reject(new Error('falha'));
      await fixture.componentInstance.refresh();
      fixture.detectChanges();

      expect(text()).toContain('Ala 1 · Leito 1');
      expect(fixture.componentInstance.status()).toBe('ready');
    });
  });

  describe('swipe à direita: alteração de leito (US-004-1-09)', () => {
    const swipeRight = (row: number, to: number): void => {
      const content = fixture.nativeElement.querySelectorAll('.swipe-row__content')[row] as HTMLElement;

      content.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100 }));
      content.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: to }));
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: to }));
      fixture.detectChanges();
    };
    const bed = ['/patients', 'p0', 'change-bed'];

    it('completar o gesto navega ao fluxo de leito com o paciente do card', async () => {
      source.result = Promise.resolve(census(2));
      await create();
      (router.navigate as jasmine.Spy).calls.reset();
      swipeRight(0, 250);

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(['/patients', jasmine.stringMatching(/^p[01]$/), 'change-bed']);
    });

    it('"Alterar leito" pelo botão tem o nome do paciente e navega', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      const action = q('.swipe-row__action--start') as HTMLElement;

      expect(action.getAttribute('aria-label')).toBe('Alterar leito de Paciente 0');
      action.click();

      expect(router.navigate).toHaveBeenCalledWith(bed);
    });

    it('arrasto curto não navega', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      swipeRight(0, 120);

      expect(router.navigate).not.toHaveBeenCalledWith(bed);
    });

    it('somente leitura: sem ação e sem navegação', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      fixture.componentInstance.selectedDate.set(new Date(2020, 0, 1));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(q('.swipe-row__action--start')).toBeNull();
      fixture.componentInstance.changeBed('p0');

      expect(router.navigate).not.toHaveBeenCalledWith(bed);
    });

    it('offline: o modal abre, mas a confirmação fica indisponível com "conexão necessária"', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      TestBed.inject(ConnectivityService).online.set(false);
      fixture.componentInstance.endFollowUp('p0');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.closureTarget()?.id).toBe('p0');
      expect(q('app-follow-up-closure-sheet')?.textContent).toContain('Conexão necessária');
      const saveButton = q('app-follow-up-closure-sheet')?.querySelector<HTMLButtonElement>(
        '.closure__body ~ app-button button',
      );

      expect(saveButton?.disabled).toBeTrue();
    });

    it('endFollowUp com paciente inexistente na lista não abre nada', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      fixture.componentInstance.endFollowUp('inexistente');

      expect(fixture.componentInstance.closureTarget()).toBeNull();
    });

    it('offline, a lista segue exibida e o toque no card ainda abre o Hub', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      TestBed.inject(ConnectivityService).online.set(false);
      q('.patient-list__row')?.click();

      expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p0']);
    });

    it('paciente com encerramento já efetivado não aparece e some da contagem', async () => {
      source.result = Promise.resolve([...census(2), { ...census(1)[0], followUpEndDate: '2020-01-01', id: 'enc' }]);
      await create();

      expect(text()).toContain('2 pacientes');
    });
  });

  describe('comando de IA no painel de Atalhos (US-004-1-06)', () => {
    const settle = async (): Promise<void> => {
      await new Promise(resolve => setTimeout(resolve));
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('encaminha texto e áudio à porta da IA sem alterar lista nem ordenação', async () => {
      source.result = Promise.resolve(census(3));
      await create();
      const assistant = TestBed.inject(AiAssistantService);
      const sort = TestBed.inject(ScreenActionsService).sort();
      const activeBefore = sort?.active();
      const names = (): string[] => qa('.patient-list__row').map(r => r.textContent ?? '');
      const before = names();
      const audio = new Blob(['x']);

      assistant.ask('apenas NP');
      assistant.ask('por prioridade');
      assistant.askAudio(audio);
      await settle();

      expect(ai.sent).toEqual([
        { kind: 'text', text: 'apenas NP' },
        { kind: 'text', text: 'por prioridade' },
        { audio, kind: 'audio' },
      ]);

      expect(names()).toEqual(before);
      expect(sort?.active()).toBe(activeBefore ?? null);
    });

    it('com a IA fora, a lista, o toque no card e a ordenação continuam funcionando', async () => {
      source.result = Promise.resolve(census(3));
      await create();
      ai.fail = true;
      const assistant = TestBed.inject(AiAssistantService);

      assistant.ask('apenas NP');
      await settle();

      expect(assistant.conversation()?.status).toBe('failed');
      expect(assistant.conversation()?.answer?.summary).toBe('IA indisponível no momento.');
      expect(qa('.patient-list__row').length).toBe(3);
      TestBed.inject(ScreenActionsService).sort()?.select('bed');
      await settle();

      expect(TestBed.inject(ScreenActionsService).sort()?.active()).toBe('bed');
      ai.fail = false;
      assistant.retry('apenas NP');
      await settle();

      expect(assistant.conversation()?.status).toBe('answered');
      expect(ai.sent.length).toBe(2);
    });

    it('em modo somente leitura o encaminhamento continua permitido', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      fixture.componentInstance.selectDate(new Date(Date.now() - 86_400_000));
      fixture.detectChanges();

      TestBed.inject(AiAssistantService).ask('só do convênio');
      await settle();

      expect(ai.sent.length).toBe(1);
    });
  });

  it('lembra a data da lista: ao voltar do detalhe, a lista reabre na última data escolhida', async () => {
    source.result = Promise.resolve(census(2));
    await create();
    const d = new Date();

    d.setDate(d.getDate() - 3);
    fixture.componentInstance.selectDate(d);
    fixture.destroy();
    await create();

    expect(fixture.componentInstance.selectedDate().toDateString()).toBe(d.toDateString());
    expect(fixture.componentInstance.readOnly()).toBeTrue();
  });
});
