import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { InputChatComponent } from '../../../shared/components/input-chat/input-chat.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfile, ProfessionalProfileReader } from '../../home/professional-profile';
import {
  DailyEvolutionComponent,
  EVOLUTION_AI_EMPTY_HINT,
  EVOLUTION_AI_FAILED_HINT,
  EVOLUTION_AI_UNAVAILABLE_HINT,
  EVOLUTION_EMPTY_TEXT,
  EVOLUTION_LOAD_FAILED_HINT,
  EVOLUTION_MIC_DENIED_HINT,
  EVOLUTION_MIC_FAILED_HINT,
  EVOLUTION_OFFLINE_HINT,
  EVOLUTION_SAVE_FAILED_HINT,
} from './daily-evolution.component';
import { DailyEvolutionSource } from './daily-evolution-source';
import { DailyEvolution, EvolutionSaveRequest } from './daily-record.models';
import { EvolutionAiStructurer } from './evolution-ai-structurer';

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
    this.current = {
      author: request.author,
      at: request.at,
      origin: request.origin,
      reevaluations: request.reevaluations,
      text: request.text,
    };

    return Promise.resolve(this.current);
  }
}

class FakeAi extends EvolutionAiStructurer {
  result: Promise<string> = Promise.resolve('Texto sugerido pela IA.');
  readonly calls: Blob[] = [];

  suggest(audio: Blob): Promise<string> {
    this.calls.push(audio);

    return this.result;
  }
}

