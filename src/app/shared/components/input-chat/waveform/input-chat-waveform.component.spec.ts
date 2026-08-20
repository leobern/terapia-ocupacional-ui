import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { type AudioCaptureHandle, WAVEFORM_BAR_COUNT } from '../../../services/audio-capture.service';
import {
  BAR_HEIGHT_MAX,
  BAR_HEIGHT_MIN,
  computeBarHeights,
  InputChatWaveformComponent,
} from './input-chat-waveform.component';

/**
 * Handle sintético: substitui microfone real por um nível conhecido, o que é
 * o que torna SC-005 verificável de forma determinística (research.md §5/§9).
 */
function fakeHandle(level: number): AudioCaptureHandle {
  return {
    dispose: () => undefined,
    readFrame: (out: Float32Array) => out.fill(level),
    stopAndCollect: () => Promise.resolve(new Blob()),
  };
}

function stubVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

/** Converge a suavização exponencial para o nível de entrada. */
function settle(level: number, frames = 60): Float32Array {
  const raw = new Float32Array(WAVEFORM_BAR_COUNT).fill(level);
  const smoothed = new Float32Array(WAVEFORM_BAR_COUNT);

  let heights = computeBarHeights(raw, smoothed);

  for (let i = 1; i < frames; i += 1) {
    heights = computeBarHeights(raw, smoothed);
  }

  return heights;
}

describe('computeBarHeights (SC-005 — FR-010)', () => {
  it('mantem a altura minima em silencio absoluto', () => {
    const heights = settle(0);

    heights.forEach(h => expect(h).toBeCloseTo(BAR_HEIGHT_MIN, 5));
  });

  it('nunca ultrapassa o teto de 26px, nem no nivel maximo', () => {
    const heights = settle(1);

    heights.forEach(h => expect(h).toBeLessThanOrEqual(BAR_HEIGHT_MAX + 1e-6));
  });

  it('atinge exatamente o teto no nivel maximo (ganho saturado)', () => {
    const heights = settle(1);

    heights.forEach(h => expect(Math.abs(h - BAR_HEIGHT_MAX)).toBeLessThanOrEqual(1));
  });

  it('escala com o nivel captado nos 4 pontos da tabela de faixas', () => {
    // h = 4 + 22 · nivel · (0.25 + 0.75 · min(nivel/0.25, 1))
    const expected: [number, number][] = [
      [0, 4],
      [0.25, 4 + 22 * 0.25 * 1],
      [0.6, 4 + 22 * 0.6 * 1],
      [1, 4 + 22 * 1 * 1],
    ];

    expected.forEach(([level, want]) => {
      settle(level).forEach(h => expect(Math.abs(h - want)).toBeLessThanOrEqual(1));
    });
  });

  it('usa no maximo 25% da faixa util quando o ruido e baixo (ganho nao saturado)', () => {
    // Nivel 0.05 ⇒ RMS 0.05 ⇒ ganho 0.2 ⇒ fator 0.4
    const heights = settle(0.05);
    const want = BAR_HEIGHT_MIN + (BAR_HEIGHT_MAX - BAR_HEIGHT_MIN) * 0.05 * (0.25 + 0.75 * 0.2);

    heights.forEach(h => expect(Math.abs(h - want)).toBeLessThanOrEqual(1));
  });

  it('suaviza entre quadros — um unico quadro nao salta para o valor final', () => {
    const raw = new Float32Array(WAVEFORM_BAR_COUNT).fill(1);
    const smoothed = new Float32Array(WAVEFORM_BAR_COUNT);

    const first = computeBarHeights(raw, smoothed);

    expect(first[0]).toBeLessThan(BAR_HEIGHT_MAX);
    expect(first[0]).toBeGreaterThan(BAR_HEIGHT_MIN);
  });
});

