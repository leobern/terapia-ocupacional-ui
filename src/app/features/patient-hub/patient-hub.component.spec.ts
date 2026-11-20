import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { PatientHubComponent } from './patient-hub.component';
import { HypothesisSaveRequest, PatientHubProfile } from './patient-hub.models';
import { HypothesisSynthesizer, HypothesisWriter, PatientHubSource } from './patient-hub-source';

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
      { provide: HypothesisSynthesizer, useValue: synth },
      { provide: HypothesisWriter, useValue: writer },
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

describe('PatientHubComponent', () => {
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
});