describe('DailyEvolutionComponent', () => {
  let ai: FakeAi;
  let fixture: ComponentFixture<DailyEvolutionComponent>;
  let source: FakeSource;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent.replace(/\s+/gu, ' ');
  const area = (): HTMLTextAreaElement | null => el().querySelector('textarea');
  const saveButton = (): HTMLButtonElement | null =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes('Salvar evolução')) ?? null;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const openIt = async (): Promise<void> => {
    fixture.componentRef.setInput('open', true);
    await settle();
  };
  const closeIt = async (): Promise<void> => {
    fixture.componentRef.setInput('open', false);
    await settle();
  };
  const type = async (value: string): Promise<void> => {
    const a = area() as HTMLTextAreaElement;

    a.value = value;
    a.dispatchEvent(new Event('input'));
    await settle();
  };
  const chat = (): InputChatComponent | undefined =>
    fixture.debugElement.query(By.directive(InputChatComponent))?.componentInstance as InputChatComponent | undefined;
  const send = async (): Promise<void> => {
    chat()?.audioSend.emit(new Blob(['x']));
    await settle();
  };
  const buttonByLabel = (label: string): HTMLButtonElement | null =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes(label)) ?? null;
  const save = async (): Promise<void> => {
    saveButton()?.click();
    await settle();
  };
  const setup = async (role: ProfessionalProfile['role']): Promise<void> => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DailyEvolutionSource, useValue: source },
        { provide: EvolutionAiStructurer, useValue: ai },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): ProfessionalProfile => ({ name: 'Dra. Ana', role }) },
        },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 20, 15, 30) },
      ],
    });
    fixture = TestBed.createComponent(DailyEvolutionComponent);
    fixture.componentRef.setInput('patientId', 'p9');
    await settle();
  };

  beforeEach(() => {
    source = new FakeSource();
    ai = new FakeAi();
  });

  describe('médico', () => {
    beforeEach(async () => {
      await setup('doctor');
    });

    describe('embutida na sidebar de Evolução', () => {
      beforeEach(async () => {
        fixture.componentRef.setInput('embedded', true);
        await openIt();
      });

      it('não tem campo de mensagem, botões nem texto de ajuda próprios', () => {
        expect(chat()).toBeUndefined();
        expect(saveButton()).toBeNull();
        expect(text()).not.toContain('Só médico registra');
        expect(area()).not.toBeNull();
      });

      it('save() grava e devolve true; sem texto devolve false; falha aparece em texto', async () => {
        const evolution = fixture.componentInstance;

        expect(await evolution.save()).toBeFalse();
        await type('Estável');

        expect(await evolution.save()).toBeTrue();
        source.saveFails = true;
        await type('Outra');

        expect(await evolution.save()).toBeFalse();
        await settle();

        expect(text()).toContain('Não foi possível salvar a evolução');
      });
    });

    describe('avaliar de novo', () => {
      const rowsEls = (): HTMLElement[] =>
        Array.from(el().querySelectorAll<HTMLElement>('[data-testid="reevaluation-row"]'));
      const fill = async (row: HTMLElement, name: string, amount: string, unit: string): Promise<void> => {
        const nameInput = row.querySelector('input[type="text"]') as HTMLInputElement;
        const amountInput = row.querySelector('input[type="number"]') as HTMLInputElement;
        const unitSelect = row.querySelector('select') as HTMLSelectElement;

        nameInput.value = name;
        nameInput.dispatchEvent(new Event('input'));
        amountInput.value = amount;
        amountInput.dispatchEvent(new Event('input'));
        unitSelect.value = unit;
        unitSelect.dispatchEvent(new Event('change'));
        await settle();
      };

      it('texto igual ao já gravado não é gravado de novo; com item a reavaliar grava só as reavaliações', async () => {
        source.current = {
          author: 'Dr. Beto',
          at: new Date(2026, 10, 20, 8, 0).toISOString(),
          origin: 'manual',
          text: 'antes',
        };
        await openIt();

        expect(saveButton()?.disabled).toBe(true);
        buttonByLabel('Adicionar avaliação')?.click();
        await settle();
        const [row] = rowsEls();

        await fill(row, 'Diarreia', '48', 'hours');
        expect(saveButton()?.disabled).toBe(false);
        await save();

        expect(source.saves[0]).toEqual(jasmine.objectContaining({ text: 'antes', textUnchanged: true }));
      });

      it('anota o que reavaliar e daqui a quanto tempo; o prazo conta a partir do registro', async () => {
        await openIt();
        await type('Paciente com diarreia.');
        buttonByLabel('Adicionar avaliação')?.click();
        await settle();
        buttonByLabel('Adicionar avaliação')?.click();
        await settle();
        const [first, second] = rowsEls();

        await fill(first, 'Diarreia', '48', 'hours');
        await fill(second, 'Erosão da mucosa nasolabial', '3', 'days');
        await save();

        expect(source.saves[0].reevaluations).toEqual([
          {
            dueAt: new Date(2026, 10, 22, 15, 30).toISOString(),
            id: `r${new Date(2026, 10, 20, 15, 30).getTime()}-1`,
            name: 'Diarreia',
          },
          {
            dueAt: new Date(2026, 10, 23, 15, 30).toISOString(),
            id: `r${new Date(2026, 10, 20, 15, 30).getTime()}-2`,
            name: 'Erosão da mucosa nasolabial',
          },
        ]);

        expect(rowsEls().length).toBe(0);
      });

      it('linha sem nome ou com prazo zero não entra; remover tira a linha', async () => {
        await openIt();
        await type('Evolução.');
        buttonByLabel('Adicionar avaliação')?.click();
        await settle();
        buttonByLabel('Adicionar avaliação')?.click();
        await settle();
        buttonByLabel('Adicionar avaliação')?.click();
        await settle();
        const [vazia, zerada, remover] = rowsEls();

        await fill(vazia, '  ', '48', 'hours');
        await fill(zerada, 'Glicemia', '0', 'hours');
        await fill(remover, 'Some', '1', 'days');
        (remover.querySelector('button') as HTMLButtonElement).click();
        await settle();

        expect(rowsEls().length).toBe(2);
        await save();

        expect(source.saves[0].reevaluations).toEqual([]);
      });
    });

    it('digita e salva: vira a evolução do dia, com autor e data/hora', async () => {
      await openIt();
      await type('  Paciente estável.  ');
      await save();

      expect(source.saves).toEqual([
        {
          at: new Date(2026, 10, 20, 15, 30).toISOString(),
          author: 'Dra. Ana',
          baseVersion: 0,
          day: '2026-11-20',
          origin: 'manual',
          patientId: 'p9',
          reevaluations: [],
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

    it('a gravação leva como base a versão do dia que a tela viu (0 para dia sem texto)', async () => {
      source.current = {
        author: 'Dr. Beto',
        at: new Date(2026, 10, 20, 8, 0).toISOString(),
        origin: 'manual',
        text: 'antes',
        version: 7,
      };
      await openIt();
      await type('depois');
      await save();

      expect(source.saves[0].baseVersion).toBe(7);
    });

    it('sem versão conhecida (leitura sem versão) a gravação não manda base', async () => {
      source.current = {
        author: 'Dr. Beto',
        at: new Date(2026, 10, 20, 8, 0).toISOString(),
        origin: 'manual',
        text: 'antes',
      };
      await openIt();
      await type('depois');
      await save();

      expect('baseVersion' in source.saves[0]).toBeFalse();
    });

    it('falha ao ler o dia: sem base conhecida, a gravação não manda baseVersion', async () => {
      source.loadFails = true;
      await openIt();
      await type('manual');
      await save();

      expect('baseVersion' in source.saves[0]).toBeFalse();
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

    it('offline: digita, vê o aviso em texto e grava mesmo assim (a fila envia quando houver conexão)', async () => {
      const connectivity = TestBed.inject(ConnectivityService);

      connectivity.online.set(false);
      await openIt();
      await type('sem rede');

      expect(text()).toContain(EVOLUTION_OFFLINE_HINT);
      expect(saveButton()?.disabled).toBe(false);
      expect(source.saves).toEqual([]);
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
      await closeIt();
      await openIt();

      expect(source.loadedDays).toEqual(['p9|2026-11-20', 'p9|2026-11-20']);
    });
  });

  describe('médico: registro por IA', () => {
    beforeEach(async () => {
      await setup('doctor');
    });

    it('narra por áudio: aparece o texto sugerido, marcado "gerado por IA" e editável, sem salvar', async () => {
      source.current = {
        author: 'Dr. Beto',
        at: new Date(2026, 10, 20, 8, 0).toISOString(),
        origin: 'manual',
        text: 'vigente',
      };
      await openIt();
      await send();

      expect(ai.calls).toHaveSize(1);
      expect(area()?.value).toBe('Texto sugerido pela IA.');
      expect(el().querySelector('[data-testid="ai-tag"]')?.textContent).toContain('Gerado por IA');
      expect(buttonByLabel('Confirmar evolução')).not.toBeNull();
      expect(source.saves).toEqual([]);
      expect(source.current.text).toBe('vigente');
    });

    it('confirma sem editar: grava com origem ai, autor e data/hora, e a marca some', async () => {
      await openIt();
      await send();
      buttonByLabel('Confirmar evolução')?.click();
      await settle();

      expect(source.saves[0]).toEqual(
        jasmine.objectContaining({ author: 'Dra. Ana', origin: 'ai', text: 'Texto sugerido pela IA.' }),
      );

      expect(el().querySelector('[data-testid="ai-tag"]')).toBeNull();
      expect(buttonByLabel('Salvar evolução')).not.toBeNull();
      expect(text()).toContain('Registrada por Dra. Ana');
    });

    it('edita antes de confirmar: grava o texto editado com origem ai-edited', async () => {
      await openIt();
      await send();
      await type('Texto revisado.');
      buttonByLabel('Confirmar evolução')?.click();
      await settle();

      expect(source.saves[0]).toEqual(jasmine.objectContaining({ origin: 'ai-edited', text: 'Texto revisado.' }));
    });

    it('descartar restaura o campo e não altera a evolução vigente', async () => {
      await openIt();
      await type('rascunho');
      await send();
      buttonByLabel('Descartar sugestão')?.click();
      await settle();

      expect(area()?.value).toBe('rascunho');
      expect(el().querySelector('[data-testid="ai-tag"]')).toBeNull();
      expect(source.saves).toEqual([]);
    });

    it('nova sugestão sobre outra mantém o rascunho original para o descarte', async () => {
      await openIt();
      await type('rascunho');
      await send();
      ai.result = Promise.resolve('Outra sugestão.');
      await send();

      expect(area()?.value).toBe('Outra sugestão.');
      buttonByLabel('Descartar sugestão')?.click();
      await settle();

      expect(area()?.value).toBe('rascunho');
    });

    it('IA falha: avisa em texto e a digitação manual segue possível', async () => {
      ai.result = Promise.reject(new Error('x'));
      await openIt();
      await send();

      expect(text()).toContain(EVOLUTION_AI_FAILED_HINT);
      await type('manual');
      await save();

      expect(source.saves[0].origin).toBe('manual');
    });

    it('IA sem texto reconhecido: avisa e não mexe no campo', async () => {
      ai.result = Promise.resolve('   ');
      await openIt();
      await type('antes');
      await send();

      expect(text()).toContain(EVOLUTION_AI_EMPTY_HINT);
      expect(area()?.value).toBe('antes');
    });

    it('erros de microfone viram aviso em texto', async () => {
      await openIt();
      chat()?.audioModeError.emit('permission-denied');
      await settle();

      expect(text()).toContain(EVOLUTION_MIC_DENIED_HINT);
      chat()?.audioModeError.emit('unavailable');
      await settle();

      expect(text()).toContain(EVOLUTION_MIC_FAILED_HINT);
    });

    it('offline: a IA fica indisponível com aviso e a digitação segue', async () => {
      TestBed.inject(ConnectivityService).online.set(false);
      await openIt();

      expect(text()).toContain(EVOLUTION_AI_UNAVAILABLE_HINT);
      expect(area()?.disabled).toBe(false);
      await send();

      expect(ai.calls).toEqual([]);
    });

    it('a conexão cai durante o processamento: descarta a resposta e avisa', async () => {
      const connectivity = TestBed.inject(ConnectivityService);
      const finishers: ((value: string) => void)[] = [];

      ai.result = new Promise<string>(resolve => {
        finishers.push(resolve);
      });
      await openIt();
      await send();
      connectivity.online.set(false);
      finishers[0]('tarde demais');
      await settle();
      connectivity.online.set(true);
      await settle();

      expect(area()?.value).toBe('');
      expect(text()).toContain(EVOLUTION_AI_FAILED_HINT);
    });

    it('fechar durante o processamento descarta a resposta', async () => {
      const finishers: ((value: string) => void)[] = [];

      ai.result = new Promise<string>(resolve => {
        finishers.push(resolve);
      });
      await openIt();
      await send();
      await closeIt();
      finishers[0]('tarde demais');
      await settle();
      await openIt();

      expect(area()?.value).toBe('');
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
      expect(chat()).toBeUndefined();
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
