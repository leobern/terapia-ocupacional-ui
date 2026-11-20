import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { ScreenActionsService } from '../../shared/services/screen-actions.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { UnreadNotificationsReader } from '../home/unread-notifications-reader';
import { PatientListComponent } from './patient-list.component';
import { CensusPatient } from './patient-list.models';
import { PatientListSource } from './patient-list-source';

const census = (n: number, name = 'Paciente'): CensusPatient[] =>
  Array.from({ length: n }, (_, i) => ({
    adequacy: { caloric: 80, protein: 70 },
    admissionStatus: 'ADMITTED_BY_EMTN',
    bed: String(i + 1),
    birthDate: '1980-01-01',
    completedCycles: i === 1 ? 0 : 1,
    hospitalId: 'h1',
    id: `p${i}`,
    name: `${name} ${i}`,
    registeredInConductia: true,
    therapy: i === 0 ? 'MISTA' : 'NE',
    therapyStartDate: '2026-01-01',
    ward: 'Ala 1',
  }));

class FakeSource extends PatientListSource {
  result: Promise<readonly CensusPatient[]> = Promise.resolve([]);
  loadCensus(_?: string, __?: Date): Promise<readonly CensusPatient[]> {
    return this.result;
  }
}

describe('PatientListComponent', () => {
  let source: FakeSource;
  let fixture: ComponentFixture<PatientListComponent>;
  let router: Router;

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

  beforeEach(() => {
    source = new FakeSource();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PatientListSource, useValue: source },
        { provide: UnreadNotificationsReader, useValue: { countUnread: (): Promise<number> => Promise.resolve(2) } },
        {
          provide: LinkedHospitalsReader,
          useValue: { read: (): { id: string; name: string }[] => [{ id: 'h1', name: 'Hospital Um' }] },
        },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
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
    expect(text()).not.toContain('01/01/1980');
    expect(fixture.nativeElement.querySelectorAll('.patient-list__row').length).toBe(3);
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

    source.loadCensus = (_?: string, day?: Date): Promise<readonly CensusPatient[]> => {
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
    (document.querySelectorAll('.confirm-dialog__actions button')[1] as HTMLElement).click();
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
    expect(q('.patient-list__title ph-icon i')?.className).toContain('ph-bold');
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

    expect(titles).toEqual(['Fora da meta2', 'Dentro da meta3']);
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

    it('a tag mostra o critério ativo, abre o painel e aparece também carregando', async () => {
      const tag = (): string => q('.patient-list__sort-tag')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

      expect(tag()).toBe('Ordenar: prioridade');

      sort()?.select('bed');
      fixture.detectChanges();

      expect(tag()).toBe('Ordenar: leito');

      q('.patient-list__sort-tag')?.click();

      expect(TestBed.inject(AiAssistantService).view()).toBe('shortcuts');

      source.result = new Promise<readonly CensusPatient[]>(() => undefined);
      fixture.componentInstance.selectDate(new Date(Date.now() - 86_400_000));
      fixture.componentInstance.confirmPendingDate();
      fixture.detectChanges();

      expect(q('.patient-list__skeleton')).not.toBeNull();
      expect(tag()).toBe('Ordenar: leito');
    });

    it('padrão: por prioridade (Fora/Dentro da meta), como no Figma, com o chip selecionado', () => {
      expect(titles()).toEqual(['Fora da meta1', 'Dentro da meta3']);
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

      expect(titles()).toEqual(['Fora da meta1', 'Dentro da meta3']);
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

    it('persiste ao trocar a data e cancelar o alerta não altera o critério', async () => {
      const yesterday = new Date(Date.now() - 86_400_000);

      sort()?.select('priority');
      fixture.componentInstance.selectDate(yesterday);
      fixture.componentInstance.cancelPendingDate();

      expect(sort()?.active()).toBe('priority');

      fixture.componentInstance.selectDate(yesterday);
      fixture.componentInstance.confirmPendingDate();
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
      fixture.componentInstance.confirmPendingDate();
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
        first: 170,
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
        first: 170,
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

    it('começa ordenada por localização, crescente (ala e leito numérico), com a seta na coluna', () => {
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

  it('registra as ações principais da tela nos atalhos', async () => {
    await create();

    expect(
      TestBed.inject(ScreenActionsService)
        .actions()
        .map(a => a.label),
    ).toEqual(['Cadastrar paciente', 'Editar paciente', 'Encerrar acompanhamento', 'Alterar leito']);
  });

  it('tabela desktop: colunas sem data de nascimento, metas com texto e clique na linha abre o Hub', async () => {
    source.result = Promise.resolve([...census(2), { ...census(1)[0], adequacy: null, id: 'n' }]);
    await create();
    const heads = Array.from(fixture.nativeElement.querySelectorAll('th')).map(th =>
      (th as HTMLElement).textContent?.trim(),
    );

    expect(heads).toContain('Adequação calórica');
    expect(text()).toContain('80% · na meta');
    expect(text()).toContain('Indisponível');
    expect(text()).not.toContain('01/01/1980');
    q('.patient-list__tr')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p0']);
    (fixture.nativeElement.querySelector('.patient-list__open') as HTMLElement).click();

    expect(router.navigate).toHaveBeenCalledTimes(2);
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
    const finished = (n: number): CensusPatient[] => census(n).map(p => ({ ...p, pendingTasks: 0 }));

    it('mantém o finalizado na lista, em cinza e com rótulo textual, na lista e na tabela', async () => {
      source.result = Promise.resolve([...census(1), { ...census(2)[1], pendingTasks: 0 }]);
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

  it('mostra estado vazio e o botão de cadastrar apenas navega', async () => {
    await create();

    expect(text()).toContain('Nenhum paciente para este dia');
    q('.patient-list__register button')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
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
    const slow = comp.load('h1');

    source.result = Promise.resolve(census(1));
    await comp.load('h1');
    release(census(5));
    await slow;

    expect(comp.patients().length).toBe(1);
  });

  describe('data retroativa (US-004-1-03)', () => {
    const yesterday = (): Date => {
      const d = new Date();

      d.setDate(d.getDate() - 1);

      return d;
    };
    const labels = (): string[] =>
      TestBed.inject(ScreenActionsService)
        .actions()
        .map(a => a.label);
    const dialog = (): HTMLElement | null => q('[role="alertdialog"].confirm-dialog__panel, .confirm-dialog__panel');
    const buttons = (): HTMLButtonElement[] =>
      Array.from(dialog()?.querySelectorAll('button') ?? []) as HTMLButtonElement[];

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

    it('pede confirmação antes de aplicar e não muda data nem lista enquanto aberto', async () => {
      source.result = Promise.resolve(census(2));
      await create();
      const before = fixture.componentInstance.selectedDate();

      fixture.componentInstance.selectDate(yesterday());
      await settle();

      expect(dialog()).not.toBeNull();
      expect(dialog()?.textContent).toContain(`Ver o dia ${yesterday().getDate()} de`);
      expect(dialog()?.textContent).toContain('somente para leitura, em preto e branco');
      expect(fixture.componentInstance.selectedDate()).toBe(before);
      expect(fixture.componentInstance.readOnly()).toBeFalse();
    });

    it('confirmar recarrega a lista da data, entra em somente leitura e remove as ações de escrita', async () => {
      const days: Date[] = [];

      source.loadCensus = (_?: string, day?: Date): Promise<readonly CensusPatient[]> => {
        days.push(day as Date);

        return Promise.resolve(census(2));
      };
      await create();
      fixture.componentInstance.selectDate(yesterday());
      await settle();
      buttons()[1].click();
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
      fixture.componentInstance.confirmPendingDate();
      await settle();
      (q('.patient-list__row') as HTMLElement).click();

      expect(router.navigate).toHaveBeenCalledWith(['/patients', jasmine.any(String)]);
    });

    it('cancelar (botão ou Esc) mantém tudo como estava', async () => {
      source.result = Promise.resolve(census(2));
      await create();
      fixture.componentInstance.selectDate(yesterday());
      await settle();
      buttons()[0].click();
      await settle();

      expect(dialog()).toBeNull();
      expect(fixture.componentInstance.readOnly()).toBeFalse();
      expect(labels().length).toBe(4);

      fixture.componentInstance.selectDate(yesterday());
      await settle();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();

      expect(dialog()).toBeNull();
      expect(fixture.componentInstance.readOnly()).toBeFalse();
    });

    it('voltar a hoje restaura o modo normal sem alerta', async () => {
      source.result = Promise.resolve(census(2));
      await create();
      fixture.componentInstance.selectDate(yesterday());
      fixture.componentInstance.confirmPendingDate();
      await settle();
      fixture.componentInstance.selectDate(new Date());
      await settle();

      expect(dialog()).toBeNull();
      expect(fixture.componentInstance.readOnly()).toBeFalse();
      expect(q('.patient-list--read-only')).toBeNull();
      expect(labels().length).toBe(4);
      expect(q('.patient-list__register')).not.toBeNull();
    });

    it('confirmar sem data pendente não faz nada e Esc sem alerta é ignorado', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      fixture.componentInstance.confirmPendingDate();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(fixture.componentInstance.readOnly()).toBeFalse();
    });
  });

  describe('swipe à esquerda: encerramento (US-004-1-08)', () => {
    const swipe = (row: number, to: number): void => {
      const content = fixture.nativeElement.querySelectorAll('.swipe-row__content')[row] as HTMLElement;

      content.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300 }));
      content.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: to }));
      content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: to }));
      fixture.detectChanges();
    };

    it('completar o gesto navega ao fluxo de encerramento com o paciente do card', async () => {
      source.result = Promise.resolve(census(2));
      await create();
      (router.navigate as jasmine.Spy).calls.reset();
      swipe(0, 150);

      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(['/patients', jasmine.stringMatching(/^p[01]$/), 'end-follow-up']);
    });

    it('acionar "Encerrar" pelo botão (teclado) navega e tem o nome do paciente', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      const action = q('.swipe-row__action') as HTMLElement;

      expect(action.getAttribute('aria-label')).toBe('Encerrar acompanhamento de Paciente 0');
      action.click();

      expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p0', 'end-follow-up']);
    });

    it('soltar antes do limite não navega', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      swipe(0, 280);

      expect(router.navigate).not.toHaveBeenCalledWith(['/patients', 'p0', 'end-follow-up']);
    });

    it('em modo somente leitura não há swipe nem ação, e a lista não mostra modal', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      fixture.componentInstance.pendingDate.set(null);
      fixture.componentInstance.selectedDate.set(new Date(2020, 0, 1));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(q('.swipe-row__action')).toBeNull();
      expect(q('[role="dialog"]')).toBeNull();
      fixture.componentInstance.endFollowUp('p0');

      expect(router.navigate).not.toHaveBeenCalledWith(['/patients', 'p0', 'end-follow-up']);
    });

    it('offline: não navega e avisa "conexão necessária"; ao voltar online navega', async () => {
      source.result = Promise.resolve(census(1));
      await create();
      const connectivity = TestBed.inject(ConnectivityService);

      connectivity.online.set(false);
      swipe(0, 150);

      expect(router.navigate).not.toHaveBeenCalledWith(['/patients', 'p0', 'end-follow-up']);
      expect(q('[role="status"]')?.textContent).toContain('Conexão necessária');
      connectivity.online.set(true);
      swipe(0, 150);
      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p0', 'end-follow-up']);
      expect(q('[role="status"]')?.textContent?.trim()).toBe('');
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
});