describe('InputChatWaveformComponent', () => {
  let fixture: ComponentFixture<InputChatWaveformComponent>;

  function bars(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.input-chat-waveform__bar'));
  }

  function groups(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.input-chat-waveform__group'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [InputChatWaveformComponent] }).compileComponents();

    fixture = TestBed.createComponent(InputChatWaveformComponent);
    fixture.detectChanges();
  });

  it('renderiza 6 grupos de 5 barras (geometria medida no SVG — research.md §3)', () => {
    expect(groups().length).toBe(6);
    expect(bars().length).toBe(WAVEFORM_BAR_COUNT);
    expect(bars().length).toBe(30);
  });

  it('marca as ondas como decorativas para leitores de tela', () => {
    const root: HTMLElement = fixture.nativeElement.querySelector('.input-chat-waveform');

    expect(root.getAttribute('aria-hidden')).toBe('true');
  });

  it('entra no fallback canonico quando nao ha sinal (FR-012)', () => {
    const root: HTMLElement = fixture.nativeElement.querySelector('.input-chat-waveform');

    expect(root.classList).toContain('input-chat-waveform--idle');
  });

  it('sai do fallback quando recebe um handle', () => {
    fixture.componentRef.setInput('handle', fakeHandle(0.5));
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement.querySelector('.input-chat-waveform');

    expect(root.classList).not.toContain('input-chat-waveform--idle');
  });

  /**
   * Espiar `requestAnimationFrame` global não serve para asseverar isto: o
   * próprio Angular agenda quadros durante a detecção de mudanças, então o spy
   * dispararia por motivos que não são o nosso loop. O que importa de verdade é
   * se há TRABALHO POR QUADRO — ou seja, se `readFrame` chega a ser chamado.
   * Este fake executa o primeiro quadro de forma síncrona (e só o primeiro,
   * para não recursar) e deixa a asserção recair sobre o comportamento real.
   */
  /**
   * Espiar `requestAnimationFrame` e simplesmente invocar o primeiro callback
   * NÃO funciona: o próprio Angular agenda quadros durante a detecção de
   * mudanças, então a invocação cairia no callback dele, não no nosso. Aqui
   * coletamos todos os callbacks e disparamos o ÚLTIMO registrado — o do
   * componente, agendado ao final do flush do `effect`.
   */
  function runOneFrame(visibility: DocumentVisibilityState = 'visible'): jasmine.Spy {
    const readFrame = jasmine.createSpy('readFrame');
    const scheduled: FrameRequestCallback[] = [];

    // O Chrome headless reporta `visibilityState: 'hidden'`, e a guarda de
    // FR-011 barraria o quadro — por isso a visibilidade é explícita aqui.
    stubVisibility(visibility);
    spyOn(globalThis, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => {
      scheduled.push(cb);

      return scheduled.length;
    });

    fixture.componentRef.setInput('handle', { ...fakeHandle(0.5), readFrame });
    fixture.detectChanges();

    // `1e9` como timestamp: qualquer valor bem acima do intervalo de 30fps
    // serve para o throttle não descartar este quadro.
    scheduled.at(-1)?.(1e9);

    return readFrame;
  }

  it('roda o loop de animacao ao receber um handle', () => {
    expect(runOneFrame()).toHaveBeenCalledWith(jasmine.any(Float32Array));
  });

  it('NAO executa nenhum quadro sob prefers-reduced-motion (SC-007, regra dura)', () => {
    spyOn(globalThis, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);

    expect(runOneFrame()).not.toHaveBeenCalled();
  });

  it('escreve apenas `transform` nas barras — nunca `height` (FR-010)', () => {
    runOneFrame();

    const styled = bars().filter(bar => bar.style.transform !== '');

    expect(styled.length).toBeGreaterThan(0);
    styled.forEach(bar => {
      expect(bar.style.transform).toMatch(/^scaleY\(/);
      expect(bar.style.height).toBe('');
    });
  });

  it('pausa o trabalho por quadro quando a aba nao esta visivel (FR-011)', () => {
    expect(runOneFrame('hidden')).not.toHaveBeenCalled();
  });

  it('cancela o loop ao perder o handle', () => {
    spyOn(globalThis, 'requestAnimationFrame').and.returnValue(7);

    spyOn(globalThis, 'cancelAnimationFrame');

    fixture.componentRef.setInput('handle', fakeHandle(0.5));
    fixture.detectChanges();
    fixture.componentRef.setInput('handle', null);
    fixture.detectChanges();

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(7);
  });

  it('cancela o loop ao destruir o componente (nao deixa rAF orfao)', () => {
    spyOn(globalThis, 'requestAnimationFrame').and.returnValue(9);

    spyOn(globalThis, 'cancelAnimationFrame');

    fixture.componentRef.setInput('handle', fakeHandle(0.5));
    fixture.detectChanges();
    fixture.destroy();

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(9);
  });
});
