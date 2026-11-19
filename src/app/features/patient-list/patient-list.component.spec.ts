import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
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

  it('agrupa em Fora da meta e Dentro da meta com contagem e mostra no subtítulo', async () => {
    source.result = Promise.resolve([
      ...census(2),
      { ...census(1)[0], adequacy: { caloric: 10, protein: 60 }, id: 'out1', name: 'Crítico Um' },
      { ...census(1)[0], adequacy: { caloric: 30, protein: null }, id: 'out2' },
      { ...census(1)[0], adequacy: null, id: 'none' },
    ]);
    await create();
    const titles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.patient-list__section-title'),
    ).map(t => t.textContent?.replace(/\s+/g, ' ').trim());

    expect(titles).toEqual(['Fora da meta2', 'Dentro da meta3']);
    expect(text()).toContain('2 fora da meta');
    // o mais crítico (10%) vem primeiro
    expect((q('.patient-list__cluster .patient-list__row') as HTMLElement).textContent).toContain('Crítico Um');
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
});
