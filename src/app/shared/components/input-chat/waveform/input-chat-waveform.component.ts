import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  viewChildren,
} from '@angular/core';

import { type AudioCaptureHandle, WAVEFORM_BAR_COUNT } from '../../../services/audio-capture.service';

/** Altura mínima em px — a barra nunca some, mesmo em silêncio absoluto. */
export const BAR_HEIGHT_MIN = 4;
/** Altura do grupo no Figma (nó 4054:3375) — teto da barra. */
export const BAR_HEIGHT_MAX = 26;
/** Suavização exponencial por barra: evita estroboscopia entre quadros. */
const SMOOTHING = 0.35;
/** RMS a partir do qual o ganho global satura. */
const RMS_REFERENCE = 0.25;
/** Teto de 30fps — metade do custo de 60fps, imperceptível em barras. */
const FRAME_INTERVAL_MS = 1000 / 30;

/** 6 grupos de 5 barras (research.md §3) — só para o template iterar. */
export const WAVEFORM_GROUPS = [0, 1, 2, 3, 4, 5];
export const WAVEFORM_BARS_PER_GROUP = [0, 1, 2, 3, 4];

/**
 * Núcleo da animação, isolado como função pura para ser verificável em ±1px
 * sem depender de `requestAnimationFrame` nem de layout (SC-005).
 *
 * `smoothed` é lido E escrito: é o estado que carrega a suavização exponencial
 * entre quadros.
 */
export function computeBarHeights(raw: Float32Array, smoothed: Float32Array, out?: Float32Array): Float32Array {
  // `out` opcional: o loop de animação passa um buffer de instância para não
  // alocar 30 `Float32Array` por segundo — o mesmo motivo pelo qual
  // `audio-capture.service` aloca `bins` uma única vez. Sem `out`, aloca (é o
  // caminho dos testes, que comparam o retorno diretamente).
  const heights = out ?? new Float32Array(raw.length);

  let energy = 0;

  for (const amplitude of raw) {
    energy += amplitude * amplitude;
  }

  // Ganho global: é ele que traduz "quanto mais barulho, mais vibração" — em
  // silêncio as barras usam no máximo 25% da faixa útil; com voz alta, 100%
  // (DS-component-input-chat FR-010).
  const rms = Math.sqrt(energy / raw.length);
  const gain = Math.min(Math.max(rms / RMS_REFERENCE, 0), 1);
  const span = BAR_HEIGHT_MAX - BAR_HEIGHT_MIN;

  for (let band = 0; band < raw.length; band += 1) {
    smoothed[band] = SMOOTHING * raw[band] + (1 - SMOOTHING) * smoothed[band];
    heights[band] = BAR_HEIGHT_MIN + span * smoothed[band] * (0.25 + 0.75 * gain);
  }

  return heights;
}

/**
 * Espelha as bandas a partir do centro do conjunto: a banda 0 (graves, onde a
 * voz tem mais energia) fica no meio e as agudas nas pontas. Sem isso, um lado
 * do desenho ficaria praticamente parado.
 */
function mirroredIndex(band: number): number {
  const half = WAVEFORM_BAR_COUNT / 2;

  return band % 2 === 0 ? half + Math.floor(band / 2) : half - 1 - Math.floor(band / 2);
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * As 30 barras do modo áudio, reagindo à amplitude captada.
 *
 * Vive num componente separado porque tem ciclo de vida próprio
 * (`requestAnimationFrame`, cleanup) e é a única parte cujo teste depende de
 * sinal sintético — isolá-la mantém o spec do `input-chat` livre de Web Audio.
 *
 * `handle = null` ⇒ fallback canônico (animação CSS pura): é o estado enquanto
 * a permissão do microfone é resolvida e o estado final quando ela é negada.
 * As barras nunca ficam achatadas/estáticas (FR-012).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-input-chat-waveform',
  styleUrl: './input-chat-waveform.component.scss',
  templateUrl: './input-chat-waveform.component.html',
})
export class InputChatWaveformComponent {
  readonly handle = input<AudioCaptureHandle | null>(null);

  protected readonly groups = WAVEFORM_GROUPS;
  protected readonly barsPerGroup = WAVEFORM_BARS_PER_GROUP;

  private readonly bars = viewChildren<ElementRef<HTMLElement>>('bar');
  private readonly zone = inject(NgZone);

  private readonly raw = new Float32Array(WAVEFORM_BAR_COUNT);
  private readonly smoothed = new Float32Array(WAVEFORM_BAR_COUNT);
  // Buffer de saída reusado a cada quadro — ver nota em `computeBarHeights`.
  private readonly heights = new Float32Array(WAVEFORM_BAR_COUNT);

  private frameId: number | null = null;
  private lastFrameAt = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopLoop());

    effect(() => {
      const handle = this.handle();

      this.stopLoop();

      // Sob `prefers-reduced-motion`, NENHUM loop roda e nenhum keyframe fica
      // ativo — regra dura (FR-013), não degradação parcial. O CSS fixa as
      // barras em scaleY(0.5) e o estado é comunicado por `aria-live` no pai.
      if (handle && !prefersReducedMotion()) {
        this.startLoop(handle);
      }
    });
  }

  private startLoop(handle: AudioCaptureHandle): void {
    const tick = (now: number): void => {
      this.frameId = requestAnimationFrame(tick);

      // Throttle a 30fps e pausa quando a aba não está visível (FR-011) — sem
      // isto o loop consumiria bateria com o componente fora de vista.
      if (now - this.lastFrameAt < FRAME_INTERVAL_MS || document.visibilityState !== 'visible') {
        return;
      }
      this.lastFrameAt = now;

      handle.readFrame(this.raw);
      this.paint();
    };

    // FORA da zona do Angular, deliberadamente: dentro dela, cada quadro
    // agendaria um ciclo de change detection — 30 por segundo, para uma
    // animação que só escreve `transform` direto no DOM e não altera nenhum
    // estado ligado a template. Rodar dentro da zona também a mantém
    // permanentemente instável, o que trava qualquer `whenStable()`.
    this.zone.runOutsideAngular(() => {
      this.frameId = requestAnimationFrame(tick);
    });
  }

  private stopLoop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private paint(): void {
    const bars = this.bars();
    const heights = computeBarHeights(this.raw, this.smoothed, this.heights);

    for (let band = 0; band < WAVEFORM_BAR_COUNT; band += 1) {
      const bar = bars[mirroredIndex(band)];

      // Só `transform` — nunca `height`: mantém a animação no compositor, sem
      // layout nem paint por quadro.
      bar?.nativeElement.style.setProperty('transform', `scaleY(${heights[band] / BAR_HEIGHT_MAX})`);
    }
  }
}
