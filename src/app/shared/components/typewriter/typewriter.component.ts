import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';

/** Quem pede menos movimento vê o texto inteiro de uma vez. */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Texto que se escreve sozinho, como a IA digitando (decisão do Thiago, 2026-11-23): uma digitação rápida, um
 * caractere por tick. O texto inteiro fica invisível por baixo para reservar o espaço (o layout não pula enquanto
 * escreve) e para os leitores de tela lerem a frase completa; a camada que digita é só visual.
 * `restartKey` reinicia a digitação (ex.: o painel reabriu); `enabled=false` segura o texto vazio.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-typewriter',
  styleUrl: './typewriter.component.scss',
  template: `<span class="typewriter__ghost">{{ text() }}</span
    ><span class="typewriter__live" aria-hidden="true">{{ shown() }}</span>`,
})
export class TypewriterComponent {
  readonly text = input.required<string>();
  /** Qualquer mudança reinicia a digitação. */
  readonly restartKey = input<unknown>(null);
  /** Milissegundos por caractere (rápido). */
  readonly speedMs = input(14);
  readonly enabled = input(true);
  /** Emitido quando o último caractere aparece. */
  readonly finished = output();

  protected readonly shown = signal('');

  constructor() {
    effect(onCleanup => {
      const text = this.text();

      this.restartKey();
      if (!this.enabled()) {
        this.shown.set('');

        return;
      }
      if (prefersReducedMotion() || text.length === 0) {
        this.shown.set(text);
        untracked(() => this.finished.emit());

        return;
      }
      let count = 0;

      this.shown.set('');
      const timer = setInterval(() => {
        count++;
        this.shown.set(text.slice(0, count));
        if (count >= text.length) {
          clearInterval(timer);
          this.finished.emit();
        }
      }, this.speedMs());

      onCleanup(() => clearInterval(timer));
    });
  }
}
