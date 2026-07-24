import { Injectable, type Signal, signal } from '@angular/core';

/**
 * Rastreia se a última interação do usuário antes de um evento de foco foi via
 * teclado ou via ponteiro (mouse/touch) — fonte única para o anel de foco rosa
 * sistêmico (`mixins.focus-ring`), usado por todo elemento clicável do design
 * system (Button, IconButton, Input/Select).
 *
 * Por que não usar `:focus-visible` puro: o heurístico nativo do browser trata
 * `<input>`/`<textarea>` como categoria especial que SEMPRE casa
 * `:focus-visible` mesmo em clique de mouse (diferente de `<button>`/`<div
 * tabindex>`, onde clique de mouse não casa) — isso fazia o anel rosa aparecer
 * ao clicar num campo de texto, quebrando a regra "só teclado" para esse tipo
 * de elemento. Rastrear a modalidade manualmente (`mousedown`/`pointerdown` vs
 * `keydown`) dá o mesmo comportamento para QUALQUER elemento, sem depender do
 * heurístico específico de cada tag.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardFocusService {
  readonly isKeyboard: Signal<boolean>;

  private readonly isKeyboardSignal = signal(true);

  constructor() {
    this.isKeyboard = this.isKeyboardSignal.asReadonly();

    // `capture: true` para rodar antes de qualquer `stopPropagation()` de
    // componente filho — este rastreamento precisa ver TODA interação, sem
    // exceção.
    document.addEventListener('mousedown', () => this.isKeyboardSignal.set(false), { capture: true });
    document.addEventListener('pointerdown', () => this.isKeyboardSignal.set(false), { capture: true });
    document.addEventListener('keydown', () => this.isKeyboardSignal.set(true), { capture: true });
  }
}
