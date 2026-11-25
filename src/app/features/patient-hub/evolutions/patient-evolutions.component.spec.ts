import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NOW } from '../../home/professional-profile';
import { DailyEvolutionSource } from '../daily-record/daily-evolution-source';
import { DailyEvolution } from '../daily-record/daily-record.models';
import {
  EVOLUTIONS_EMPTY_TEXT,
  EVOLUTIONS_LOAD_FAILED_HINT,
  EVOLUTIONS_WINDOW_DAYS,
  PatientEvolutionsComponent,
} from './patient-evolutions.component';

class FakeSource extends DailyEvolutionSource {
  /** Evolução por dia (`aaaa-mm-dd`); dia ausente = sem evolução. */
  byDay: Record<string, DailyEvolution> = {};
  fails = false;
  /** Só o dia indicado falha (as demais leituras seguem). */
  failsOn: string | null = null;
  readonly loaded: string[] = [];

  load(patientId: string, day: string): Promise<DailyEvolution | null> {
    this.loaded.push(`${patientId}|${day}`);
    if (this.fails || day === this.failsOn) {
      return Promise.reject(new Error('x'));
    }

    return Promise.resolve(this.byDay[day] ?? null);
  }

  save(): Promise<DailyEvolution> {
    return Promise.reject(new Error('não usado'));
  }
}

const evolution = (day: number, text: string, extra: Partial<DailyEvolution> = {}): DailyEvolution => ({
  at: new Date(2026, 4, day, 13, 33).toISOString(),
  author: 'Rafael Dutra Rabello Duarte',
  origin: 'manual',
  text,
  ...extra,
});

