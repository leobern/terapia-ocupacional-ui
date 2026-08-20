import { Injectable, type Signal, signal } from '@angular/core';

/**
 * Espelho em TypeScript de `$breakpoint-md` (`shared/styles/_breakpoints.scss`).
 * Os dois precisam andar juntos; o spec deste serviço afirma o valor justamente
 * para a divergência aparecer como teste vermelho, não como bug de layout.
 */
export const BREAKPOINT_MD_PX = 1200;

/**
 * Informa se a viewport está no breakpoint de desktop (`md`, >=1200px).
 *
 * Por que um serviço e não `@include md { display: none }` como a `bottom-nav-bar`
 * faz: esconder por CSS serve para um elemento decorativo do chassi, mas NÃO para
 * uma superfície modal. Um `<dialog>` que já recebeu `showModal()` e depois é
 * escondido com `display: none` continua no top layer para efeito de foco — fica
 * com o foco preso e a rolagem da página travada, invisível. A decisão de montar
 * um modal tem que ser de runtime (DS-component-bottom-sheet, research.md §6).
 *
 * Por que não `@angular/cdk/layout`: o CDK está em `package.json` mas tem uso zero
 * no `src/`; inaugurá-lo por causa de uma media query seria dependência estrutural
 * nova para ~12 linhas de `matchMedia`.
 *
 * Mesmo formato do `ViewportKeyboardService` e do `KeyboardFocusService` (serviço
 * root + `signal` privado alimentado por listener registrado no construtor), para
 * que os sinais de ambiente do projeto sejam lidos todos da mesma maneira.
 */
@Injectable({ providedIn: 'root' })
export class ViewportBreakpointService {
  readonly isDesktop: Signal<boolean>;

  private readonly isDesktopSignal = signal(false);

  constructor() {
    this.isDesktop = this.isDesktopSignal.asReadonly();

    // Navegador sem a API (ou ambiente de teste headless sem `matchMedia`): o sinal
    // permanece `false` para sempre. A degradação é deliberadamente mobile-first —
    // o sheet continua sendo montado, em vez de sumir num ambiente que apenas não
    // sabe informar a largura.
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(`(min-width: ${BREAKPOINT_MD_PX}px)`);

    this.isDesktopSignal.set(query.matches);

    query.addEventListener('change', event => {
      this.isDesktopSignal.set(event.matches);
    });
  }
}
