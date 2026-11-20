import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { NutritionValues } from '../patients/nutrition-panel/nutrition-panel.models';
import { NutritionResultsSource } from '../patients/nutrition-panel/nutrition-results-source';
import { PatientHubComponent, reloadsOnVisibility } from './patient-hub.component';
import { HypothesisSaveRequest, PatientHubProfile } from './patient-hub.models';
import {
  HypothesisSynthesizer,
  HypothesisWriter,
  PatientHubSource,
  PriorStaysSource,
  PriorStaysSynthesizer,
} from './patient-hub-source';

const PROFILE: PatientHubProfile = {
  bed: '35',
  birthDate: '1959-04-13',
  id: 'p1',
  name: 'José Raimundo Soares Neto',
  therapy: 'NE',
  therapyStartDate: '2026-05-26',
  ward: 'Ala 2',
};

const locationMock = { back: jasmine.createSpy('back') };

class FakeSource extends PatientHubSource {
  profile: PatientHubProfile | null = PROFILE;
  hypothesis: string | null = 'Insuficiência respiratória aguda.';
  fail = false;

  loadProfile(): Promise<PatientHubProfile | null> {
    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(this.profile);
  }

  loadHypothesis(): Promise<string | null> {
    return Promise.resolve(this.hypothesis);
  }
}

class FakeSynth extends HypothesisSynthesizer {
  result: Promise<string> = Promise.resolve('Texto da IA');
  readonly calls: string[] = [];

  synthesize(text: string): Promise<string> {
    this.calls.push(text);

    return this.result;
  }
}

class FakeWriter extends HypothesisWriter {
  readonly saved: HypothesisSaveRequest[] = [];
  fail = false;

  save(request: HypothesisSaveRequest): Promise<void> {
    if (this.fail) {
      return Promise.reject(new Error('x'));
    }
    this.saved.push(request);

    return Promise.resolve();
  }
}

class FakeResults extends NutritionResultsSource {
  values: NutritionValues = {};
  fail = false;
  calls = 0;

  load(): Promise<NutritionValues> {
    this.calls++;

    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(this.values);
  }
}

class FakePriorStays extends PriorStaysSource {
  has = false;
  fail = false;
  readonly calls: string[] = [];

  hasPriorStays(patientId: string, hospitalId: string): Promise<boolean> {
    this.calls.push(`${hospitalId}:${patientId}`);

    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(this.has);
  }
}

class FakePriorSynth extends PriorStaysSynthesizer {
  result: Promise<string> = Promise.resolve('Síntese de internações anteriores');

  synthesize(): Promise<string> {
    return this.result;
  }
}

const priorStays = new FakePriorStays();
const priorSynth = new FakePriorSynth();
const results = new FakeResults();
const synth = new FakeSynth();
const writer = new FakeWriter();

async function setup(
  source: FakeSource,
  id: string | null = 'p1',
  hospitals: unknown[] = [{ id: 'h', name: 'Hospital Vila Nova Star' }],
): Promise<ComponentFixture<PatientHubComponent>> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Location, useValue: locationMock },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(id === null ? {} : { id })) } },
      { provide: PatientHubSource, useValue: source },
      { provide: NutritionResultsSource, useValue: results },
      { provide: HypothesisSynthesizer, useValue: synth },
      { provide: HypothesisWriter, useValue: writer },
      { provide: PriorStaysSource, useValue: priorStays },
      { provide: PriorStaysSynthesizer, useValue: priorSynth },
      { provide: ProfessionalProfileReader, useValue: { read: (): { name: string } => ({ name: 'Michelle' }) } },
      { provide: NOW, useValue: (): Date => new Date(2026, 4, 28, 12) },
      {
        provide: LinkedHospitalsReader,
        useValue: { read: (): unknown[] => hospitals },
      },
    ],
  });
  const fixture = TestBed.createComponent(PatientHubComponent);

  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

const text = (f: ComponentFixture<unknown>): string => (f.nativeElement as HTMLElement).textContent ?? '';

