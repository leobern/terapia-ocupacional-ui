import { Injectable, type Signal, signal } from '@angular/core';

/**
 * Estado (aberto/fechado) do assistente de IA — compartilhado entre o shell
 * da aplicação (que monta `app-drawer`/`app-bottom-sheet`, únicos, em
 * `app.component.html`) e qualquer tela que precise abrir o painel (ex.:
 * botão de atalhos do cabeçalho da Home).
 *
 * Um serviço em vez de `@Output` porque não existe caminho de evento entre
 * uma tela roteada e `app.component` — o `<router-outlet>` não propaga
 * eventos do componente filho para o pai. Mesmo formato dos outros serviços
 * de estado do app (`ViewportBreakpointService`, `KeyboardFocusService`):
 * `providedIn: 'root'`, sinal privado + `Signal` público somente leitura.
 */
@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  readonly isOpen: Signal<boolean>;

  private readonly isOpenSignal = signal(false);

  constructor() {
    this.isOpen = this.isOpenSignal.asReadonly();
  }

  openPanel(): void {
    this.isOpenSignal.set(true);
  }

  closePanel(): void {
    this.isOpenSignal.set(false);
  }
}
