import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { ViewportKeyboardService } from '../../services/viewport-keyboard.service';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { IconLogoButtonComponent } from '../icon-logo/icon-logo-button.component';

/**
 * Barra de navegação inferior (DS-component-bottom-nav-bar, nó Figma `2265:1390`).
 *
 * Chassi de navegação de TODA tela em celular e tablet (`xs`/`sm`); em desktop
 * (`md`) ela se esconde sozinha e o `app-nav-menu` assume — os dois arquivos de
 * SCSS são leitura simétrica um do outro.
 *
 * Estrutura FIXA de 3 gatilhos, sem lista configurável e sem estado de item
 * ativo: o Figma não desenha nenhum dos dois, e inventá-los seria criar design
 * (spec.md § Clarifications, 2026-07-26). A barra emite intenções — abrir o menu
 * do sistema, o bottom-sheet da conversa com a IA e o bottom-sheet de ações da
 * tela ativa — e NUNCA navega nem monta as superfícies por conta própria; por
 * isso não injeta `Router`.
 *
 * Também não expõe `disabled` por slot: o visual `disabled` do `icon-button`
 * pinta um retângulo cinza, que destruiria o desenho chromeless da barra. Ação
 * ainda sem destino simplesmente não tem o evento conectado.
 *
 * Instância ÚNICA, montada pelo shell (`app.component.html`) — nunca por tela,
 * nunca dentro do `page-container` (contracts/bottom-nav-bar-api.md).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Com o teclado virtual aberto a barra sai do caminho: no iOS ela flutuaria
    // por cima do teclado, no Android cobriria o campo em foco (spec.md FR-015).
    '[class.bottom-nav-bar--hidden]': 'viewportKeyboard.isVirtualKeyboardOpen()',
  },
  imports: [IconButtonComponent, IconLogoButtonComponent],
  selector: 'app-bottom-nav-bar',
  styleUrl: './bottom-nav-bar.component.scss',
  templateUrl: './bottom-nav-bar.component.html',
})
export class BottomNavBarComponent {
  /**
   * Convite exibido sob o símbolo da IA. É **dinâmico por design**: o consumidor
   * troca o texto conforme a tela, o horário, a ação em curso ou um gatilho da
   * própria IA, para incentivar o acionamento. O default é o texto do Figma.
   *
   * Restrições: uma linha só, truncada com reticências se não couber no espaço
   * livre entre os botões laterais (ver o SCSS). Quebrar em duas linhas
   * empurraria o símbolo para cima e desfaria o transbordo de 8px do desenho —
   * então o texto precisa ser curto por escrita, não por corte.
   */
  readonly aiLabel = input<string>('Como eu posso te ajudar?');

  /**
   * Estado das superfícies que a barra abre, informado pelo consumidor (quem as
   * monta é ele). Existem só para alimentar `aria-expanded` — nenhum efeito
   * visual.
   *
   * PENDENTE: a reflexão para o DOM depende de `app-icon-button` e
   * `app-icon-logo-button` aceitarem repassar atributos ARIA ao `<button>`
   * interno, o que hoje nenhum dos dois faz. Fechar via `/speckit-design` nas
   * duas entries antes de implementar spec.md FR-016. As props já existem para
   * que o consumidor não precise mudar quando o passthrough chegar.
   */
  readonly menuOpen = input<boolean>(false);
  readonly aiOpen = input<boolean>(false);
  readonly actionsOpen = input<boolean>(false);

  // `output()` sem argumento de tipo (e não `output<void>()`): os eventos não
  // carregam payload — mesma convenção já usada em `IconLogoButtonComponent`.
  readonly menuClick = output();
  readonly aiClick = output();
  readonly actionsClick = output();

  /**
   * Rótulos acessíveis fixos (spec.md § Acessibilidade). Não são inputs: os 3
   * botões sempre significam a mesma coisa, em qualquer tela, e deixar a tela
   * renomeá-los abriria espaço para navegação inconsistente entre telas.
   */
  protected readonly menuLabel = 'Abrir menu';
  protected readonly aiButtonLabel = 'Abrir assistente de IA';
  protected readonly actionsLabel = 'Ações desta tela';

  protected readonly viewportKeyboard = inject(ViewportKeyboardService);
}
