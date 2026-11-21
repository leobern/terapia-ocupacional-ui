import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfile, ProfessionalProfileReader } from '../../home/professional-profile';
import { DailyEvolutionSource } from './daily-evolution-source';
import { DailyEvolution, EvolutionSaveRequest } from './daily-record.models';
import {
  DailyRecordSectionComponent,
  EVOLUTION_EMPTY_TEXT,
  EVOLUTION_LOAD_FAILED_HINT,
  EVOLUTION_OFFLINE_HINT,
  EVOLUTION_SAVE_FAILED_HINT,
} from './daily-record-section.component';

class FakeSource extends DailyEvolutionSource {
  current: DailyEvolution | null = null;
  loadFails = false;
  saveFails = false;
  readonly saves: EvolutionSaveRequest[] = [];
  loadedDays: string[] = [];

  load(patientId: string, day: string): Promise<DailyEvolution | null> {
    this.loadedDays.push(`${patientId}|${day}`);

    return this.loadFails ? Promise.reject(new Error('x')) : Promise.resolve(this.current);
  }

  save(request: EvolutionSaveRequest): Promise<DailyEvolution> {
    if (this.saveFails) {
      return Promise.reject(new Error('x'));
    }
    this.saves.push(request);
    this.current = { author: request.author, at: request.at, origin: request.origin, text: request.text };

    return Promise.resolve(this.current);
  }
}