const typeInto = (f: ComponentFixture<unknown>, id: string, value: string): void => {
  const area = (f.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(`#${id}`) as HTMLTextAreaElement;

  area.value = value;
  area.dispatchEvent(new Event('input'));
  f.detectChanges();
};

const clickButton = async (f: ComponentFixture<unknown>, label: string): Promise<void> => {
  const root = f.nativeElement as HTMLElement;

  Array.from(root.querySelectorAll('button'))
    .find(b => b.textContent?.includes(label))
    ?.click();
  await f.whenStable();
  f.detectChanges();
};

describe('PatientHubComponent', () => {
  beforeEach(() => {
    results.values = {};
    results.fail = false;
    results.calls = 0;
    priorStays.has = false;
    priorStays.fail = false;
    priorStays.calls.length = 0;
  });

  it('mostra a caixa de internações anteriores recolhida só quando há histórico no hospital em contexto', async () => {
    priorStays.has = true;
    const f = await setup(new FakeSource());

    await f.whenStable();
    f.detectChanges();

    expect(priorStays.calls).toEqual(['h:p1']);
    expect(text(f)).toContain('Internações anteriores');
    expect(f.nativeElement.querySelector('.stays__header').getAttribute('aria-expanded')).toBe('false');
  });

  it('sem histórico (ou sem hospital em contexto), a caixa não aparece', async () => {
    const f = await setup(new FakeSource());

    expect(text(f)).not.toContain('Internações anteriores');
    TestBed.resetTestingModule();
    const g = await setup(new FakeSource(), 'p1', []);

    expect(text(g)).not.toContain('Internações anteriores');
  });

  it('mostra identificação e a Hipótese completa quando preenchida', async () => {
    const f = await setup(new FakeSource());

    expect(text(f)).toContain('Hospital Vila Nova Star · Quinta-feira, 28 de maio');
    expect(text(f)).toContain('Ala 2 · Leito 35');
    expect(text(f)).toContain('José Raimundo Soares Neto');
    expect(text(f)).toContain('67 anos · 13/04/1959');
    expect(text(f)).toContain('Terapia há 2 dias');
    expect(text(f)).toContain('Insuficiência respiratória aguda.');
    expect((f.nativeElement as HTMLElement).querySelector('textarea')).toBeNull();
  });

  it('mostra o estado vazio com o campo de colagem quando não há Hipótese', async () => {
    const source = new FakeSource();

    source.hypothesis = null;
    const f = await setup(source);

    expect(text(f)).toContain('Ainda não há hipótese diagnóstica');
    expect((f.nativeElement as HTMLElement).querySelector('textarea')).not.toBeNull();
  });

  it('mostra o Painel Nutricional com os 8 cards em "Sem dados" abaixo da Hipótese (FT-004-3)', async () => {
    const f = await setup(new FakeSource());
    const values = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.nutrition-panel__value'));

    expect(values.length).toBe(8);
    expect(values.every(v => v.textContent?.trim() === 'Sem dados')).toBeTrue();
  });

  describe('resultados do painel (FT-004-3, US2)', () => {
    const cards = (f: ComponentFixture<unknown>): string[] =>
      Array.from((f.nativeElement as HTMLElement).querySelectorAll('.nutrition-panel__value')).map(
        v => v.textContent?.trim() ?? '',
      );

    it('carrega ao abrir e mostra cada resultado; sem resultado o card segue em "Sem dados"', async () => {
      results.values = { glim: 'Desnutrição' } as NutritionValues;
      const f = await setup(new FakeSource());

      expect(cards(f)).toContain('Desnutrição');
      expect(cards(f).filter(v => v === 'Sem dados').length).toBe(7);
    });

    it('retomar o foco recarrega; falha mantém os valores exibidos', async () => {
      results.values = { glim: 'Desnutrição' } as NutritionValues;
      const f = await setup(new FakeSource());

      results.values = { glim: 'Sem desnutrição' } as NutritionValues;
      window.dispatchEvent(new Event('focus'));
      await f.whenStable();
      f.detectChanges();

      expect(cards(f)).toContain('Sem desnutrição');

      results.fail = true;
      window.dispatchEvent(new Event('focus'));
      await f.whenStable();
      f.detectChanges();

      expect(cards(f)).toContain('Sem desnutrição');
    });

    it('regra de visibilidade: visível recarrega; oculto não', () => {
      expect(reloadsOnVisibility('visible')).toBeTrue();
      expect(reloadsOnVisibility('hidden')).toBeFalse();
    });

    it('sem id na rota não busca resultados', async () => {
      await setup(new FakeSource(), null);

      expect(results.calls).toBe(0);
    });

    it('o tratador de visibilidade e o puxar com a página rolada percorrem os dois ramos', async () => {
      const f = await setup(new FakeSource());
      const before = results.calls;
      const visibility = spyOnProperty(Document.prototype, 'visibilityState', 'get').and.returnValue('visible');
      const hub = f.componentInstance as unknown as { onVisibility(): void };

      hub.onVisibility();
      visibility.and.returnValue('hidden');
      hub.onVisibility();
      spyOnProperty(window, 'scrollY', 'get').and.returnValue(120);
      const el = f.nativeElement as HTMLElement;
      const point = new Touch({ clientX: 0, clientY: 10, identifier: 1, target: el });

      el.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [point], touches: [point] }));
      await f.whenStable();

      // Só a visibilidade "visível" recarrega aqui (eventos reais do runner podem somar chamadas).
      expect(results.calls).toBeGreaterThan(before);
    });

    it('arrasto curto ou sem toque inicial não recarrega', async () => {
      const f = await setup(new FakeSource());
      const before = results.calls;
      const el = f.nativeElement as HTMLElement;
      const touch = (type: string, y: number): TouchEvent => {
        const point = new Touch({ clientX: 0, clientY: y, identifier: 1, target: el });

        return new TouchEvent(type, { changedTouches: [point], touches: type === 'touchstart' ? [point] : [] });
      };

      el.dispatchEvent(touch('touchstart', 10));
      el.dispatchEvent(touch('touchend', 50));
      el.dispatchEvent(touch('touchend', 300));
      await f.whenStable();

      expect(results.calls).toBe(before);
    });

    it('puxar para atualizar (arrasto > 80px a partir do topo) recarrega', async () => {
      const f = await setup(new FakeSource());
      const before = results.calls;
      const touch = (type: string, y: number): TouchEvent =>
        new TouchEvent(type, {
          changedTouches: [new Touch({ clientX: 0, clientY: y, identifier: 1, target: f.nativeElement })],
          touches:
            type === 'touchstart'
              ? [new Touch({ clientX: 0, clientY: y, identifier: 1, target: f.nativeElement })]
              : [],
        });

      (f.nativeElement as HTMLElement).dispatchEvent(touch('touchstart', 10));
      (f.nativeElement as HTMLElement).dispatchEvent(touch('touchend', 150));
      await f.whenStable();

      expect(results.calls).toBeGreaterThan(before);
    });
  });

  it('indica paciente não encontrado', async () => {
    const source = new FakeSource();

    source.profile = null;

    expect(text(await setup(source))).toContain('Paciente não encontrado');
    TestBed.resetTestingModule();

    expect(text(await setup(new FakeSource(), null))).toContain('Paciente não encontrado');
  });

  it('indica erro de carregamento', async () => {
    const source = new FakeSource();

    source.fail = true;

    expect(text(await setup(source))).toContain('Não foi possível carregar');
  });

  it('formata terapia iniciada hoje e no singular, e volta ao histórico', async () => {
    const source = new FakeSource();

    source.profile = { ...PROFILE, birthDate: '1959-06-01', therapyStartDate: '2026-05-28' };
    const f = await setup(source);

    expect(text(f)).toContain('66 anos');
    expect(text(f)).toContain('Terapia iniciada hoje');

    TestBed.resetTestingModule();
    source.profile = { ...PROFILE, therapyStartDate: '2026-05-27' };

    expect(text(await setup(source))).toContain('Terapia há 1 dia');
  });

  it('calcula a idade no mês do aniversário e funciona sem hospital em contexto', async () => {
    const source = new FakeSource();

    source.profile = { ...PROFILE, birthDate: '1959-05-30' };

    expect(text(await setup(source, 'p1', []))).toContain('66 anos');

    TestBed.resetTestingModule();
    source.profile = { ...PROFILE, birthDate: '1959-05-10' };

    expect(text(await setup(source))).toContain('67 anos');
  });

  it('volta ao clicar na seta', async () => {
    const f = await setup(new FakeSource());

    (f.nativeElement as HTMLElement).querySelector<HTMLElement>('app-icon-button button')?.click();

    expect(locationMock.back).toHaveBeenCalledOnceWith();
  });

  describe('preenchimento da Hipótese', () => {
    let f: ComponentFixture<PatientHubComponent>;
    const el = (): HTMLElement => f.nativeElement as HTMLElement;
    const area = (id: string): HTMLTextAreaElement =>
      el().querySelector<HTMLTextAreaElement>(`#${id}`) as HTMLTextAreaElement;
    const type = async (id: string, value: string): Promise<void> => {
      area(id).value = value;
      area(id).dispatchEvent(new Event('input'));
      f.detectChanges();
    };
    const click = async (label: string): Promise<void> => {
      const btn = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes(label));

      btn?.click();
      await f.whenStable();
      f.detectChanges();
    };

    beforeEach(async () => {
      synth.calls.length = 0;
      synth.result = Promise.resolve('Texto da IA');
      writer.saved.length = 0;
      writer.fail = false;
      const source = new FakeSource();

      source.hypothesis = null;
      f = await setup(source);
    });

    it('não aciona a IA com campo vazio ou só espaços e orienta a colar', async () => {
      await click('Sintetizar com IA');
      await type('paste-text', '   \n ');
      await click('Sintetizar com IA');

      expect(synth.calls).toEqual([]);
      expect(text(f)).toContain('Cole um texto do prontuário antes de sintetizar.');
    });

    it('envia o texto colado, mostra carregamento e depois o resultado marcado como gerado por IA', async () => {
      const resolvers: ((v: string) => void)[] = [];

      synth.result = new Promise<string>(r => resolvers.push(r));
      await type('paste-text', 'prontuário longo');
      await click('Sintetizar com IA');

      expect(synth.calls).toEqual(['prontuário longo']);
      expect(text(f)).toContain('Sintetizando');
      expect(area('paste-text').disabled).toBeTrue();

      resolvers[0]('Resumo da IA');
      await f.whenStable();
      f.detectChanges();

      expect(text(f)).toContain('Gerado por IA');
      expect(area('draft-text').value).toBe('Resumo da IA');
      expect(writer.saved).toEqual([]);
    });

    it('confirma o texto editado (não o da IA), sem marca de IA, e grava origem ai-edited', async () => {
      await type('paste-text', 'x');
      await click('Sintetizar com IA');
      await type('draft-text', '  Texto editado  ');
      await click('Confirmar hipótese');

      expect(writer.saved).toEqual([
        jasmine.objectContaining({ author: 'Michelle', origin: 'ai-edited', patientId: 'p1', text: 'Texto editado' }),
      ]);

      expect(text(f)).toContain('Texto editado');
      expect(text(f)).not.toContain('Gerado por IA');
      expect(el().querySelector('textarea')).toBeNull();
    });

    it('confirmar sem editar grava a origem ai', async () => {
      await type('paste-text', 'x');
      await click('Sintetizar com IA');
      await click('Confirmar hipótese');

      expect(writer.saved[0].origin).toBe('ai');
    });

    it('descartar volta ao texto colado sem gravar', async () => {
      await type('paste-text', 'meu texto');
      await click('Sintetizar com IA');
      await click('Descartar');

      expect(area('paste-text').value).toBe('meu texto');
      expect(writer.saved).toEqual([]);
    });

    it('na falha da IA permite digitar e confirmar manualmente, mantendo o texto colado', async () => {
      synth.result = Promise.reject(new Error('fora do ar'));
      await type('paste-text', 'colado');
      await click('Sintetizar com IA');

      expect(text(f)).toContain('A síntese por IA falhou ou está indisponível');
      expect(text(f)).not.toContain('Gerado por IA');
      expect(area('paste-text').value).toBe('colado');

      await click('Confirmar hipótese');

      expect(text(f)).toContain('Escreva a hipótese diagnóstica antes de confirmar.');
      expect(writer.saved).toEqual([]);

      await type('draft-text', 'Digitado à mão');
      await click('Confirmar hipótese');

      expect(writer.saved[0]).toEqual(jasmine.objectContaining({ origin: 'manual', text: 'Digitado à mão' }));
      expect(text(f)).toContain('Digitado à mão');
    });

    it('na falha permite tentar a síntese de novo', async () => {
      synth.result = Promise.reject(new Error('x'));
      await type('paste-text', 'colado');
      await click('Sintetizar com IA');
      synth.result = Promise.resolve('Agora foi');
      await click('Tentar sintetizar de novo');

      expect(area('draft-text').value).toBe('Agora foi');
      expect(text(f)).toContain('Gerado por IA');
    });

    it('avisa quando a gravação falha e mantém o texto em revisão', async () => {
      writer.fail = true;
      await type('paste-text', 'x');
      await click('Sintetizar com IA');
      await click('Confirmar hipótese');

      expect(text(f)).toContain('Não foi possível gravar');
      expect(area('draft-text').value).toBe('Texto da IA');
    });

    it('offline: síntese e confirmação indisponíveis com mensagem de conexão necessária', async () => {
      await type('paste-text', 'x');
      await click('Sintetizar com IA');
      TestBed.inject(ConnectivityService).online.set(false);
      f.detectChanges();

      expect(text(f)).toContain('Conexão necessária');
      const buttons = Array.from(el().querySelectorAll('button'));

      expect(buttons.find(b => b.textContent?.includes('Confirmar'))?.disabled).toBeTrue();

      const instance = f.componentInstance as unknown as { confirm(): Promise<void>; synthesize(): Promise<void> };

      await instance.confirm();
      await instance.synthesize();

      expect(writer.saved).toEqual([]);
      expect(synth.calls.length).toBe(1);
      TestBed.inject(ConnectivityService).online.set(true);
    });
  });

  describe('atualização da Hipótese já preenchida', () => {
    let f: ComponentFixture<PatientHubComponent>;
    const el = (): HTMLElement => f.nativeElement as HTMLElement;
    const area = (id: string): HTMLTextAreaElement =>
      el().querySelector<HTMLTextAreaElement>(`#${id}`) as HTMLTextAreaElement;
    const type = (id: string, value: string): void => typeInto(f, id, value);
    const click = (label: string): Promise<void> => clickButton(f, label);

    beforeEach(async () => {
      synth.calls.length = 0;
      synth.result = Promise.resolve('Texto da IA');
      writer.saved.length = 0;
      writer.fail = false;
      f = await setup(new FakeSource());
    });

    it('mostra as ações de atualizar e o texto atual segue visível durante o fluxo', async () => {
      expect(text(f)).toContain('Atualizar com novo texto');
      expect(text(f)).toContain('Editar texto');
      await click('Atualizar com novo texto');

      expect(text(f)).toContain('Insuficiência respiratória aguda.');
      expect(text(f)).not.toContain('Ainda não há hipótese');
      expect(text(f)).not.toContain('Editar texto');
    });

    it('colar novo trecho → síntese → confirmar substitui a hipótese e grava origem ai', async () => {
      await click('Atualizar com novo texto');
      type('paste-text', 'novo trecho');
      await click('Sintetizar com IA');

      expect(text(f)).toContain('Gerado por IA');
      await click('Confirmar hipótese');

      expect(writer.saved).toEqual([
        jasmine.objectContaining({ author: 'Michelle', origin: 'ai', text: 'Texto da IA' }),
      ]);

      expect(writer.saved[0].at).toMatch(/^\d{4}-/);
      expect(text(f)).toContain('Texto da IA');
      expect(text(f)).toContain('Editar texto');
      expect(el().querySelector('textarea')).toBeNull();
    });

    it('cancelar mantém a hipótese anterior sem gravar', async () => {
      await click('Atualizar com novo texto');
      await click('Cancelar');

      expect(writer.saved).toEqual([]);
      expect(text(f)).toContain('Insuficiência respiratória aguda.');
      expect(el().querySelector('textarea')).toBeNull();
    });

    it('texto vazio não aciona a IA; falha da IA libera digitação manual', async () => {
      await click('Atualizar com novo texto');
      await click('Sintetizar com IA');

      expect(synth.calls).toEqual([]);
      synth.result = Promise.reject(new Error('x'));
      type('paste-text', 'abc');
      await click('Sintetizar com IA');
      type('draft-text', 'Manual');
      await click('Confirmar hipótese');

      expect(writer.saved).toEqual([jasmine.objectContaining({ origin: 'manual', text: 'Manual' })]);
    });

    it('falha ao gravar mantém a hipótese anterior e informa', async () => {
      writer.fail = true;
      await click('Editar texto');
      type('edit-text', 'Novo');
      await click('Salvar');

      expect(text(f)).toContain('Não foi possível gravar');
      await click('Cancelar');

      expect(text(f)).toContain('Insuficiência respiratória aguda.');
    });

    it('edição direta: mostra o texto atual editável e só substitui ao salvar (origem manual)', async () => {
      await click('Editar texto');

      expect(area('edit-text').value).toBe('Insuficiência respiratória aguda.');
      expect(text(f)).not.toContain('Atualizar com novo texto');
      type('edit-text', '  Pneumonia  ');

      expect(writer.saved).toEqual([]);
      await click('Salvar');

      expect(writer.saved).toEqual([
        jasmine.objectContaining({ author: 'Michelle', origin: 'manual', patientId: 'p1', text: 'Pneumonia' }),
      ]);

      expect(text(f)).toContain('Pneumonia');
      expect(el().querySelector('textarea')).toBeNull();
    });

    it('edição direta: cancelar descarta; vazio não salva', async () => {
      await click('Editar texto');
      type('edit-text', '   ');
      await click('Salvar');

      expect(text(f)).toContain('Escreva a hipótese diagnóstica antes de confirmar.');
      expect(writer.saved).toEqual([]);
      await click('Cancelar');

      expect(text(f)).toContain('Insuficiência respiratória aguda.');
      expect(el().querySelector('textarea')).toBeNull();
    });

    it('edição direta offline: salvar indisponível com mensagem; leitura continua', async () => {
      await click('Editar texto');
      TestBed.inject(ConnectivityService).online.set(false);
      f.detectChanges();

      expect(text(f)).toContain('Conexão necessária');
      expect(text(f)).toContain('Insuficiência respiratória aguda.');
      await (f.componentInstance as unknown as { confirm(): Promise<void> }).confirm();

      expect(writer.saved).toEqual([]);
      TestBed.inject(ConnectivityService).online.set(true);
    });

    it('a hipótese não muda sem ação explícita do profissional (FR-009)', async () => {
      await click('Editar texto');
      type('edit-text', 'rascunho não salvo');
      f.detectChanges();
      await f.whenStable();

      expect(writer.saved).toEqual([]);
      await click('Cancelar');

      expect(text(f)).toContain('Insuficiência respiratória aguda.');
    });
  });
});