describe('PatientEvolutionsComponent', () => {
  let fixture: ComponentFixture<PatientEvolutionsComponent>;
  let source: FakeSource;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent.replace(/\s+/gu, ' ');
  const cards = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('[data-testid="evolution-card"]'));
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    source = new FakeSource();
    TestBed.configureTestingModule({
      providers: [
        { provide: DailyEvolutionSource, useValue: source },
        { provide: NOW, useValue: (): Date => new Date(2026, 4, 28, 12, 0) },
      ],
    });
    fixture = TestBed.createComponent(PatientEvolutionsComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('day', new Date(2026, 4, 28));
  });

  it('sem nenhuma evolução, avisa em texto; lê os últimos dias a partir de hoje', async () => {
    await settle();

    expect(text()).toContain(EVOLUTIONS_EMPTY_TEXT);
    expect(source.loaded.length).toBe(EVOLUTIONS_WINDOW_DAYS);
    expect(source.loaded[0]).toBe('p1|2026-05-28');
    expect(source.loaded[1]).toBe('p1|2026-05-27');
  });

  it('lista as evoluções da mais recente para a mais antiga, ignorando os dias sem registro', async () => {
    source.byDay = {
      '2026-05-24': evolution(24, 'Terceira.'),
      '2026-05-26': evolution(26, 'Segunda.'),
      '2026-05-28': evolution(28, 'Primeira.'),
    };
    await settle();

    expect(cards().map(c => c.dataset['day'])).toEqual(['2026-05-28', '2026-05-26', '2026-05-24']);
    expect(text()).not.toContain(EVOLUTIONS_EMPTY_TEXT);
  });

  it('mostra a evolução com os itens a reavaliar: vencida e dentro do prazo, sempre com texto', async () => {
    source.byDay['2026-05-26'] = evolution(26, 'Paciente em uso de GTT.', {
      reevaluations: [
        { dueAt: new Date(2026, 4, 28, 9, 0).toISOString(), id: 'r1', name: 'Diarreia' },
        { dueAt: new Date(2026, 4, 30, 9, 0).toISOString(), id: 'r2', name: 'Erosão da mucosa nasolabial' },
      ],
    });
    await settle();
    const tags = Array.from(el().querySelectorAll('[data-testid="reevaluation-status"]')).map(t =>
      t.textContent.trim(),
    );

    expect(text()).toContain('Rafael Dutra Rabello Duarte');
    expect(text()).toContain('26/05 às 13:33');
    expect(text()).toContain('Paciente em uso de GTT.');
    expect(text()).toContain('Avaliar');
    expect(text()).toContain('Diarreia');
    expect(text()).toContain('Última avaliação 26/05');
    expect(tags).toEqual(['Vencida', 'Prazo 30/05']);
    expect(el().querySelector('.evo__tag--overdue')).not.toBeNull();
  });

  it('evolução sem itens a reavaliar não mostra a lista "Avaliar"', async () => {
    source.byDay['2026-05-28'] = evolution(28, 'Estável.');
    await settle();

    expect(text()).toContain('Estável.');
    expect(el().querySelector('.evo__list')).toBeNull();
  });

  it('falha em todas as leituras informa em texto', async () => {
    source.fails = true;
    await settle();

    expect(text()).toContain(EVOLUTIONS_LOAD_FAILED_HINT);
  });

  it('falha em um só dia mantém as demais evoluções', async () => {
    source.byDay['2026-05-28'] = evolution(28, 'Primeira.');
    source.failsOn = '2026-05-27';
    await settle();

    expect(cards().length).toBe(1);
    expect(text()).not.toContain(EVOLUTIONS_LOAD_FAILED_HINT);
  });

  it('a chave de atualização lê as evoluções de novo', async () => {
    await settle();
    fixture.componentRef.setInput('refreshKey', 1);
    await settle();

    expect(source.loaded.length).toBe(EVOLUTIONS_WINDOW_DAYS * 2);
  });

  describe('rolagem e faixa de datas', () => {
    const box = (): HTMLElement => el().querySelector('.evo') as HTMLElement;

    beforeEach(async () => {
      for (const d of [28, 27, 26, 25]) {
        source.byDay[`2026-05-${d}`] = evolution(d, `Evolução do dia ${d}.`);
      }
      el().style.setProperty('--evo-max-height', '160px');
      document.body.appendChild(el());
      await settle();
    });

    afterEach(() => el().remove());

    it('escolher um dia na faixa rola até a evolução dele', async () => {
      fixture.componentRef.setInput('day', new Date(2026, 4, 25));
      await settle();
      // a última evolução não alcança o topo (falta conteúdo abaixo), mas a lista rolou até ela
      expect(box().scrollTop).toBeGreaterThan(0);
    });

    it('dia sem evolução leva à evolução anterior mais próxima', async () => {
      source.byDay = {};
      source.byDay['2026-05-28'] = evolution(28, 'A.');
      source.byDay['2026-05-24'] = evolution(24, 'B.');
      source.byDay['2026-05-23'] = evolution(23, 'C.');
      source.byDay['2026-05-22'] = evolution(22, 'D.');
      fixture.componentRef.setInput('refreshKey', 1);
      await settle();
      fixture.componentRef.setInput('day', new Date(2026, 4, 26));
      await settle();
      const target = cards().find(c => c.dataset['day'] === '2026-05-24') as HTMLElement;

      expect(Math.abs(target.getBoundingClientRect().top - box().getBoundingClientRect().top)).toBeLessThan(8);
    });

    it('ao rolar, a evolução que chega ao topo vira o dia escolhido, sem rolar de volta', async () => {
      const emitted: Date[] = [];

      fixture.componentInstance.dayChange.subscribe(d => emitted.push(d));
      const target = cards().find(c => c.dataset['day'] === '2026-05-26') as HTMLElement;

      box().scrollTop += target.getBoundingClientRect().top - box().getBoundingClientRect().top;
      box().dispatchEvent(new Event('scroll'));
      await settle();

      expect(emitted.length).toBe(1);
      expect(emitted[0].getDate()).toBe(26);

      // a tela devolve o dia escolhido pela rolagem: a lista não se mexe
      const before = box().scrollTop;

      fixture.componentRef.setInput('day', emitted[0]);
      await settle();

      expect(box().scrollTop).toBe(before);
    });

    it('rolar sem mudar a evolução do topo não avisa de novo', async () => {
      const emitted: Date[] = [];

      fixture.componentInstance.dayChange.subscribe(d => emitted.push(d));
      box().dispatchEvent(new Event('scroll'));
      await settle();

      expect(emitted).toEqual([]);
    });
  });
});