describe('DailyRecordSectionComponent', () => {
  let fixture: ComponentFixture<DailyRecordSectionComponent>;
  let source: FakeSource;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent.replace(/\s+/gu, ' ');
  const area = (): HTMLTextAreaElement | null => el().querySelector('textarea');
  const saveButton = (): HTMLButtonElement | null =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes('Salvar registro')) ?? null;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const openIt = async (): Promise<void> => {
    (el().querySelector('.record__row') as HTMLButtonElement).click();
    await settle();
  };
  const type = async (value: string): Promise<void> => {
    const a = area() as HTMLTextAreaElement;

    a.value = value;
    a.dispatchEvent(new Event('input'));
    await settle();
  };
  const save = async (): Promise<void> => {
    saveButton()?.click();
    await settle();
  };
  const setup = async (role: ProfessionalProfile['role']): Promise<void> => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DailyEvolutionSource, useValue: source },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): ProfessionalProfile => ({ name: 'Dra. Ana', role }) },
        },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 20, 15, 30) },
      ],
    });
    fixture = TestBed.createComponent(DailyRecordSectionComponent);
    fixture.componentRef.setInput('patientId', 'p9');
    await settle();
  };

  beforeEach(() => {
    source = new FakeSource();
  });

  describe('médico', () => {
    beforeEach(async () => {
      await setup('doctor');
    });

    it('digita e salva: vira a evolução do dia, com autor e data/hora', async () => {
      await openIt();
      await type('  Paciente estável.  ');
      await save();

      expect(source.saves).toEqual([
        {
          at: new Date(2026, 10, 20, 15, 30).toISOString(),
          author: 'Dra. Ana',
          day: '2026-11-20',
          origin: 'manual',
          patientId: 'p9',
          text: 'Paciente estável.',
        },
      ]);

      expect(text()).toContain('Registrada por Dra. Ana · 20/11 às 15:30');
      expect(area()?.value).toBe('Paciente estável.');
    });

    it('sem texto, salvar fica desabilitado (sem parâmetros assistenciais envolvidos)', async () => {
      await openIt();

      expect(saveButton()?.disabled).toBe(true);
      await type('   ');

      expect(saveButton()?.disabled).toBe(true);
      await type('ok');

      expect(saveButton()?.disabled).toBe(false);
    });

    it('edita a evolução já registrada; o novo salvamento carrega autor e data/hora', async () => {
      source.current = {
        author: 'Dr. Beto',
        at: new Date(2026, 10, 20, 8, 0).toISOString(),
        origin: 'manual',
        text: 'antes',
      };
      await openIt();

      expect(area()?.value).toBe('antes');
      expect(text()).toContain('Registrada por Dr. Beto · 20/11 às 08:00');
      await type('depois');
      await save();

      expect(source.saves[0]).toEqual(jasmine.objectContaining({ author: 'Dra. Ana', text: 'depois' }));
      expect(text()).toContain('Registrada por Dra. Ana');
    });

    it('falha ao salvar: avisa e mantém o texto', async () => {
      source.saveFails = true;
      await openIt();
      await type('texto');
      await save();

      expect(text()).toContain(EVOLUTION_SAVE_FAILED_HINT);
      expect(area()?.value).toBe('texto');
      expect(el().querySelector('[data-testid="evolution-meta"]')).toBeNull();
    });

    it('falha ao carregar: avisa e o registro manual segue possível', async () => {
      source.loadFails = true;
      await openIt();

      expect(text()).toContain(EVOLUTION_LOAD_FAILED_HINT);
      await type('manual');

      expect(saveButton()?.disabled).toBe(false);
    });

    it('offline: digita, vê a pendência em texto e não salva até haver conexão', async () => {
      const connectivity = TestBed.inject(ConnectivityService);

      connectivity.online.set(false);
      await openIt();
      await type('sem rede');

      expect(text()).toContain(EVOLUTION_OFFLINE_HINT);
      expect(saveButton()?.disabled).toBe(true);
      expect(source.saves).toEqual([]);
      connectivity.online.set(true);
      await settle();

      expect(saveButton()?.disabled).toBe(false);
      await save();

      expect(source.saves).toHaveSize(1);
    });

    it('não sobrescreve o que foi digitado enquanto a leitura chega', async () => {
      const resolvers: ((value: DailyEvolution | null) => void)[] = [];

      source.load = (): Promise<DailyEvolution | null> =>
        new Promise(resolve => {
          resolvers.push(resolve);
        });
      await openIt();
      await type('digitado');
      resolvers[0]({ author: 'x', at: new Date().toISOString(), origin: 'manual', text: 'servidor' });
      await settle();

      expect(area()?.value).toBe('digitado');
    });

    it('fechar descarta respostas pendentes e reabrir recarrega', async () => {
      await openIt();
      (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
      await settle();

      expect(el().querySelector('dialog')?.open).toBe(false);
      await openIt();

      expect(source.loadedDays).toEqual(['p9|2026-11-20', 'p9|2026-11-20']);
    });

    it('Esc e clique no scrim fecham o diálogo; salvar sem condição é ignorado', async () => {
      await openIt();
      const dialog = el().querySelector('dialog') as HTMLDialogElement;

      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      await settle();

      expect(dialog.open).toBe(false);
      await openIt();
      dialog.click();
      await settle();

      expect(dialog.open).toBe(false);
      await openIt();
      el().querySelector<HTMLElement>('.record__body')?.click();

      expect(dialog.open).toBe(true);
    });
  });

  describe('profissional que não é médico', () => {
    beforeEach(async () => {
      await setup('other');
    });

    it('vê o estado vazio e não tem ação de registrar/editar', async () => {
      await openIt();

      expect(text()).toContain(EVOLUTION_EMPTY_TEXT);
      expect(area()).toBeNull();
      expect(saveButton()).toBeNull();
    });

    it('vê a evolução registrada com autor e data/hora, sem edição', async () => {
      source.current = {
        author: 'Dr. Beto',
        at: new Date(2026, 10, 20, 8, 0).toISOString(),
        origin: 'manual',
        text: 'Estável',
      };
      await openIt();

      expect(el().querySelector('[data-testid="evolution-text"]')?.textContent).toContain('Estável');
      expect(text()).toContain('Registrada por Dr. Beto · 20/11 às 08:00');
      expect(area()).toBeNull();
      expect(saveButton()).toBeNull();
    });
  });
});
