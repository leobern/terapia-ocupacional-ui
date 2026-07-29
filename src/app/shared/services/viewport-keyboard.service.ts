import { Injectable, type Signal, signal } from '@angular/core';

/**
 * Redução mínima de altura do visual viewport para considerar o teclado virtual
 * aberto. Precisa ser maior que a barra de endereço que encolhe ao rolar (~60–90px
 * nos navegadores móveis) e menor que o menor teclado usual (~250px).
 */
const KEYBOARD_HEIGHT_THRESHOLD_PX = 150;

/**
 * Rastreia se o teclado virtual do aparelho está aberto — fonte única para
 * qualquer elemento fixo no rodapé (hoje a `bottom-nav-bar`; amanhã as
 * bottom-sheets) se retirar do caminho enquanto o usuário digita.
 *
 * Por que `visualViewport` e não `window.resize`: no iOS o `innerHeight` NÃO muda
 * quando o teclado abre — elementos `position: fixed` acompanham o *layout
 * viewport* e acabam flutuando por cima do teclado. O visual viewport é a única
 * API que expõe isso de forma consistente entre iOS e Android.
 *
 * Por que não detectar por `focus` em campos de texto: o foco não distingue
 * teclado físico de virtual — um tablet com teclado acoplado esconderia a barra
 * sem motivo nenhum.
 *
 * Mesmo formato do `KeyboardFocusService` (serviço root + `signal` privado
 * alimentado por listeners registrados no construtor), para que os dois sinais de
 * "modalidade de entrada" do projeto sejam lidos da mesma maneira.
 */
@Injectable({ providedIn: 'root' })
export class ViewportKeyboardService {
  readonly isVirtualKeyboardOpen: Signal<boolean>;

  private readonly isOpenSignal = signal(false);

  constructor() {
    this.isVirtualKeyboardOpen = this.isOpenSignal.asReadonly();

    const viewport = window.visualViewport;

    // Navegador sem a API (ou ambiente de teste headless): o sinal permanece
    // `false` para sempre e a barra segue visível — degradação silenciosa exigida
    // por spec.md FR-015, sem erro em console.
    if (!viewport) {
      return;
    }

    const update = (): void => {
      // `scale !== 1` = pinch zoom, que também reduz a altura visual sem teclado
      // nenhum; sem esta checagem, dar zoom esconderia a navegação.
      const isZoomed = viewport.scale !== 1;
      const shrinkage = window.innerHeight - viewport.height;

      this.isOpenSignal.set(!isZoomed && shrinkage > KEYBOARD_HEIGHT_THRESHOLD_PX);
    };

    // `scroll` além de `resize`: no iOS, abrir o teclado desloca o visual viewport
    // sem necessariamente emitir `resize`.
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
  }
}
