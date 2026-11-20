import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { PriorStaysSource, PriorStaysSynthesizer } from '../patient-hub-source';
import { PriorStaysBoxComponent } from './prior-stays-box.component';

class FakeStays extends PriorStaysSource {
  has = true;
  fail = false;
  readonly calls: string[] = [];

  hasPriorStays(patientId: string, hospitalId: string): Promise<boolean> {
    this.calls.push(`${hospitalId}:${patientId}`);

    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(this.has);
  }
}

class FakeSynth extends PriorStaysSynthesizer {
  result: Promise<string> = Promise.resolve('Síntese do histórico');
  calls = 0;

  synthesize(): Promise<string> {
    this.calls++;

    return this.result;
  }
}

describe('PriorStaysBoxComponent', () => {
  let stays: FakeStays;
  let synth: FakeSynth;
  let fixture: ComponentFixture<PriorStaysBoxComponent>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setup(): Promise<void> {
    fixture = TestBed.createComponent(PriorStaysBoxComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('hospitalId', 'h1');
    await settle();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const header = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('.stays__header') as HTMLButtonElement;

  async function expand(): Promise<void> {
    header().click();
    await settle();
  }

  beforeEach(() => {
    stays = new FakeStays();
    synth = new FakeSynth();
    TestBed.configureTestingModule({
      providers: [
        { provide: PriorStaysSource, useValue: stays },
        { provide: PriorStaysSynthesizer, useValue: synth },
      ],
    });
  });

  afterEach(() => TestBed.inject(ConnectivityService).online.set(true));

  it('com internação anterior no mesmo hospital, aparece recolhida e sem consultar a síntese', async () => {
    await setup();

    expect(stays.calls).toEqual(['h1:p1']);
    expect(el().textContent).toContain('Internações anteriores');
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(el().querySelector('.stays__content')?.hasAttribute('hidden')).toBeTrue();
    expect(synth.calls).toBe(0);
  });

  it('sem internação anterior neste hospital, não renderiza nada', async () => {
    stays.has = false;
    await setup();

    expect(el().querySelector('.stays')).toBeNull();
    expect(el().textContent?.trim()).toBe('');
  });

  it('falha na consulta de existência: a caixa não aparece', async () => {
    stays.fail = true;
    await setup();

    expect(el().querySelector('.stays')).toBeNull();
  });

  it('ao expandir mostra carregamento e depois a síntese marcada como "Gerado por IA", só leitura', async () => {
    let resolve!: (v: string) => void;

    synth.result = new Promise(r => (resolve = r));
    await setup();
    await expand();

    expect(header().getAttribute('aria-expanded')).toBe('true');
    expect(el().textContent).toContain('Carregando a síntese');
    resolve('Texto livre <b>sem marcação</b>');
    await settle();

    expect(el().textContent).toContain('Gerado por IA');
    expect(el().querySelector('.stays__text')?.textContent).toBe('Texto livre <b>sem marcação</b>');
    expect(el().querySelector('textarea, input')).toBeNull();
    expect(el().textContent).not.toContain('Salvar');
  });

  it('recolher e reexpandir não consulta de novo a síntese já carregada', async () => {
    await setup();
    await expand();
    await expand();
    await expand();

    expect(synth.calls).toBe(1);
    expect(el().textContent).toContain('Síntese do histórico');
  });

  it('offline: mostra "conexão necessária" e não consulta a síntese', async () => {
    TestBed.inject(ConnectivityService).online.set(false);
    await setup();
    await expand();

    expect(el().textContent).toContain('Conexão necessária');
    expect(synth.calls).toBe(0);
  });

  it('expandida offline: ao voltar a conexão, carrega a síntese sozinha', async () => {
    const connectivity = TestBed.inject(ConnectivityService);

    connectivity.online.set(false);
    await setup();
    await expand();
    connectivity.online.set(true);
    await settle();

    expect(synth.calls).toBe(1);
    expect(el().textContent).toContain('Síntese do histórico');
  });

  it('falha da síntese mostra erro e permite tentar de novo', async () => {
    synth.result = Promise.reject(new Error('x'));
    await setup();
    await expand();

    expect(el().textContent).toContain('Não foi possível carregar o histórico');
    synth.result = Promise.resolve('Agora foi');
    el().querySelector<HTMLButtonElement>('.stays__retry')?.click();
    await settle();

    expect(el().textContent).toContain('Agora foi');
  });

  it('trocar de paciente recolhe, limpa a síntese e reconsulta a existência', async () => {
    await setup();
    await expand();
    fixture.componentRef.setInput('patientId', 'p2');
    await settle();

    expect(stays.calls).toEqual(['h1:p1', 'h1:p2']);
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(el().textContent).not.toContain('Síntese do histórico');
  });

  it('descarta a resposta de uma consulta de existência já superada', async () => {
    let resolveFirst!: (v: boolean) => void;

    stays.hasPriorStays = (): Promise<boolean> => new Promise(r => (resolveFirst = r));
    await setup();
    stays.hasPriorStays = (): Promise<boolean> => Promise.resolve(false);
    fixture.componentRef.setInput('patientId', 'p2');
    await settle();
    resolveFirst(true);
    await settle();

    expect(el().querySelector('.stays')).toBeNull();
  });

  it('descarta a síntese que chega depois de trocar de paciente', async () => {
    let resolve!: (v: string) => void;

    synth.result = new Promise(r => (resolve = r));
    await setup();
    await expand();
    fixture.componentRef.setInput('patientId', 'p2');
    await settle();
    resolve('texto do paciente antigo');
    await settle();

    expect(el().textContent).not.toContain('texto do paciente antigo');
  });

  it('descarta o erro que chega depois de trocar de paciente', async () => {
    let reject!: (e: Error) => void;

    synth.result = new Promise((_, r) => (reject = r));
    await setup();
    await expand();
    fixture.componentRef.setInput('patientId', 'p2');
    await settle();
    reject(new Error('x'));
    await settle();

    expect(el().textContent).not.toContain('Não foi possível');
  });
});
